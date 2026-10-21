import { describe, expect, it } from 'vitest';
import { analysisOf, findingsOf, plans } from '../fixtures';

const scan = (estimated: number, actual: number, loops = 1) =>
  [
    `Seq Scan on pedidos  (cost=0.00..100.00 rows=${estimated} width=8) (actual time=0.010..5.000 rows=${actual} loops=${loops})`,
    '  Filter: (estado = 3)',
    'Execution Time: 50.000 ms',
  ].join('\n');

describe('regla 2 · estimación muy errada', () => {
  it('reporta solo el nodo donde nace el error, no los que lo heredan', () => {
    const findings = findingsOf(analysisOf(plans.resultDominant), 'misestimate');
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({
      severity: 'warning',
      nodeId: 2,
      data: { table: 'facturas', estimatedRows: 1, actualRows: 3870, factor: 3870, direction: 'under', hint: 'functions' },
      sql: ['ANALYZE facturas;'],
    });
  });

  it('sugiere estadísticas extendidas cuando el filtro combina columnas', () => {
    expect(findingsOf(analysisOf(plans.customerStats), 'misestimate')[0]?.sql).toEqual([
      'CREATE STATISTICS customer_c_nationkey_c_mktsegment_stats (dependencies) ON c_nationkey, c_mktsegment FROM customer;',
      'ANALYZE customer;',
    ]);
  });

  it('salta desde 10× y 1.000 filas reales, en los dos sentidos', () => {
    expect(findingsOf(analysisOf(scan(100, 1000)), 'misestimate')).toHaveLength(1);
    expect(findingsOf(analysisOf(scan(101, 1000)), 'misestimate')).toEqual([]);
    expect(findingsOf(analysisOf(scan(50, 999)), 'misestimate')).toEqual([]);
    expect(findingsOf(analysisOf(scan(20_000, 1500)), 'misestimate')[0]?.data.direction).toBe('over');
  });

  it('cuenta las filas reales de todas las vueltas', () => {
    expect(findingsOf(analysisOf(scan(1, 20, 100)), 'misestimate')[0]?.data).toMatchObject({ estimatedRows: 100, actualRows: 2000 });
  });

  it('no culpa a lo que corta un Limit', () => {
    expect(findingsOf(analysisOf(plans.limit), 'misestimate')).toEqual([]);
  });

  it('en un join sugiere ANALYZE de las tablas de abajo', () => {
    const plan = [
      'Hash Join  (cost=1.18..20.36 rows=10 width=52) (actual time=0.040..30.000 rows=50000 loops=1)',
      '  Hash Cond: (p.cliente_id = c.id)',
      '  ->  Seq Scan on pedidos p  (cost=0.00..10.00 rows=50000 width=44) (actual time=0.008..10.000 rows=50000 loops=1)',
      '  ->  Hash  (cost=1.08..1.08 rows=800 width=12) (actual time=0.015..0.016 rows=800 loops=1)',
      '        ->  Seq Scan on clientes c  (cost=0.00..1.08 rows=800 width=12) (actual time=0.006..0.008 rows=800 loops=1)',
      'Execution Time: 35.000 ms',
    ].join('\n');
    expect(findingsOf(analysisOf(plan), 'misestimate')).toMatchObject([{ nodeId: 0, sql: ['ANALYZE clientes;', 'ANALYZE pedidos;'] }]);
  });
});
