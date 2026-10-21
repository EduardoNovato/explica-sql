import { describe, expect, it } from 'vitest';
import { analysisOf, plans } from './fixtures';

const noticesOf = (input: string) => analysisOf(input).notices;

describe('avisos de contexto', () => {
  it('sin ANALYZE: solo estimaciones, sin veredicto ni hallazgos de tiempo', () => {
    const analysis = analysisOf(plans.estimateOnly);
    expect(analysis.hasAnalyze).toBe(false);
    expect(analysis.verdict).toBeUndefined();
    expect(analysis.findings).toEqual([]);
    expect(analysis.notices).toEqual([{ id: 'no-analyze', data: {} }]);
  });

  it('con ANALYZE pero sin BUFFERS', () => {
    expect(noticesOf(plans.subplans)).toEqual([{ id: 'no-buffers', data: {} }]);
  });

  it('workers planeados que no arrancaron', () => {
    expect(noticesOf(plans.parallel)).toEqual([{ id: 'workers-not-launched', nodeId: 1, data: { planned: 2, launched: 1 } }]);
  });

  it('planificación más lenta que la ejecución, si pesa al menos 10 ms', () => {
    const plan = (planning: number, execution: number) =>
      [
        'Seq Scan on pedidos  (cost=0.00..1.08 rows=8 width=44) (actual time=0.008..0.010 rows=8 loops=1)',
        '  Buffers: shared hit=1',
        `Planning Time: ${planning} ms`,
        `Execution Time: ${execution} ms`,
      ].join('\n');
    expect(noticesOf(plan(45.2, 3.1))).toEqual([{ id: 'slow-planning', data: { planningMs: 45.2, executionMs: 3.1 } }]);
    // El caso de control planifica en 0,062 ms y ejecuta en 0,032 ms: no vale la pena avisar
    expect(noticesOf(plan(0.062, 0.032))).toEqual([]);
  });

  it('un plan bien medido no tiene avisos', () => {
    expect(noticesOf(plans.control)).toEqual([]);
    expect(noticesOf(plans.hashSort)).toEqual([]);
  });
});
