import type { Rule } from '../types';
import { castInFilterRule } from './cast-in-filter';
import { diskReadsRule } from './disk-reads';
import { dominantNodeRule } from './dominant-node';
import { hashBatchesRule } from './hash-batches';
import { misestimateRule } from './misestimate';
import { nestedLoopRule } from './nested-loop';
import { seqScanRule } from './seq-scan';
import { sortDiskRule } from './sort-disk';

/** En este orden se desempatan los hallazgos de igual severidad e impacto */
export const rules: Rule[] = [
  dominantNodeRule,
  seqScanRule,
  nestedLoopRule,
  sortDiskRule,
  hashBatchesRule,
  castInFilterRule,
  misestimateRule,
  diskReadsRule,
];
