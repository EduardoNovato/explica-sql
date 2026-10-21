import { createExpressionIndex, ownColumns } from '../sql';
import type { Rule } from '../types';
import { isCostlySeqScan } from './seq-scan';

/**
 * Regla 6 · Conversión o función sobre la columna en el Filter: `(columna)::tipo`, `date(columna)`.
 * Impide usar un índice normal, pero muchas veces es inofensiva (varchar → text, por ejemplo).
 * Por eso es **alerta** solo si el mismo nodo es un escaneo completo costoso (regla 1) y **nota**
 * en cualquier otro caso.
 */
export const castInFilterRule: Rule = {
  id: 'cast-in-filter',
  check(ctx) {
    return ctx.nodes.flatMap((node) => {
      const expressions: string[] = [];
      for (const ref of ownColumns(node, node.filter)) {
        const expression = ref.fnExpression ?? ref.cast;
        if (expression && !expressions.includes(expression)) expressions.push(expression);
      }
      if (expressions.length === 0) return [];

      const costly = isCostlySeqScan(node);
      const [first] = expressions;
      return [
        {
          rule: 'cast-in-filter' as const,
          severity: costly ? ('alert' as const) : ('note' as const),
          nodeId: node.id,
          impactMs: node.selfMs,
          data: {
            table: node.relation ?? '',
            expressions: expressions.join(', '),
            costly: costly ? 1 : 0,
          },
          sql: costly && node.relation && first ? [createExpressionIndex(node.relation, first)] : [],
        },
      ];
    });
  },
};
