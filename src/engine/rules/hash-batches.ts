import { workMemFor } from '../sql';
import type { NodeKind, Rule } from '../types';

const HASH_KINDS: NodeKind[] = ['hash', 'hash-aggregate', 'hash-join'];

/**
 * Regla 4 · Hash que no cabe en memoria: `Batches:` > 1 en un Hash o un HashAggregate de
 * PostgreSQL, o un HASH JOIN / HASH GROUP BY de Oracle con `Used-Tmp`. Siempre se reporta.
 * Se sugiere subir work_mem (solo en PostgreSQL) o traer menos columnas.
 */
export const hashBatchesRule: Rule = {
  id: 'hash-batches',
  check(ctx) {
    return ctx.nodes
      .filter((node) => HASH_KINDS.includes(node.kind) && ((node.hashBatches ?? 1) > 1 || (node.diskKb ?? 0) > 0))
      .map((node) => {
        const batches = node.hashBatches ?? 1;
        const memoryKb = node.memoryKb ?? 0;
        // Un Hash reparte la tabla en lotes del tamaño de su memoria; los demás dicen cuánto bajó a disco
        const neededKb = node.kind === 'hash' ? memoryKb * batches : memoryKb + (node.diskKb ?? 0);
        const workMem = workMemFor(neededKb);
        const setWorkMem = neededKb > 0 ? ctx.sql.setWorkMem(workMem) : undefined;
        const parent = node.parentId === undefined ? undefined : ctx.nodes[node.parentId];
        const buildSide = node.kind === 'hash' && parent !== undefined;
        return {
          rule: 'hash-batches' as const,
          severity: 'alert' as const,
          nodeId: node.id,
          relatedNodeIds: buildSide && parent ? [parent.id] : undefined,
          impactMs: buildSide && parent ? parent.selfMs + node.selfMs : node.selfMs,
          data: {
            batches,
            originalBatches: node.hashOriginalBatches ?? batches,
            memoryKb,
            diskKb: node.diskKb ?? 0,
            workMem: setWorkMem ? workMem : '',
          },
          sql: setWorkMem ? [setWorkMem] : [],
        };
      });
  },
};
