import { describe, expect, it } from 'vitest';
import { analysisOf, findingsOf, plans } from '../fixtures';

/** Seq Scan que devuelve `kept` filas, descarta `removed` y tarda `ms` de un total de `totalMs` */
const scan = ({ kept = 14, removed = 1_499_986, ms = 185.33, totalMs = 185.512, loops = 1 }) =>
  [
    `Seq Scan on orders  (cost=0.00..44076.00 rows=${kept} width=107) (actual time=0.100..${ms / loops} rows=${kept} loops=${loops})`,
    '  Filter: (o_custkey = 74221)',
    `  Rows Removed by Filter: ${removed}`,
    `Execution Time: ${totalMs} ms`,
  ].join('\n');

describe('regla 1 · escaneo completo costoso', () => {
  it('sugiere un índice con las columnas del Filter', () => {
    const [finding] = findingsOf(analysisOf(plans.seqScan), 'seq-scan');
    expect(finding).toMatchObject({
      severity: 'alert',
      nodeId: 0,
      data: { table: 'orders', removedRows: 1_499_986, keptRows: 14, columns: 'o_custkey' },
      sql: ['CREATE INDEX ON orders (o_custkey);'],
    });
  });

  it('usa varias columnas y respeta el alias de la tabla', () => {
    expect(findingsOf(analysisOf(plans.customerStats), 'seq-scan')[0]?.sql).toEqual(['CREATE INDEX ON customer (c_nationkey, c_mktsegment);']);
    expect(findingsOf(analysisOf(plans.hashSort), 'seq-scan')[0]?.sql).toEqual(['CREATE INDEX ON lineitem (l_shipdate);']);
  });

  it('ordena el índice: primero las igualdades, después un solo rango', () => {
    // Como la subconsulta de TPC-H Q20: el filtro trae primero el rango de fechas
    const plan = [
      'Seq Scan on lineitem  (cost=0.00..19000.00 rows=1 width=8) (actual time=0.010..60.000 rows=1 loops=1)',
      "  Filter: ((l_shipdate >= '1994-01-01'::date) AND (l_shipdate < '1995-01-01'::date) AND (l_partkey = $1) AND (l_suppkey = $2))",
      '  Rows Removed by Filter: 600000',
      'Execution Time: 61.000 ms',
    ].join('\n');
    expect(findingsOf(analysisOf(plan), 'seq-scan')[0]?.sql).toEqual(['CREATE INDEX ON lineitem (l_partkey, l_suppkey, l_shipdate);']);
  });

  it('no usa columnas que solo se comparan con otra columna de la misma tabla', () => {
    // Como TPC-H Q12: l_commitdate < l_receiptdate no sirve para un índice
    const plan = [
      'Seq Scan on lineitem  (cost=0.00..19000.00 rows=10 width=8) (actual time=0.010..60.000 rows=10 loops=1)',
      "  Filter: ((l_shipmode = ANY ('{MAIL,SHIP}'::bpchar[])) AND (l_commitdate < l_receiptdate) AND (l_shipdate < l_commitdate) AND (l_receiptdate >= '1994-01-01'::date))",
      '  Rows Removed by Filter: 600000',
      'Execution Time: 61.000 ms',
    ].join('\n');
    expect(findingsOf(analysisOf(plan), 'seq-scan')[0]?.sql).toEqual(['CREATE INDEX ON lineitem (l_shipmode, l_receiptdate);']);
  });

  it('no sugiere un índice normal si la columna va dentro de una función', () => {
    const [finding] = findingsOf(analysisOf(plans.dateFilter), 'seq-scan');
    expect(finding?.severity).toBe('alert');
    expect(finding?.sql).toEqual([]);
  });

  it('no salta si descarta menos del 90 %', () => {
    expect(findingsOf(analysisOf(scan({ kept: 1101, removed: 9899 })), 'seq-scan')).toEqual([]);
    expect(findingsOf(analysisOf(scan({ kept: 1000, removed: 9000 })), 'seq-scan')).toHaveLength(1);
  });

  it('no salta si descarta menos de 1.000 filas en total', () => {
    expect(findingsOf(analysisOf(scan({ kept: 10, removed: 999 })), 'seq-scan')).toEqual([]);
    expect(findingsOf(analysisOf(scan({ kept: 10, removed: 500, loops: 2 })), 'seq-scan')).toHaveLength(1);
  });

  it('no salta si el nodo pesa menos del 20 % del tiempo', () => {
    expect(findingsOf(analysisOf(scan({ ms: 19, totalMs: 100 })), 'seq-scan')).toEqual([]);
    expect(findingsOf(analysisOf(scan({ ms: 20, totalMs: 100 })), 'seq-scan')).toHaveLength(1);
  });

  it('no repite lo que ya explica la regla del Nested Loop', () => {
    expect(findingsOf(analysisOf(plans.nestedLoop), 'seq-scan')).toEqual([]);
  });
});
