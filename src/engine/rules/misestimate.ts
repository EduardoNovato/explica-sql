import { functionCalls } from '../expression';
import { bareName, ownColumns, plainColumns } from '../sql';
import { thresholds } from '../thresholds';
import { ancestors, childrenOf, descendants, isTableScan } from '../tree';
import type { PlanNode, Rule } from '../types';

/**
 * Regla 2 · Estimación muy errada: el planificador esperaba ≥ 10× más o menos filas de las que
 * salieron, con ≥ 1.000 filas reales. Solo se reporta donde nace el error (no en los nodos de arriba
 * que lo heredan) y no se cuentan las sobreestimaciones bajo un Limit o un join que corta temprano.
 */

/** Cuántas veces se equivocó la estimación (1 = exacta), comparando por vuelta */
export function errorFactor(node: PlanNode): number {
  if (!node.estimate || !node.actual || node.neverExecuted) return 1;
  const estimated = node.estimate.rows;
  const actual = node.actual.rows;
  return Math.max(estimated, actual) / Math.max(Math.min(estimated, actual), 1);
}

const isMisestimated = (node: PlanNode) => errorFactor(node) >= thresholds.misestimate.minFactor;

/** Nodos que pueden dejar de pedir filas antes de tiempo: abajo de ellos, leer menos de lo estimado es normal */
function stopsEarly(node: PlanNode): boolean {
  return node.type === 'Limit' || node.type === 'Merge Join' || /Semi|Anti/.test(node.joinType ?? '');
}

export const misestimateRule: Rule = {
  id: 'misestimate',
  check(ctx) {
    return ctx.nodes
      .filter((node) => {
        if (!isMisestimated(node) || !node.estimate || !node.actual) return false;
        if (node.actual.rows * node.actual.loops < thresholds.misestimate.minActualRows) return false;
        if (childrenOf(node, ctx.nodes).some(isMisestimated)) return false;
        const overestimated = node.estimate.rows > node.actual.rows;
        return !(overestimated && [...ancestors(node, ctx.nodes)].some(({ ancestor }) => stopsEarly(ancestor)));
      })
      .map((node) => {
        const loops = node.actual?.loops ?? 1;
        const estimated = node.estimate?.rows ?? 0;
        const actual = node.actual?.rows ?? 0;
        const condition = node.filter ?? node.indexCond ?? node.recheckCond;
        const withFunctions = condition !== undefined && functionCalls(condition).length > 0;
        const tables = isTableScan(node) ? [node] : descendants(node, ctx.nodes).filter(isTableScan).slice(0, 3);

        const sql: string[] = [];
        const columns = isTableScan(node) && !withFunctions ? plainColumns(ownColumns(node, condition)) : [];
        if (node.relation && columns.length >= 2) {
          const name = `${bareName(node.relation)}_${columns.map((column) => column.replace(/"/g, '')).join('_')}_stats`;
          sql.push(`CREATE STATISTICS ${name} (dependencies) ON ${columns.join(', ')} FROM ${node.relation};`);
        }
        for (const table of new Set(tables.map((scan) => scan.relation))) if (table) sql.push(`ANALYZE ${table};`);

        return {
          rule: 'misestimate' as const,
          severity: 'warning' as const,
          nodeId: node.id,
          impactMs: node.inclusiveMs,
          data: {
            table: node.relation ?? '',
            estimatedRows: estimated * loops,
            actualRows: actual * loops,
            factor: errorFactor(node),
            direction: estimated < actual ? 'under' : 'over',
            hint: withFunctions ? 'functions' : '',
          },
          sql,
        };
      });
  },
};
