import { thresholds } from '../thresholds';
import type { Rule } from '../types';

/**
 * Regla 8 · Nodo dominante: un nodo se lleva ≥ 50 % del tiempo propio y la consulta tarda ≥ 100 ms.
 * Es el "empieza por aquí".
 */
export const dominantNodeRule: Rule = {
  id: 'dominant-node',
  check(ctx) {
    const limits = thresholds.dominantNode;
    if (ctx.totalMs < limits.minTotalMs) return [];
    const top = ctx.nodes.reduce<(typeof ctx.nodes)[number] | undefined>((best, node) => (!best || node.selfMs > best.selfMs ? node : best), undefined);
    if (!top || top.selfShare < limits.minTimeShare) return [];
    return [
      {
        rule: 'dominant-node',
        severity: 'alert',
        nodeId: top.id,
        impactMs: top.selfMs,
        data: {
          node: top.label,
          selfMs: top.selfMs,
          timeShare: top.selfShare,
          // Un Result con hijos solo calcula las columnas del SELECT: si tarda, suelen ser funciones por fila
          hint: (top.type === 'Result' || top.type === 'ProjectSet') && top.children.length > 0 ? 'select-functions' : '',
        },
        sql: [],
      },
    ];
  },
};
