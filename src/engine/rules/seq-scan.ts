import { ownColumns, plainColumns } from '../sql';
import { thresholds } from '../thresholds';
import type { Dialect, PlanNode, Rule } from '../types';
import { isNestedLoopInnerScan } from './nested-loop';

/**
 * Regla 1 · Escaneo completo costoso: lee toda la tabla para quedarse con muy poco y pesa ≥ 20 %
 * del tiempo. Se sugiere un índice con las columnas del filtro.
 *
 * - PostgreSQL dice cuánto descartó (`Rows Removed by Filter`): ≥ 90 % y ≥ 1.000 filas.
 * - Oracle no lo dice. La señal es leer muchos bloques (≥ 1.000) para devolver menos de una fila
 *   cada dos bloques, con un `filter()` en el paso: en un bloque de 8 kB caben decenas de filas,
 *   así que eso solo pasa cuando casi todo se descarta.
 */
export function isCostlySeqScan(node: PlanNode, dialect: Dialect): boolean {
  if (node.kind !== 'full-scan' || !node.actual || node.neverExecuted) return false;
  const kept = node.actual.rows * node.actual.loops;

  if (dialect === 'oracle') {
    const limits = thresholds.oracleFullScan;
    const blocks = blocksRead(node);
    return node.filter !== undefined && blocks >= limits.minBlocks && kept <= blocks * limits.maxRowsPerBlock && node.selfShare >= limits.minTimeShare;
  }

  const removed = node.rowsRemovedByFilter ?? 0;
  const read = removed + node.actual.rows;
  const limits = thresholds.seqScan;
  return (
    read > 0 &&
    removed / read >= limits.minRemovedShare &&
    removed * node.actual.loops >= limits.minRemovedRows &&
    node.selfShare >= limits.minTimeShare
  );
}

const blocksRead = (node: PlanNode) => (node.buffers ? node.buffers.sharedHit + node.buffers.sharedRead : 0);

export const seqScanRule: Rule = {
  id: 'seq-scan',
  check(ctx) {
    return ctx.nodes
      .filter((node) => isCostlySeqScan(node, ctx.dialect) && !isNestedLoopInnerScan(node, ctx))
      .map((node) => {
        const loops = node.actual?.loops ?? 1;
        const removed = node.rowsRemovedByFilter ?? 0;
        const kept = node.actual?.rows ?? 0;
        const relation = node.relation ?? '';
        // Las columnas envueltas en funciones no sirven para un índice normal (lo cubre la regla 6)
        const columns = plainColumns(ownColumns(node, node.filter, ctx.sql));
        const common = { table: relation, keptRows: kept * loops, timeShare: node.selfShare, columns: columns.join(', ') };
        return {
          rule: 'seq-scan' as const,
          severity: 'alert' as const,
          nodeId: node.id,
          impactMs: node.selfMs,
          data:
            ctx.dialect === 'oracle'
              ? { ...common, blocks: blocksRead(node) }
              : { ...common, removedRows: removed * loops, removedShare: removed / (removed + kept) },
          sql: relation && columns.length > 0 ? [ctx.sql.createIndex(relation, columns)] : [],
        };
      });
  },
};
