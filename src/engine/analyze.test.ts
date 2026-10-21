import { describe, expect, it } from 'vitest';
import { analysisOf, plans } from './fixtures';
import { analyze, RULES_VERSION } from './index';

describe('caso de control: Seq Scan de 8 filas en 0,032 ms', () => {
  it.each([
    ['DBeaver', plans.control],
    ['psql', plans.controlPsql],
    ['pgAdmin', plans.controlPgadmin],
    ['vista de texto de DBeaver', plans.controlDbeaverText],
  ])('desde %s da "rápida", sin alertas y solo la nota de la regla 6', (_source, input) => {
    const analysis = analysisOf(input);
    expect(analysis.verdict).toBe('fast');
    expect(analysis.executionMs).toBe(0.032);
    expect(analysis.findings.map((finding) => [finding.rule, finding.severity])).toEqual([['cast-in-filter', 'note']]);
    expect(analysis.notices).toEqual([]);
  });
});

describe('consulta con un Result dominante, ordenamiento en disco y estimación errada', () => {
  const analysis = analysisOf(plans.resultDominant);

  it('da el veredicto y las métricas de arriba', () => {
    expect(analysis).toMatchObject({
      format: 'text',
      rulesVersion: RULES_VERSION,
      verdict: 'slow',
      planningMs: 0.104,
      executionMs: 143.512,
      hasAnalyze: true,
      hasBuffers: true,
      metrics: { slowestNodeId: 0, rowsRead: 3870, rowsReturned: 3870 },
    });
  });

  it('ordena los hallazgos por severidad y luego por impacto', () => {
    expect(analysis.findings.map((finding) => [finding.severity, finding.rule, finding.nodeId])).toEqual([
      ['alert', 'dominant-node', 0],
      ['alert', 'sort-disk', 1],
      ['warning', 'misestimate', 2],
      ['note', 'cast-in-filter', 2],
    ]);
  });
});

describe('orden y severidad', () => {
  it('en una consulta lenta con varios problemas, el nodo dominante va primero', () => {
    expect(analysisOf(plans.hashSort).findings.map((finding) => [finding.severity, finding.rule])).toEqual([
      ['alert', 'dominant-node'],
      ['alert', 'seq-scan'],
      ['alert', 'hash-batches'],
      ['alert', 'sort-disk'],
      ['warning', 'disk-reads'],
    ]);
  });

  it('una consulta rápida convierte cualquier hallazgo en nota', () => {
    const fast = [
      'Sort  (cost=1.00..2.00 rows=10 width=8) (actual time=3.000..4.000 rows=10 loops=1)',
      '  Sort Key: total',
      '  Sort Method: external merge  Disk: 100kB',
      '  ->  Seq Scan on pedidos  (cost=0.00..1.00 rows=10 width=8) (actual time=0.010..1.000 rows=10 loops=1)',
      '  Buffers: shared hit=1',
      'Execution Time: 4.200 ms',
    ].join('\n');
    expect(analysisOf(fast).findings.map((finding) => [finding.rule, finding.severity])).toEqual([['sort-disk', 'note']]);
  });
});

describe('errores de lectura', () => {
  it('devuelve el código de error en vez de lanzar una excepción', () => {
    expect(analyze('')).toEqual({ ok: false, error: 'empty' });
    expect(analyze('hola')).toEqual({ ok: false, error: 'not-a-plan' });
  });
});
