import { thresholds } from './thresholds';
import type { Notice, ParsedPlan } from './types';

/**
 * Avisos de contexto: no son problemas de la consulta sino de cómo se midió.
 *
 * - PostgreSQL: falta ANALYZE (solo hay estimaciones), falta BUFFERS, workers planeados que no
 *   arrancaron y planificación más lenta que la ejecución.
 * - Oracle: faltan las estadísticas de ejecución (GATHER_PLAN_STATISTICS), Oracle muestreó porque
 *   faltan estadísticas de tablas, el plan es paralelo o el cliente trajo solo una página de filas.
 */
export function contextNotices(plan: ParsedPlan, hasAnalyze: boolean, hasBuffers: boolean): Notice[] {
  return plan.dialect === 'oracle' ? oracleNotices(plan, hasAnalyze) : postgresNotices(plan, hasAnalyze, hasBuffers);
}

function postgresNotices(plan: ParsedPlan, hasAnalyze: boolean, hasBuffers: boolean): Notice[] {
  const notices: Notice[] = [];
  if (!hasAnalyze) notices.push({ id: 'no-analyze', data: {} });
  else if (!hasBuffers) notices.push({ id: 'no-buffers', data: {} });

  for (const node of plan.nodes) {
    const planned = node.workersPlanned;
    const launched = node.workersLaunched;
    if (planned !== undefined && launched !== undefined && launched < planned) {
      notices.push({ id: 'workers-not-launched', nodeId: node.id, data: { planned, launched } });
    }
  }

  const { planningMs, executionMs } = plan;
  if (
    planningMs !== undefined &&
    executionMs !== undefined &&
    planningMs > executionMs &&
    planningMs >= thresholds.slowPlanning.minPlanningMs
  ) {
    notices.push({ id: 'slow-planning', data: { planningMs, executionMs } });
  }
  return notices;
}

function oracleNotices(plan: ParsedPlan, hasAnalyze: boolean): Notice[] {
  const notices: Notice[] = [];
  if (!hasAnalyze) notices.push({ id: 'oracle-no-stats', data: {} });
  if (plan.oracle?.dynamicSampling) notices.push({ id: 'oracle-dynamic-sampling', data: {} });
  if (plan.nodes.some((node) => node.type.startsWith('PX '))) notices.push({ id: 'oracle-parallel', data: {} });

  const [root] = plan.nodes;
  const first = root?.children[0] === undefined ? undefined : plan.nodes[root.children[0]];
  const fetched = root?.actual?.rows;
  const expected = first?.estimate?.rows;
  const limits = thresholds.oraclePartialFetch;
  if (
    fetched !== undefined &&
    expected !== undefined &&
    (limits.fetchSizes as readonly number[]).includes(fetched) &&
    expected >= fetched * limits.minEstimateFactor
  ) {
    notices.push({ id: 'oracle-partial-fetch', data: { rows: fetched } });
  }
  return notices;
}
