import { describe, expect, it } from 'vitest';
import { analysisOf, plans } from '../fixtures';
import { parsePlan } from './index';

describe('lector JSON', () => {
  it('detecta el formato JSON solo', () => {
    const result = parsePlan(plans.nestedLoopJson);
    expect(result.ok && result.plan.format).toBe('json');
  });

  it('da el mismo resultado que el mismo plan en texto', () => {
    const text = analysisOf(plans.nestedLoop);
    const json = analysisOf(plans.nestedLoopJson);
    const summary = (analysis: typeof text) => ({
      verdict: analysis.verdict,
      planningMs: analysis.planningMs,
      executionMs: analysis.executionMs,
      nodes: analysis.nodes.map((node) => [node.label, node.type, node.relation, node.alias, node.parentId, node.selfMs]),
      findings: analysis.findings.map((finding) => [finding.rule, finding.severity, finding.nodeId, finding.sql]),
      notices: analysis.notices.map((notice) => notice.id),
    });
    expect(summary(json)).toEqual(summary(text));
  });

  it('lee el JSON que psql muestra con "+" al final de cada línea', () => {
    const psql = [' QUERY PLAN ', '-----------', ...plans.nestedLoopJson.trimEnd().split('\n').map((line) => ` ${line} +`), '(1 row)'].join('\n');
    expect(analysisOf(psql).findings.map((finding) => finding.rule)).toEqual(['dominant-node', 'nested-loop']);
  });

  it('lee el JSON que pgAdmin copia entre comillas', () => {
    const pgadmin = `"${plans.nestedLoopJson.trim().replace(/"/g, '""')}"`;
    expect(analysisOf(pgadmin).nodes).toHaveLength(3);
  });

  it('acepta solo el objeto "Plan" sin la lista de afuera', () => {
    const result = parsePlan('{"Node Type": "Seq Scan", "Relation Name": "pedidos", "Alias": "pedidos", "Total Cost": 1.08, "Plan Rows": 8}');
    const node = result.ok ? result.plan.nodes[0] : undefined;
    expect(node).toMatchObject({ type: 'Seq Scan', relation: 'pedidos', label: 'Seq Scan on pedidos' });
    expect(node?.alias).toBeUndefined();
  });

  it('traduce los nombres del JSON a los del formato texto', () => {
    const result = parsePlan(
      JSON.stringify([
        {
          Plan: {
            'Node Type': 'Aggregate',
            Strategy: 'Hashed',
            'Partial Mode': 'Finalize',
            'HashAgg Batches': 5,
            'Peak Memory Usage': 4145,
            'Disk Usage': 13256,
            Plans: [
              {
                'Node Type': 'Sort',
                'Sort Key': ['total DESC'],
                'Sort Method': 'external merge',
                'Sort Space Used': 900,
                'Sort Space Type': 'Disk',
                Workers: [{ 'Worker Number': 0, 'Sort Method': 'external merge', 'Sort Space Used': 1272, 'Sort Space Type': 'Disk' }],
              },
              { 'Node Type': 'Hash Join', 'Join Type': 'Left', 'Parallel Aware': true },
              { 'Node Type': 'Index Scan', 'Scan Direction': 'Backward', 'Index Name': 'idx', 'Relation Name': 'pedidos', Alias: 'p' },
            ],
          },
        },
      ]),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.plan.nodes.map((node) => [node.type, node.label])).toEqual([
      ['HashAggregate', 'Finalize HashAggregate'],
      ['Sort', 'Sort'],
      ['Hash Join', 'Parallel Hash Left Join'],
      ['Index Scan', 'Index Scan Backward using idx on pedidos p'],
    ]);
    expect(result.plan.nodes[0]).toMatchObject({ hashBatches: 5, memoryKb: 4145, diskKb: 13256 });
    expect(result.plan.nodes[1]).toMatchObject({ sortKey: ['total DESC'], sortDiskKb: 1272 });
    expect(result.plan.nodes[2]).toMatchObject({ joinType: 'Left', parallel: true });
  });

  it('reporta un JSON roto o que no es un plan', () => {
    expect(parsePlan('[{"Plan": {"Node Type": ')).toEqual({ ok: false, error: 'invalid-json' });
    expect(parsePlan('{"hola": 1}')).toEqual({ ok: false, error: 'not-a-plan' });
  });
});
