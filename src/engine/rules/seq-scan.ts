import { createIndex, ownColumns, plainColumns } from '../sql';
import { thresholds } from '../thresholds';
import type { PlanNode, Rule } from '../types';
import { isNestedLoopInnerScan } from './nested-loop';

/**
 * Regla 1 · Escaneo completo costoso: un Seq Scan que descarta ≥ 90 % de lo que lee, al menos
 * 1.000 filas, y pesa ≥ 20 % del tiempo. Se sugiere un índice con las columnas del Filter.
 */
export function isCostlySeqScan(node: PlanNode): boolean {
  if (node.type !== 'Seq Scan' || !node.actual || node.neverExecuted) return false;
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

export const seqScanRule: Rule = {
  id: 'seq-scan',
  check(ctx) {
    return ctx.nodes
      .filter((node) => isCostlySeqScan(node) && !isNestedLoopInnerScan(node, ctx))
      .map((node) => {
        const loops = node.actual?.loops ?? 1;
        const removed = node.rowsRemovedByFilter ?? 0;
        const kept = node.actual?.rows ?? 0;
        const relation = node.relation ?? '';
        // Las columnas envueltas en funciones no sirven para un índice normal (lo cubre la regla 6)
        const columns = plainColumns(ownColumns(node, node.filter));
        return {
          rule: 'seq-scan' as const,
          severity: 'alert' as const,
          nodeId: node.id,
          impactMs: node.selfMs,
          data: {
            table: relation,
            removedRows: removed * loops,
            keptRows: kept * loops,
            removedShare: removed / (removed + kept),
            timeShare: node.selfShare,
            columns: columns.join(', '),
          },
          sql: relation && columns.length > 0 ? [createIndex(relation, columns)] : [],
        };
      });
  },
};
