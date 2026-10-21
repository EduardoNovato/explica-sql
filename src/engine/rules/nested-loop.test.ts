import { describe, expect, it } from 'vitest';
import { analysisOf, findingsOf, plans } from '../fixtures';

/** Nested Loop cuyo lado interno da `loops` vueltas; `inner` es el nodo del lado interno */
const plan = (loops: number, inner = 'seq') =>
  [
    'Nested Loop  (cost=0.00..100.00 rows=10 width=12) (actual time=0.050..300.000 rows=10 loops=1)',
    `  ->  Seq Scan on clientes c  (cost=0.00..35.00 rows=${loops} width=8) (actual time=0.008..0.410 rows=${loops} loops=1)`,
    ...(inner === 'seq'
      ? [
          `  ->  Seq Scan on pedidos p  (cost=0.00..9.00 rows=1 width=8) (actual time=0.100..${(299 / loops).toFixed(4)} rows=1 loops=${loops})`,
          '        Filter: (p.cliente_id = c.id)',
          '        Rows Removed by Filter: 99',
        ]
      : inner === 'materialize'
        ? [
            `  ->  Materialize  (cost=0.00..9.00 rows=100 width=8) (actual time=0.001..${(299 / loops).toFixed(4)} rows=100 loops=${loops})`,
            '        ->  Seq Scan on pedidos p  (cost=0.00..9.00 rows=100 width=8) (actual time=0.010..1.000 rows=100 loops=1)',
          ]
        : [
            `  ->  Index Scan using pedidos_cliente_idx on pedidos p  (cost=0.29..0.31 rows=1 width=8) (actual time=0.010..0.012 rows=1 loops=${loops})`,
            '        Index Cond: (cliente_id = c.id)',
          ]),
    'Execution Time: 301.000 ms',
  ].join('\n');

describe('regla 5 · Nested Loop costoso', () => {
  it('apunta al escaneo interno y sugiere un índice en la columna del join', () => {
    expect(findingsOf(analysisOf(plans.nestedLoop), 'nested-loop')).toMatchObject([
      {
        severity: 'alert',
        nodeId: 2,
        relatedNodeIds: [0],
        data: { table: 'pedidos', loops: 2000, columns: 'cliente_id' },
        sql: ['CREATE INDEX ON pedidos (cliente_id);'],
      },
    ]);
  });

  it('salta desde 1.000 vueltas', () => {
    expect(findingsOf(analysisOf(plan(1000)), 'nested-loop')).toHaveLength(1);
    expect(findingsOf(analysisOf(plan(999)), 'nested-loop')).toEqual([]);
  });

  it('no salta si el lado interno usa un índice', () => {
    expect(findingsOf(analysisOf(plan(5000, 'index')), 'nested-loop')).toEqual([]);
  });

  it('no salta si el escaneo se hace una sola vez y se guarda en memoria (Materialize)', () => {
    expect(findingsOf(analysisOf(plan(5000, 'materialize')), 'nested-loop')).toEqual([]);
  });
});
