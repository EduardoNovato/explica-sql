import { describe, expect, it } from 'vitest';
import { plans } from '../fixtures';
import type { PlanNode } from '../types';
import { parsePlan } from './index';
import { describeLabel } from './node';

function nodesOf(input: string): PlanNode[] {
  const result = parsePlan(input);
  if (!result.ok) throw new Error(result.error);
  return result.plan.nodes;
}

describe('lector de texto', () => {
  it.each([
    ['DBeaver (con encabezado)', plans.control],
    ['psql (encabezado, separador y conteo de filas)', plans.controlPsql],
    ['pgAdmin (cada fila entre comillas)', plans.controlPgadmin],
    ['vista de texto de DBeaver (bordes |)', plans.controlDbeaverText],
  ])('lee el mismo plan copiado desde %s', (_source, input) => {
    const result = parsePlan(input);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.plan.format).toBe('text');
    expect(result.plan.planningMs).toBe(0.062);
    expect(result.plan.executionMs).toBe(0.032);
    expect(result.plan.nodes).toHaveLength(1);
    expect(result.plan.nodes[0]).toMatchObject({
      type: 'Seq Scan',
      relation: 'pedidos',
      filter: "((estado)::text = 'pagado'::text)",
      rowsRemovedByFilter: 5,
      estimate: { startupCost: 0, totalCost: 1.1, rows: 3, width: 44 },
      actual: { startupMs: 0.011, totalMs: 0.014, rows: 3, loops: 1 },
      buffers: { sharedHit: 1 },
    });
  });

  it('arma el árbol por la sangría', () => {
    const nodes = nodesOf(plans.hashSort);
    expect(nodes.map((node) => [node.type, node.parentId, node.depth])).toEqual([
      ['Sort', undefined, 0],
      ['Hash Join', 0, 1],
      ['Seq Scan', 1, 2],
      ['Hash', 1, 2],
      ['Seq Scan', 3, 3],
    ]);
    expect(nodes[1]?.children).toEqual([2, 3]);
  });

  it('acepta "Planning time" en minúscula (versiones viejas)', () => {
    const result = parsePlan(plans.resultDominant);
    expect(result.ok && result.plan.planningMs).toBe(0.104);
    expect(result.ok && result.plan.executionMs).toBe(143.512);
  });

  it('acepta "Total runtime" (PostgreSQL 9.3 y anteriores)', () => {
    const result = parsePlan(
      'Seq Scan on pedidos  (cost=0.00..1.08 rows=8 width=44) (actual time=0.008..0.010 rows=8 loops=1)\nTotal runtime: 0.045 ms',
    );
    expect(result.ok && result.plan.executionMs).toBe(0.045);
  });

  it('ignora las secciones de resumen: Settings, Planning (con sus Buffers) y JIT', () => {
    const result = parsePlan(plans.summarySections);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.plan.nodes).toHaveLength(4);
    expect(result.plan.planningMs).toBe(0.41);
    expect(result.plan.executionMs).toBe(7.1);
    expect(result.plan.nodes[0]?.buffers?.sharedHit).toBe(2);
    expect(result.plan.nodes[3]?.details).toEqual(['Buffers: shared hit=1']);
  });

  it('cuelga InitPlan del nodo correcto y marca los nodos que no se ejecutaron', () => {
    const nodes = nodesOf(plans.subplans);
    expect(nodes.map((node) => [node.type, node.parentId])).toEqual([
      ['Limit', undefined],
      ['Result', 0],
      ['Nested Loop', 0],
      ['Seq Scan', 2],
      ['Index Scan', 2],
    ]);
    expect(nodes[1]?.subplan).toBe('InitPlan 1 (returns $0)');
    expect(nodes[4]).toMatchObject({ neverExecuted: true, index: 'pedidos_cliente_idx', relation: 'pedidos', alias: 'p' });
  });

  it('lee el ordenamiento en disco, los lotes del hash y los workers', () => {
    const sort = nodesOf(plans.hashSort);
    expect(sort[0]).toMatchObject({ sortKey: ['l.l_shipdate'], sortMethod: 'external merge', sortDiskKb: 22016 });
    expect(sort[3]).toMatchObject({ hashBatches: 4, memoryKb: 2466 });
    expect(sort[0]?.buffers).toMatchObject({ sharedHit: 1650, sharedRead: 111420, tempRead: 12862, tempWritten: 12904 });

    expect(nodesOf(plans.hashAggregate)[0]).toMatchObject({ type: 'HashAggregate', hashBatches: 5, memoryKb: 4145, diskKb: 13256 });
    expect(nodesOf(plans.parallel)[1]).toMatchObject({ type: 'Gather', workersPlanned: 2, workersLaunched: 1 });
  });

  it('toma el mayor disco entre el nodo y sus workers', () => {
    const nodes = nodesOf(
      [
        'Sort  (cost=1.00..2.00 rows=10 width=8) (actual time=10.000..12.000 rows=10 loops=3)',
        '  Sort Key: total DESC',
        '  Sort Method: external merge  Disk: 900kB',
        '  Worker 0:  Sort Method: external merge  Disk: 1272kB',
        '  Worker 1:  Sort Method: quicksort  Memory: 25kB',
      ].join('\n'),
    );
    expect(nodes[0]).toMatchObject({ sortMethod: 'external merge', sortDiskKb: 1272, sortKey: ['total DESC'] });
  });

  it('lee planes sin ANALYZE y sin costos', () => {
    const scan = nodesOf(plans.estimateOnly)[1];
    expect(scan).toMatchObject({ type: 'Seq Scan', estimate: { rows: 8 } });
    expect(scan?.actual).toBeUndefined();
    expect(nodesOf('Seq Scan on pedidos\n  Filter: (id = 3)')[0]).toMatchObject({ type: 'Seq Scan', filter: '(id = 3)' });
  });

  it('lee filas con decimales (PostgreSQL 18)', () => {
    const nodes = nodesOf('Seq Scan on pedidos  (cost=0.00..1.08 rows=8 width=44) (actual time=0.008..0.010 rows=8.00 loops=1)');
    expect(nodes[0]?.actual?.rows).toBe(8);
  });

  it('acepta un subárbol copiado desde un "->"', () => {
    const nodes = nodesOf(
      [
        '      ->  Sort  (cost=1.00..2.00 rows=10 width=8) (actual time=1.000..1.200 rows=10 loops=1)',
        '            Sort Key: total',
        '            ->  Seq Scan on pedidos  (cost=0.00..1.00 rows=10 width=8) (actual time=0.010..0.500 rows=10 loops=1)',
      ].join('\n'),
    );
    expect(nodes.map((node) => node.type)).toEqual(['Sort', 'Seq Scan']);
  });

  it('lee un plan muy profundo en tiempo lineal (sangrías de miles de espacios)', () => {
    const depth = 400;
    const lines = ['Sort  (cost=1.00..2.00 rows=10 width=8) (actual time=1.000..900.000 rows=10 loops=1)', '  Sort Key: total'];
    for (let i = 1; i < depth; i++) {
      const indent = ' '.repeat(2 + (i - 1) * 6);
      lines.push(`${indent}->  Sort  (cost=1.00..2.00 rows=10 width=8) (actual time=1.000..${900 - i} rows=10 loops=1)  `);
      lines.push(`${indent}      Sort Key: total  `);
    }
    const start = performance.now();
    expect(nodesOf(lines.join('\n'))).toHaveLength(depth);
    expect(performance.now() - start).toBeLessThan(1000);
  });

  it('avisa cuando la copia perdió la sangría', () => {
    const result = parsePlan(['Sort  (cost=1.00..2.00 rows=10 width=8)', '->  Seq Scan on pedidos  (cost=0.00..1.00 rows=10 width=8)'].join('\n'));
    expect(result).toEqual({ ok: false, error: 'no-indentation' });
  });

  it('distingue un texto vacío de uno que no es un plan', () => {
    expect(parsePlan('  \n\n ')).toEqual({ ok: false, error: 'empty' });
    expect(parsePlan('select * from pedidos;')).toEqual({ ok: false, error: 'not-a-plan' });
  });
});

describe('encabezado de los nodos', () => {
  it.each([
    ['Seq Scan on pedidos p', { type: 'Seq Scan', relation: 'pedidos', alias: 'p', parallel: false }],
    ['Parallel Seq Scan on public.orders', { type: 'Seq Scan', relation: 'public.orders', parallel: true }],
    ['Index Scan using pedidos_pkey on pedidos', { type: 'Index Scan', index: 'pedidos_pkey', relation: 'pedidos' }],
    ['Index Only Scan Backward using idx_fecha on facturas f', { type: 'Index Only Scan', index: 'idx_fecha', relation: 'facturas', alias: 'f' }],
    ['Bitmap Index Scan on facturas_sede_idx', { type: 'Bitmap Index Scan', index: 'facturas_sede_idx' }],
    ['Nested Loop', { type: 'Nested Loop' }],
    ['Nested Loop Left Join', { type: 'Nested Loop', joinType: 'Left' }],
    ['Hash Right Anti Join', { type: 'Hash Join', joinType: 'Right Anti' }],
    ['Parallel Hash', { type: 'Hash', parallel: true }],
    ['Partial HashAggregate', { type: 'HashAggregate' }],
    ['Finalize GroupAggregate', { type: 'GroupAggregate' }],
    ['Update on pedidos', { type: 'Update', relation: 'pedidos' }],
  ])('%s', (label, expected) => {
    expect(describeLabel(label)).toMatchObject(expected);
  });
});
