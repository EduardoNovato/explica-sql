import { describe, expect, it } from 'vitest';
import { analysisOf, plans } from './fixtures';

const selfTimes = (input: string) => analysisOf(input).nodes.map((node) => Number(node.selfMs.toFixed(3)));

describe('tiempo propio por nodo', () => {
  it('resta a cada nodo el tiempo de sus hijos', () => {
    // Sort 3290.513 − Hash Join 2810.877 · Hash Join − lineitem − Hash · Hash − orders
    expect(selfTimes(plans.hashSort)).toEqual([479.636, 494.662, 2120.334, 75.433, 120.448]);
  });

  it('multiplica el tiempo por las vueltas', () => {
    const analysis = analysisOf(plans.nestedLoop);
    expect(analysis.nodes[2]?.inclusiveMs).toBeCloseTo(0.758 * 2000);
    expect(analysis.nodes[0]?.selfMs).toBeCloseTo(1520.442 - 0.41 - 1516);
  });

  it('bajo un Gather no cuenta dos veces el mismo reloj de los workers', () => {
    // 1 worker + el líder = 2 procesos: 30.555 ms × 2 vueltas ÷ 2
    const analysis = analysisOf(plans.parallel);
    expect(analysis.nodes[3]?.inclusiveMs).toBeCloseTo(30.555);
    expect(analysis.nodes[2]?.selfMs).toBeCloseTo(45.901 - 30.555);
  });

  it('los nodos que no se ejecutaron valen 0', () => {
    expect(analysisOf(plans.subplans).nodes[4]?.inclusiveMs).toBe(0);
  });

  it('el tiempo propio nunca es negativo', () => {
    const analysis = analysisOf(
      [
        'Hash Join  (cost=1.00..2.00 rows=1 width=8) (actual time=0.100..1.000 rows=1 loops=1)',
        '  ->  Seq Scan on pedidos  (cost=0.00..1.00 rows=1 width=8) (actual time=0.010..0.900 rows=1 loops=1)',
        '  ->  Hash  (cost=1.00..1.00 rows=1 width=8) (actual time=0.300..0.300 rows=1 loops=1)',
        '        ->  Seq Scan on clientes  (cost=0.00..1.00 rows=1 width=8) (actual time=0.010..0.200 rows=1 loops=1)',
      ].join('\n'),
    );
    expect(analysis.nodes[0]?.selfMs).toBe(0);
  });

  it('los porcentajes son sobre el Execution Time', () => {
    const analysis = analysisOf(plans.resultDominant);
    expect(analysis.totalMs).toBe(143.512);
    expect(analysis.nodes[0]?.selfShare).toBeCloseTo((142.87 - 25.904) / 143.512);
  });
});
