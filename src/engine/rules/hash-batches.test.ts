import { describe, expect, it } from 'vitest';
import { analysisOf, findingsOf, plans } from '../fixtures';

describe('regla 4 · hash que no cabe en memoria', () => {
  it('salta en el Hash de un Hash Join con más de un lote', () => {
    // 2466 kB × 4 lotes = 9,6 MB → 16MB
    expect(findingsOf(analysisOf(plans.hashSort), 'hash-batches')).toMatchObject([
      {
        severity: 'alert',
        nodeId: 3,
        relatedNodeIds: [1],
        data: { batches: 4, memoryKb: 2466, workMem: '16MB' },
        sql: ["SET work_mem = '16MB';"],
      },
    ]);
  });

  it('salta en un HashAggregate que bajó a disco', () => {
    // 4145 kB en memoria + 13256 kB en disco = 17 MB → 32MB
    expect(findingsOf(analysisOf(plans.hashAggregate), 'hash-batches')).toMatchObject([
      { nodeId: 0, data: { batches: 5, diskKb: 13256, workMem: '32MB' }, sql: ["SET work_mem = '32MB';"] },
    ]);
  });

  it('no salta con un solo lote', () => {
    expect(findingsOf(analysisOf(plans.summarySections), 'hash-batches')).toEqual([]);
  });
});
