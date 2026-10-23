import { describe, expect, it } from 'vitest';
import { analysisOf, findingsOf, plans } from '../fixtures';
import { oracleSql } from '../sql';

/** TABLE ACCESS FULL de Oracle con los datos que mira la regla 1 */
const fullScan = ({ rows = 14, buffers = 25076, ms = 0.19, filter = true }) =>
  [
    '| Id  | Operation         | Name   | Starts | E-Rows | A-Rows |   A-Time   | Buffers | Reads  |',
    `|   0 | SELECT STATEMENT  |        |      1 |        | ${rows} |00:00:00.19 | ${buffers} |      0 |`,
    `|*  1 |  TABLE ACCESS FULL| ORDERS |      1 | ${rows} | ${rows} |00:00:${ms.toFixed(2).padStart(5, '0')} | ${buffers} |      0 |`,
    '',
    'Predicate Information (identified by operation id):',
    '',
    filter ? '   1 - filter("O_CUSTKEY"=74221)' : '',
  ].join('\n');

describe('reglas con planes de Oracle', () => {
  it('regla 1: lee muchos bloques para muy pocas filas; sugiere un índice con nombre', () => {
    expect(findingsOf(analysisOf(plans.oracleFullScan), 'seq-scan')).toMatchObject([
      {
        severity: 'alert',
        data: { table: 'ORDERS', blocks: 25076, keptRows: 14, columns: 'O_CUSTKEY' },
        sql: ['CREATE INDEX ORDERS_O_CUSTKEY_IX ON ORDERS (O_CUSTKEY);'],
      },
    ]);
  });

  it('regla 1: no salta sin filtro, con pocos bloques o si devuelve una fila cada dos bloques o más', () => {
    expect(findingsOf(analysisOf(fullScan({ filter: false })), 'seq-scan')).toEqual([]);
    expect(findingsOf(analysisOf(fullScan({ buffers: 999, rows: 1 })), 'seq-scan')).toEqual([]);
    expect(findingsOf(analysisOf(fullScan({ buffers: 1000, rows: 501 })), 'seq-scan')).toEqual([]);
    expect(findingsOf(analysisOf(fullScan({ buffers: 1000, rows: 500 })), 'seq-scan')).toHaveLength(1);
  });

  it('regla 1: el LINEITEM de TPC-H que devuelve 5 filas por bloque no es una falsa alarma', () => {
    expect(findingsOf(analysisOf(plans.oracleHashSort), 'seq-scan')).toEqual([]);
  });

  it('regla 3 y 4: SORT y HASH JOIN con Used-Tmp, sin sugerir memoria por sesión', () => {
    const analysis = analysisOf(plans.oracleHashSort);
    expect(findingsOf(analysis, 'sort-disk')).toMatchObject([{ nodeId: 1, data: { diskKb: 22528, workMem: '' }, sql: [] }]);
    expect(findingsOf(analysis, 'hash-batches')).toMatchObject([{ nodeId: 2, data: { diskKb: 80896, workMem: '' }, sql: [] }]);
  });

  it('regla 5: NESTED LOOPS con un TABLE ACCESS FULL interno que se repite 2.000 veces', () => {
    expect(findingsOf(analysisOf(plans.oracleNestedLoop), 'nested-loop')).toMatchObject([
      { nodeId: 3, relatedNodeIds: [1], data: { table: 'PEDIDOS', loops: 2000, columns: 'CLIENTE_ID' }, sql: ['CREATE INDEX PEDIDOS_CLIENTE_ID_IX ON PEDIDOS (CLIENTE_ID);'] },
    ]);
  });

  it('regla 6: una conversión implícita (TO_NUMBER) en un escaneo costoso es alerta con índice de función', () => {
    const analysis = analysisOf(plans.oracleImplicitConversion);
    expect(findingsOf(analysis, 'cast-in-filter')).toMatchObject([
      { severity: 'alert', data: { expressions: 'TO_NUMBER("NUMERO")', costly: 1 }, sql: ['CREATE INDEX PEDIDOS_TO_NUMBER_NUMERO_FN_IX ON PEDIDOS (TO_NUMBER(NUMERO));'] },
    ]);
    // La columna va dentro de la función: la regla 1 no sugiere un índice normal
    expect(findingsOf(analysis, 'seq-scan')[0]?.sql).toEqual([]);
  });

  it('regla 7: Reads contra Buffers, solo en los pasos que leen tablas', () => {
    expect(findingsOf(analysisOf(plans.oracleFullScan), 'disk-reads')).toMatchObject([{ data: { readBlocks: 23028, hitBlocks: 2048 } }]);
    // El SORT relee su espacio temporal: eso ya lo dice la regla 3
    expect(findingsOf(analysisOf(plans.oracleHashSort), 'disk-reads').map((finding) => finding.nodeId)).toEqual([4]);
  });

  it('regla 2: compara E-Rows × Starts con A-Rows y sugiere DBMS_STATS', () => {
    const plan = [
      '| Id  | Operation          | Name     | Starts | E-Rows | A-Rows |   A-Time   | Buffers |',
      '|   0 | SELECT STATEMENT   |          |      1 |        |   6020 |00:00:00.04 |    3600 |',
      '|*  1 |  TABLE ACCESS FULL | CUSTOMER |      1 |     12 |   6020 |00:00:00.04 |    3600 |',
      '',
      'Predicate Information (identified by operation id):',
      '',
      `   1 - filter(("C_NATIONKEY"=7 AND "C_MKTSEGMENT"='BUILDING'))`,
    ].join('\n');
    expect(findingsOf(analysisOf(plan), 'misestimate')).toMatchObject([
      {
        data: { estimatedRows: 12, actualRows: 6020 },
        sql: [
          "SELECT DBMS_STATS.CREATE_EXTENDED_STATS(USER, 'CUSTOMER', '(C_NATIONKEY, C_MKTSEGMENT)') FROM dual;",
          "BEGIN DBMS_STATS.GATHER_TABLE_STATS(USER, 'CUSTOMER'); END;",
        ],
      },
    ]);
  });

  it('regla 2: no compara bajo PX, donde E-Rows no es por ejecución', () => {
    expect(findingsOf(analysisOf(plans.oracleParallel), 'misestimate')).toEqual([]);
  });

  it('veredicto: A-Time va de 10 en 10 ms, así que 00:00:00.01 cuenta como rápida', () => {
    const analysis = analysisOf(plans.oracleControl);
    expect(analysis).toMatchObject({ dialect: 'oracle', verdict: 'fast', totalMs: 10, timeResolutionMs: 10, findings: [], notices: [] });
  });

  it('métricas: bloques leídos en lugar de filas leídas', () => {
    expect(analysisOf(plans.oracleFullScan).metrics).toEqual({ slowestNodeId: 1, rowsRead: undefined, blocksRead: 25076, rowsReturned: 14 });
  });
});

describe('avisos de Oracle', () => {
  it.each([
    ['sin GATHER_PLAN_STATISTICS', plans.oracleNoStats, [{ id: 'oracle-no-stats', data: {} }]],
    ['de EXPLAIN PLAN', plans.oracleEstimates, [{ id: 'oracle-no-stats', data: {} }]],
    ['con dynamic sampling', plans.oracleImplicitConversion, [{ id: 'oracle-dynamic-sampling', data: {} }]],
    ['en paralelo', plans.oracleParallel, [{ id: 'oracle-parallel', data: {} }]],
    ['con solo la primera página de filas (DBeaver)', plans.oracleDbeaverPartial, [{ id: 'oracle-partial-fetch', data: { rows: 200 } }]],
  ])('plan %s', (_name, plan, notices) => {
    expect(analysisOf(plan).notices).toEqual(notices);
  });

  it('sin estadísticas reales no hay veredicto ni hallazgos de tiempo', () => {
    const analysis = analysisOf(plans.oracleNoStats);
    expect(analysis.hasAnalyze).toBe(false);
    expect(analysis.verdict).toBeUndefined();
    expect(analysis.findings).toEqual([]);
  });
});

describe('SQL de Oracle', () => {
  it('nombra los índices con hasta 30 caracteres y sin comillas', () => {
    const sql = oracleSql.createIndex('ORDERS_HISTORICOS_DEL_SISTEMA', ['O_CUSTKEY', 'O_ORDERDATE']);
    const name = /CREATE INDEX (\S+) ON/.exec(sql)?.[1] ?? '';
    expect(name.length).toBeLessThanOrEqual(30);
    expect(name.endsWith('_IX')).toBe(true);
    expect(oracleSql.cleanIdentifier('"O_CUSTKEY"')).toBe('O_CUSTKEY');
    expect(oracleSql.cleanIdentifier('"MiColumna"')).toBe('"MiColumna"');
    expect(oracleSql.setWorkMem('64MB')).toBeUndefined();
  });
});
