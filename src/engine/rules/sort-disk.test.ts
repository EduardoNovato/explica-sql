import { describe, expect, it } from 'vitest';
import { analysisOf, findingsOf, plans } from '../fixtures';
import { workMemFor } from '../sql';

describe('regla 3 · ordenamiento en disco', () => {
  it('calcula work_mem desde lo que se escribió a disco y sugiere un índice con la Sort Key', () => {
    // 2480 kB × 3 = 7,3 MB → 8MB
    expect(findingsOf(analysisOf(plans.resultDominant), 'sort-disk')).toMatchObject([
      {
        severity: 'alert',
        nodeId: 1,
        data: { diskKb: 2480, workMem: '8MB', sortKey: 'numero' },
        sql: ["SET work_mem = '8MB';", 'CREATE INDEX ON facturas (numero);'],
      },
    ]);
  });

  it('encuentra la tabla de la Sort Key por su alias, aunque haya un join abajo', () => {
    // 22016 kB × 3 = 64,5 MB → 128MB
    expect(findingsOf(analysisOf(plans.hashSort), 'sort-disk')[0]?.sql).toEqual([
      "SET work_mem = '128MB';",
      'CREATE INDEX ON lineitem (l_shipdate);',
    ]);
  });

  it('no inventa un índice si la Sort Key es una expresión', () => {
    const plan = [
      'Sort  (cost=1.00..2.00 rows=10 width=8) (actual time=10.000..12.000 rows=10 loops=1)',
      '  Sort Key: (lower((nombre)::text))',
      '  Sort Method: external merge  Disk: 100kB',
      '  ->  Seq Scan on clientes  (cost=0.00..1.00 rows=10 width=8) (actual time=0.010..1.000 rows=10 loops=1)',
    ].join('\n');
    expect(findingsOf(analysisOf(plan), 'sort-disk')[0]?.sql).toEqual(["SET work_mem = '4MB';"]);
  });

  it('no salta con un ordenamiento en memoria', () => {
    expect(findingsOf(analysisOf(plans.control), 'sort-disk')).toEqual([]);
    const plan = 'Sort  (cost=1.00..2.00 rows=10 width=8) (actual time=10.000..12.000 rows=10 loops=1)\n  Sort Method: quicksort  Memory: 25kB';
    expect(findingsOf(analysisOf(plan), 'sort-disk')).toEqual([]);
  });

  it('redondea work_mem a una potencia de 2, con un mínimo de 4MB', () => {
    expect(workMemFor(100)).toBe('4MB');
    expect(workMemFor(7440)).toBe('8MB');
    expect(workMemFor(8192)).toBe('8MB');
    expect(workMemFor(8193)).toBe('16MB');
    expect(workMemFor(3 * 1024 * 1024)).toBe('4GB');
  });
});
