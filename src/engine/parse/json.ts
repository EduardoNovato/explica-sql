import type { Buffers, ParseResult, PlanNode } from '../types';
import { emptyBuffers, emptyNode, postgresKind } from './node';

type Json = Record<string, unknown>;

const isObject = (value: unknown): value is Json => typeof value === 'object' && value !== null && !Array.isArray(value);
const num = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? value : undefined);
const str = (value: unknown) => (typeof value === 'string' && value !== '' ? value : undefined);

/** Plan en `EXPLAIN (FORMAT JSON)`: `[{ "Plan": {…}, "Planning Time": …, "Execution Time": … }]` */
export function parseJsonPlan(source: string): ParseResult {
  let data: unknown;
  try {
    data = JSON.parse(source);
  } catch {
    return { ok: false, error: 'invalid-json' };
  }
  const top = Array.isArray(data) ? data[0] : data;
  if (!isObject(top)) return { ok: false, error: 'not-a-plan' };
  const root = isObject(top.Plan) ? top.Plan : top;
  if (typeof root['Node Type'] !== 'string') return { ok: false, error: 'not-a-plan' };

  const nodes: PlanNode[] = [];
  const visit = (raw: Json, parent: PlanNode | undefined) => {
    const node = toNode(raw, nodes.length);
    if (parent) {
      node.parentId = parent.id;
      node.depth = parent.depth + 1;
      parent.children.push(node.id);
    }
    nodes.push(node);
    const plans = Array.isArray(raw.Plans) ? raw.Plans : [];
    for (const child of plans) if (isObject(child)) visit(child, node);
  };
  visit(root, undefined);

  return {
    ok: true,
    plan: {
      format: 'json',
      dialect: 'postgres',
      nodes,
      planningMs: num(top['Planning Time']),
      executionMs: num(top['Execution Time']) ?? num(top['Total Runtime']),
    },
  };
}

function toNode(raw: Json, id: number): PlanNode {
  const nodeType = str(raw['Node Type']) ?? '?';
  const strategy = str(raw.Strategy);
  const partialMode = str(raw['Partial Mode']);
  const joinType = str(raw['Join Type']);
  const parallel = raw['Parallel Aware'] === true;
  const relationName = str(raw['Relation Name']);
  const schema = str(raw.Schema);
  const alias = str(raw.Alias);
  const index = str(raw['Index Name']);

  let type = nodeType;
  if (nodeType === 'Aggregate' && strategy === 'Hashed') type = 'HashAggregate';
  else if (nodeType === 'Aggregate' && strategy === 'Sorted') type = 'GroupAggregate';
  else if (nodeType === 'Aggregate' && strategy === 'Mixed') type = 'MixedAggregate';
  else if (nodeType === 'ModifyTable') type = str(raw.Operation) ?? nodeType;

  const relation = relationName && schema ? `${schema}.${relationName}` : relationName;
  const label = buildLabel({
    type,
    parallel,
    partialMode,
    joinType,
    backward: raw['Scan Direction'] === 'Backward',
    index,
    target: relation ?? str(raw['CTE Name']) ?? str(raw['Function Name']) ?? (nodeType === 'Subquery Scan' ? alias : undefined),
    alias: alias && alias !== relationName && nodeType !== 'Subquery Scan' ? alias : undefined,
  });

  const node = emptyNode(id, label);
  node.type = type;
  node.kind = postgresKind(type);
  node.parallel = parallel;
  if (joinType && joinType !== 'Inner') node.joinType = joinType;
  node.relation = relation;
  if (relation && alias && alias !== relationName) node.alias = alias;
  node.index = index;
  node.subplan = str(raw['Subplan Name']);

  const totalCost = num(raw['Total Cost']);
  if (totalCost !== undefined) {
    node.estimate = {
      startupCost: num(raw['Startup Cost']) ?? 0,
      totalCost,
      rows: num(raw['Plan Rows']) ?? 0,
      width: num(raw['Plan Width']) ?? 0,
    };
  }
  const loops = num(raw['Actual Loops']);
  if (loops !== undefined) {
    node.neverExecuted = loops === 0;
    node.actual = {
      startupMs: num(raw['Actual Startup Time']),
      totalMs: num(raw['Actual Total Time']),
      rows: num(raw['Actual Rows']) ?? 0,
      loops,
    };
  }

  node.filter = str(raw.Filter);
  node.indexCond = str(raw['Index Cond']);
  node.recheckCond = str(raw['Recheck Cond']);
  node.hashCond = str(raw['Hash Cond']);
  node.mergeCond = str(raw['Merge Cond']);
  node.joinFilter = str(raw['Join Filter']);
  node.rowsRemovedByFilter = num(raw['Rows Removed by Filter']);
  node.rowsRemovedByJoinFilter = num(raw['Rows Removed by Join Filter']);
  node.rowsRemovedByIndexRecheck = num(raw['Rows Removed by Index Recheck']);

  if (Array.isArray(raw['Sort Key'])) node.sortKey = raw['Sort Key'].filter((key): key is string => typeof key === 'string');
  node.sortMethod = str(raw['Sort Method']);
  const sortDisk = [raw, ...(Array.isArray(raw.Workers) ? raw.Workers.filter(isObject) : [])]
    .map(sortDiskKb)
    .filter((kb): kb is number => kb !== undefined);
  if (sortDisk.length > 0) node.sortDiskKb = Math.max(...sortDisk);

  node.hashBatches = num(raw['Hash Batches']) ?? num(raw['HashAgg Batches']);
  node.hashOriginalBatches = num(raw['Original Hash Batches']);
  node.memoryKb = num(raw['Peak Memory Usage']);
  node.diskKb = num(raw['Disk Usage']);
  node.workersPlanned = num(raw['Workers Planned']);
  node.workersLaunched = num(raw['Workers Launched']);
  node.buffers = parseBuffers(raw);
  node.details = details(raw);
  return node;
}

function buildLabel(parts: {
  type: string;
  parallel: boolean;
  partialMode?: string;
  joinType?: string;
  backward: boolean;
  index?: string;
  target?: string;
  alias?: string;
}): string {
  let base = parts.type;
  const join = parts.joinType && parts.joinType !== 'Inner' ? parts.joinType : undefined;
  if (base === 'Nested Loop' && join) base = `Nested Loop ${join} Join`;
  else if ((base === 'Hash Join' || base === 'Merge Join') && join) base = base.replace(' Join', ` ${join} Join`);
  if (parts.backward) base += ' Backward';
  if (parts.partialMode && parts.partialMode !== 'Simple') base = `${parts.partialMode} ${base}`;
  if (parts.parallel) base = `Parallel ${base}`;
  if (parts.index && parts.type !== 'Bitmap Index Scan') base += ` using ${parts.index}`;
  if (parts.type === 'Bitmap Index Scan' && parts.index) base += ` on ${parts.index}`;
  else if (parts.target) base += ` on ${parts.target}`;
  if (parts.alias) base += ` ${parts.alias}`;
  return base;
}

/** Disco usado al ordenar, en el nodo o en un worker; también el de Incremental Sort */
function sortDiskKb(raw: Json): number | undefined {
  if (raw['Sort Space Type'] === 'Disk') return num(raw['Sort Space Used']);
  for (const groups of [raw['Full-sort Groups'], raw['Pre-sorted Groups']]) {
    if (isObject(groups) && isObject(groups['Sort Space Disk'])) return num(groups['Sort Space Disk']['Peak Sort Space Used']);
  }
  return undefined;
}

const BUFFER_KEYS: [keyof Buffers, string][] = [
  ['sharedHit', 'Shared Hit Blocks'],
  ['sharedRead', 'Shared Read Blocks'],
  ['sharedDirtied', 'Shared Dirtied Blocks'],
  ['sharedWritten', 'Shared Written Blocks'],
  ['localHit', 'Local Hit Blocks'],
  ['localRead', 'Local Read Blocks'],
  ['tempRead', 'Temp Read Blocks'],
  ['tempWritten', 'Temp Written Blocks'],
];

function parseBuffers(raw: Json): Buffers | undefined {
  if (num(raw['Shared Hit Blocks']) === undefined) return undefined;
  const buffers = emptyBuffers();
  for (const [key, name] of BUFFER_KEYS) buffers[key] = num(raw[name]) ?? 0;
  return buffers;
}

const DETAIL_KEYS = [
  'Filter',
  'Rows Removed by Filter',
  'Index Cond',
  'Rows Removed by Index Recheck',
  'Recheck Cond',
  'Hash Cond',
  'Merge Cond',
  'Join Filter',
  'Rows Removed by Join Filter',
  'Sort Key',
  'Sort Method',
  'Sort Space Used',
  'Sort Space Type',
  'Group Key',
  'Hash Batches',
  'Peak Memory Usage',
  'Disk Usage',
  'Workers Planned',
  'Workers Launched',
];

/** Detalles en el mismo estilo `Clave: valor` del formato texto, para el árbol */
function details(raw: Json): string[] {
  const lines: string[] = [];
  for (const key of DETAIL_KEYS) {
    const value = raw[key];
    if (value === undefined || value === null || value === '') continue;
    lines.push(`${key}: ${Array.isArray(value) ? value.join(', ') : String(value)}`);
  }
  return lines;
}
