import { describe, expect, it } from 'vitest';
import { analysisOf, findingsOf, plans } from '../fixtures';

const scan = (hit: number, read: number) =>
  [
    'Seq Scan on lineitem  (cost=0.00..100.00 rows=1000 width=8) (actual time=0.010..50.000 rows=1000 loops=1)',
    `  Buffers: shared hit=${hit} read=${read}`,
    'Execution Time: 51.000 ms',
  ].join('\n');

describe('regla 7 · mucha lectura desde disco', () => {
  it('salta con ≥ 10.000 bloques leídos y ≥ 10× lo encontrado en memoria', () => {
    expect(findingsOf(analysisOf(plans.seqScan), 'disk-reads')).toMatchObject([
      { severity: 'warning', nodeId: 0, data: { table: 'orders', readBlocks: 23028, hitBlocks: 2048 }, sql: [] },
    ]);
    expect(findingsOf(analysisOf(scan(1000, 10_000)), 'disk-reads')).toHaveLength(1);
    expect(findingsOf(analysisOf(scan(0, 9999)), 'disk-reads')).toEqual([]);
    expect(findingsOf(analysisOf(scan(1001, 10_000)), 'disk-reads')).toEqual([]);
  });

  it('cuenta solo lo leído por el propio nodo, no por sus hijos', () => {
    // El Sort y el Hash Join repiten los 111.420 bloques de abajo; quien los lee es lineitem
    expect(findingsOf(analysisOf(plans.hashSort), 'disk-reads').map((finding) => finding.nodeId)).toEqual([2]);
  });

  it('no salta sin BUFFERS', () => {
    expect(findingsOf(analysisOf(plans.subplans), 'disk-reads')).toEqual([]);
  });
});
