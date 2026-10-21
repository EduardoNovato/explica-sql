/**
 * Motor de análisis de Explica SQL.
 *
 * TypeScript puro: solo importa archivos de esta carpeta. Nada de Astro, React, APIs del navegador
 * ni paquetes externos, para probarlo con Vitest y medir su velocidad sin abrir una página
 * (`purity.test.ts` lo vigila). Los textos para el usuario no viven aquí: cada hallazgo trae un
 * código de regla y datos, y la interfaz arma el mensaje en cada idioma.
 *
 * Flujo: texto o JSON de EXPLAIN ANALYZE → árbol de nodos → tiempo propio por nodo
 *   → veredicto global → 8 reglas + avisos de contexto
 */
import { contextNotices } from './notices';
import { parsePlan } from './parse';
import { rules } from './rules';
import { RULES_VERSION } from './thresholds';
import { computeTiming } from './timing';
import { isTableScan } from './tree';
import type { Analysis, AnalyzeResult, Finding, ParsedPlan, PlanNode, Severity } from './types';
import { verdictFor } from './verdict';

export { parsePlan } from './parse';
export { RULES_VERSION, thresholds, verdictLimits } from './thresholds';
export type * from './types';

const SEVERITY_ORDER: Record<Severity, number> = { alert: 0, warning: 1, note: 2 };

export function analyze(input: string): AnalyzeResult {
  const parsed = parsePlan(input);
  if (!parsed.ok) return parsed;
  return { ok: true, analysis: analyzePlan(parsed.plan) };
}

export function analyzePlan(plan: ParsedPlan): Analysis {
  const { nodes } = plan;
  const root = nodes[0];
  const hasAnalyze = nodes.some((node) => node.actual !== undefined && !node.neverExecuted) || plan.executionMs !== undefined;
  const hasBuffers = nodes.some((node) => node.buffers !== undefined);
  const totalMs = computeTiming(nodes, plan.executionMs);
  const verdict = hasAnalyze ? verdictFor(totalMs) : undefined;

  const ctx = { nodes, totalMs };
  const order = new Map(rules.map((rule, i) => [rule.id, i]));
  const findings: Finding[] = rules
    .flatMap((rule) => rule.check(ctx))
    // Una consulta rápida no merece alertas: todo queda como nota informativa
    .map((finding) => (verdict === 'fast' ? { ...finding, severity: 'note' as const } : finding))
    .sort(
      (a, b) =>
        SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] ||
        b.impactMs - a.impactMs ||
        (order.get(a.rule) ?? 0) - (order.get(b.rule) ?? 0),
    );

  const slowest = hasAnalyze
    ? nodes.reduce<PlanNode | undefined>((best, node) => (!best || node.selfMs > best.selfMs ? node : best), undefined)
    : undefined;
  const rowsRead = hasAnalyze
    ? nodes
        .filter(isTableScan)
        .reduce(
          (sum, node) =>
            sum + (node.actual ? (node.actual.rows + (node.rowsRemovedByFilter ?? 0) + (node.rowsRemovedByIndexRecheck ?? 0)) * node.actual.loops : 0),
          0,
        )
    : undefined;

  return {
    format: plan.format,
    rulesVersion: RULES_VERSION,
    nodes,
    planningMs: plan.planningMs,
    executionMs: plan.executionMs,
    totalMs,
    hasAnalyze,
    hasBuffers,
    verdict,
    metrics: {
      slowestNodeId: slowest?.id,
      rowsRead,
      rowsReturned: root?.actual ? root.actual.rows * root.actual.loops : undefined,
    },
    findings,
    notices: contextNotices(plan, hasAnalyze, hasBuffers),
  };
}
