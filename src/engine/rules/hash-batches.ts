import { setWorkMem, workMemFor } from '../sql';
import type { Rule } from '../types';

/**
 * Regla 4 · Hash que no cabe en memoria: `Batches:` > 1 en un Hash (de un Hash Join) o en un
 * HashAggregate. Siempre se reporta. Se sugiere subir work_mem o traer menos columnas.
 */
export const hashBatchesRule: Rule = {
  id: 'hash-batches',
  check(ctx) {
    return ctx.nodes
      .filter((node) => (node.type === 'Hash' || node.type === 'HashAggregate') && (node.hashBatches ?? 1) > 1)
      .map((node) => {
        const batches = node.hashBatches ?? 1;
        const memoryKb = node.memoryKb ?? 0;
        // Un Hash reparte la tabla en lotes del tamaño de su memoria; un HashAggregate dice cuánto bajó a disco
        const neededKb = node.type === 'Hash' ? memoryKb * batches : memoryKb + (node.diskKb ?? 0);
        const workMem = workMemFor(neededKb);
        const parent = node.parentId === undefined ? undefined : ctx.nodes[node.parentId];
        return {
          rule: 'hash-batches' as const,
          severity: 'alert' as const,
          nodeId: node.id,
          relatedNodeIds: parent && node.type === 'Hash' ? [parent.id] : undefined,
          impactMs: node.type === 'Hash' && parent ? parent.selfMs + node.selfMs : node.selfMs,
          data: {
            batches,
            originalBatches: node.hashOriginalBatches ?? batches,
            memoryKb,
            diskKb: node.diskKb ?? 0,
            workMem,
          },
          sql: neededKb > 0 ? [setWorkMem(workMem)] : [],
        };
      });
  },
};
