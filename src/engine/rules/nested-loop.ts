import { ownColumns, plainColumns } from '../sql';
import { thresholds } from '../thresholds';
import { ancestors, mainChildren } from '../tree';
import type { Finding, PlanNode, Rule, RuleContext } from '../types';

/**
 * Regla 5 · Nested Loop costoso: el lado interno se repite ≥ 1.000 veces y en cada vuelta hace un
 * escaneo completo. La solución suele ser un índice en la columna del join.
 */

/** El Nested Loop más cercano para el que este escaneo está en el lado interno */
function innerOf(scan: PlanNode, nodes: PlanNode[]): PlanNode | undefined {
  for (const { ancestor, via } of ancestors(scan, nodes)) {
    if (ancestor.kind === 'nested-loop' && mainChildren(ancestor, nodes)[1]?.id === via.id) return ancestor;
  }
  return undefined;
}

function isRepeatedFullScan(node: PlanNode): boolean {
  return node.kind === 'full-scan' && !node.neverExecuted && (node.actual?.loops ?? 0) >= thresholds.nestedLoop.minInnerLoops;
}

/** La regla 1 no repite lo que esta regla ya explica mejor */
export function isNestedLoopInnerScan(node: PlanNode, ctx: RuleContext): boolean {
  return isRepeatedFullScan(node) && innerOf(node, ctx.nodes) !== undefined;
}

export const nestedLoopRule: Rule = {
  id: 'nested-loop',
  check(ctx) {
    const findings: Finding[] = [];
    for (const scan of ctx.nodes) {
      if (!isRepeatedFullScan(scan)) continue;
      const join = innerOf(scan, ctx.nodes);
      if (!join || !scan.relation) continue;
      const columns = plainColumns([...ownColumns(scan, scan.filter, ctx.sql), ...ownColumns(scan, join.joinFilter, ctx.sql)]);
      findings.push({
        rule: 'nested-loop',
        severity: 'alert',
        nodeId: scan.id,
        relatedNodeIds: [join.id],
        impactMs: scan.inclusiveMs,
        data: {
          table: scan.relation,
          loops: scan.actual?.loops ?? 0,
          columns: columns.join(', '),
          timeShare: ctx.totalMs > 0 ? scan.inclusiveMs / ctx.totalMs : 0,
        },
        sql: columns.length > 0 ? [ctx.sql.createIndex(scan.relation, columns)] : [],
      });
    }
    return findings;
  },
};
