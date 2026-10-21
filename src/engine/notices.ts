import { thresholds } from './thresholds';
import type { Notice, ParsedPlan } from './types';

/**
 * Avisos de contexto: no son problemas de la consulta sino de cómo se midió.
 * Falta ANALYZE (solo hay estimaciones), falta BUFFERS, workers planeados que no arrancaron y
 * planificación más lenta que la ejecución.
 */
export function contextNotices(plan: ParsedPlan, hasAnalyze: boolean, hasBuffers: boolean): Notice[] {
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
