import { describe, expect, it } from 'vitest';
import { analysisOf, findingsOf, plans } from '../fixtures';

const plan = (sortMs: number, scanMs: number, totalMs: number) =>
  [
    `Sort  (cost=1.00..2.00 rows=10 width=8) (actual time=1.000..${sortMs} rows=10 loops=1)`,
    '  Sort Key: total',
    '  Sort Method: quicksort  Memory: 25kB',
    `  ->  Seq Scan on pedidos  (cost=0.00..1.00 rows=10 width=8) (actual time=0.010..${scanMs} rows=10 loops=1)`,
    `Execution Time: ${totalMs} ms`,
  ].join('\n');

describe('regla 8 · nodo dominante', () => {
  it('marca dónde empezar y reconoce un Result que calcula el SELECT', () => {
    expect(findingsOf(analysisOf(plans.resultDominant), 'dominant-node')).toMatchObject([
      { severity: 'alert', nodeId: 0, data: { node: 'Result', hint: 'select-functions' }, sql: [] },
    ]);
  });

  it('salta desde 50 % del tiempo en una consulta de 100 ms o más', () => {
    // Seq Scan: 60 de 120 ms = 50 % · Sort: 100 − 60 = 40 ms
    expect(findingsOf(analysisOf(plan(100, 60, 120)), 'dominant-node')).toMatchObject([{ nodeId: 1 }]);
    // Nadie llega al 50 %: Seq Scan 49 %, Sort 34 %
    expect(findingsOf(analysisOf(plan(100, 59, 120)), 'dominant-node')).toEqual([]);
    // Sort: 100 − 30 = 70 ms de 100
    expect(findingsOf(analysisOf(plan(100, 30, 100)), 'dominant-node')).toMatchObject([{ nodeId: 0 }]);
    // 91 % del tiempo, pero la consulta tarda menos de 100 ms
    expect(findingsOf(analysisOf(plan(99, 90, 99)), 'dominant-node')).toEqual([]);
  });
});
