import { thresholds } from '../thresholds';
import { childrenOf } from '../tree';
import type { Rule } from '../types';

/** Tamaño de un bloque de PostgreSQL en kB */
const BLOCK_KB = 8;

/**
 * Regla 7 · Mucha lectura desde disco: el nodo leyó de disco (`shared read`) ≥ 10.000 bloques y
 * ≥ 10 veces lo que encontró en memoria (`shared hit`). Se cuenta solo lo propio del nodo, sin sus
 * hijos. Puede ser caché fría: conviene repetir la medición antes de concluir.
 */
export const diskReadsRule: Rule = {
  id: 'disk-reads',
  check(ctx) {
    return ctx.nodes.flatMap((node) => {
      if (!node.buffers) return [];
      const children = childrenOf(node, ctx.nodes);
      const read = Math.max(0, node.buffers.sharedRead - children.reduce((sum, child) => sum + (child.buffers?.sharedRead ?? 0), 0));
      const hit = Math.max(0, node.buffers.sharedHit - children.reduce((sum, child) => sum + (child.buffers?.sharedHit ?? 0), 0));
      const limits = thresholds.diskReads;
      if (read < limits.minReadBlocks || read < limits.minReadToHitRatio * hit) return [];
      return [
        {
          rule: 'disk-reads' as const,
          severity: 'warning' as const,
          nodeId: node.id,
          impactMs: node.selfMs,
          data: {
            table: node.relation ?? '',
            readBlocks: read,
            hitBlocks: hit,
            readMb: (read * BLOCK_KB) / 1024,
          },
          sql: [],
        },
      ];
    });
  },
};
