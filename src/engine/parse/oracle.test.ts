import { describe, expect, it } from 'vitest';
import { plans } from '../fixtures';
import type { PlanNode } from '../types';
import { parsePlan } from './index';

function nodesOf(input: string): PlanNode[] {
  const result = parsePlan(input);
  if (!result.ok) throw new Error(result.error);
  return result.plan.nodes;
}

describe('lector de Oracle (DBMS_XPLAN)', () => {
  it('detecta el formato solo y lee la tabla del plan', () => {
    const result = parsePlan(plans.oracleFullScan);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.plan).toMatchObject({ dialect: 'oracle', executionMs: 190, timeResolutionMs: 10 });
    expect(result.plan.nodes[1]).toMatchObject({
      type: 'TABLE ACCESS FULL',
      kind: 'full-scan',
      label: 'TABLE ACCESS FULL · ORDERS',
      relation: 'ORDERS',
      filter: '"O_CUSTKEY"=74221',
      estimate: { rows: 15 },
      actual: { rows: 14, loops: 1, totalMs: 190 },
      buffers: { sharedHit: 2048, sharedRead: 23028 },
    });
    // El alias es el mismo nombre de la tabla: no se guarda
    expect(result.plan.nodes[1]?.alias).toBeUndefined();
  });

  it('arma el árbol por la sangría de Operation', () => {
    expect(nodesOf(plans.oracleHashSort).map((node) => [node.type, node.kind, node.parentId, node.depth])).toEqual([
      ['SELECT STATEMENT', 'statement', undefined, 0],
      ['SORT ORDER BY', 'sort', 0, 1],
      ['HASH JOIN', 'hash-join', 1, 2],
      ['TABLE ACCESS FULL', 'full-scan', 2, 3],
      ['TABLE ACCESS FULL', 'full-scan', 2, 3],
    ]);
  });

  it('pasa A-Rows y A-Time (totales de todas las ejecuciones) a valores por vuelta', () => {
    const inner = nodesOf(plans.oracleNestedLoop)[3];
    expect(inner).toMatchObject({ actual: { rows: 1, loops: 2000 }, estimate: { rows: 1 }, alias: 'P' });
    expect(inner?.actual?.totalMs).toBeCloseTo(1520 / 2000);
  });

  it('entiende los sufijos K y M, la memoria y el espacio temporal', () => {
    const [, sort, hash] = nodesOf(plans.oracleHashSort);
    expect(sort).toMatchObject({ estimate: { rows: 600_000 }, actual: { rows: 541_000 }, sortDiskKb: 22528, memoryKb: 25 * 1024 });
    expect(hash).toMatchObject({ diskKb: 80896, memoryKb: 43 * 1024, hashCond: '"O"."O_ORDERKEY"="L"."L_ORDERKEY"' });
    expect(hash?.details).toContain('Used-Tmp: 80896');
  });

  it('une los predicados que Oracle parte en varias líneas', () => {
    expect(nodesOf(plans.oracleHashSort)[4]?.filter).toBe(
      `"L"."L_SHIPDATE">=TO_DATE(' 1998-06-01 00:00:00', 'syyyy-mm-dd hh24:mi:ss')`,
    );
  });

  it('acepta la copia de DBeaver con el encabezado PLAN_TABLE_OUTPUT', () => {
    expect(nodesOf(plans.oracleDbeaverPartial).map((node) => node.label)).toEqual(['SELECT STATEMENT', 'TABLE ACCESS FULL · LINEITEM']);
  });

  it('lee planes de EXPLAIN PLAN, solo con estimaciones', () => {
    const result = parsePlan(plans.oracleEstimates);
    expect(result.ok && result.plan.nodes[1]).toMatchObject({ estimate: { rows: 15, totalCost: 6833 } });
    expect(result.ok && result.plan.nodes[1]?.actual).toBeUndefined();
  });

  it('lee la sección Note', () => {
    const noStats = parsePlan(plans.oracleNoStats);
    expect(noStats.ok && noStats.plan.oracle).toEqual({ noRuntimeStats: true, dynamicSampling: false });
    const sampling = parsePlan(plans.oracleImplicitConversion);
    expect(sampling.ok && sampling.plan.oracle).toEqual({ noRuntimeStats: false, dynamicSampling: true });
  });

  it('marca como no ejecutados los pasos con Starts 0', () => {
    expect(nodesOf(plans.oracleParallel)[3]).toMatchObject({ type: 'PX SEND QC (RANDOM)', neverExecuted: true, parallel: true });
  });

  it('acepta solo la tabla, sin las demás secciones', () => {
    const table = [
      '| Id  | Operation         | Name   | Starts | E-Rows | A-Rows |   A-Time   | Buffers |',
      '|   0 | SELECT STATEMENT  |        |      1 |        |     14 |00:00:00.19 |   25076 |',
      '|   1 |  TABLE ACCESS FULL| ORDERS |      1 |     15 |     14 |00:00:00.19 |   25076 |',
    ].join('\n');
    expect(nodesOf(table).map((node) => node.kind)).toEqual(['statement', 'full-scan']);
  });
});
