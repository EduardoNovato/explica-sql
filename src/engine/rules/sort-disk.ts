import { sortKeyColumn } from '../expression';
import { createIndex, setWorkMem, workMemFor } from '../sql';
import { thresholds } from '../thresholds';
import { descendants, isTableScan, namesOf } from '../tree';
import type { PlanNode, Rule } from '../types';

/**
 * Regla 3 · Ordenamiento en disco: `Sort Method: external merge  Disk: N kB`. Siempre se reporta.
 * Se sugiere un work_mem calculado desde N y, si la Sort Key son columnas de una sola tabla, un
 * índice que entregue las filas ya ordenadas.
 */

/** `CREATE INDEX` con la Sort Key, si todas las claves son columnas de la misma tabla de abajo */
function sortIndex(node: PlanNode, nodes: PlanNode[]): string | undefined {
  const keys = (node.sortKey ?? []).map(sortKeyColumn);
  if (keys.length === 0 || keys.some((key) => key === undefined)) return undefined;
  const scans = descendants(node, nodes).filter(isTableScan);
  const tables = new Set(scans.map((scan) => scan.relation));
  const owners = new Set(
    keys.map((key) => (key?.qualifier ? scans.find((scan) => namesOf(scan).includes(key.qualifier ?? ''))?.relation : tables.size === 1 ? [...tables][0] : undefined)),
  );
  const [relation] = owners;
  if (owners.size !== 1 || !relation) return undefined;
  return createIndex(relation, keys.map((key) => `${key?.name ?? ''}${key?.order ?? ''}`));
}

export const sortDiskRule: Rule = {
  id: 'sort-disk',
  check(ctx) {
    return ctx.nodes
      .filter((node) => (node.sortDiskKb ?? 0) > 0)
      .map((node) => {
        const diskKb = node.sortDiskKb ?? 0;
        const workMem = workMemFor(diskKb * thresholds.sortDisk.workMemFactor);
        const index = sortIndex(node, ctx.nodes);
        return {
          rule: 'sort-disk' as const,
          severity: 'alert' as const,
          nodeId: node.id,
          impactMs: node.selfMs,
          data: {
            diskKb,
            workMem,
            sortKey: (node.sortKey ?? []).join(', '),
            timeShare: node.selfShare,
          },
          sql: [setWorkMem(workMem), ...(index ? [index] : [])],
        };
      });
  },
};
