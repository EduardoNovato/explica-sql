import type { Buffers, PlanNode } from '../types';

export function emptyNode(id: number, label: string): PlanNode {
  return {
    id,
    children: [],
    depth: 0,
    type: label,
    label,
    parallel: false,
    neverExecuted: false,
    details: [],
    inclusiveMs: 0,
    selfMs: 0,
    selfShare: 0,
  };
}

export function emptyBuffers(): Buffers {
  return {
    sharedHit: 0,
    sharedRead: 0,
    sharedDirtied: 0,
    sharedWritten: 0,
    localHit: 0,
    localRead: 0,
    tempRead: 0,
    tempWritten: 0,
  };
}

const JOIN_TYPES = 'Left|Right|Full|Semi|Anti|Right Semi|Right Anti';
const NESTED_LOOP = new RegExp(`^Nested Loop(?: (${JOIN_TYPES}) Join)?$`);
const HASH_OR_MERGE_JOIN = new RegExp(`^(Hash|Merge)(?: (${JOIN_TYPES}))? Join$`);

/**
 * Separa el encabezado de texto de un nodo en tipo, relación, alias e índice.
 * `Parallel Index Scan Backward using idx on public.pedidos p` → tipo `Index Scan`, índice `idx`,
 * relación `public.pedidos`, alias `p`.
 */
export function describeLabel(label: string): Pick<PlanNode, 'type' | 'parallel' | 'joinType' | 'relation' | 'alias' | 'index'> {
  let rest = label;
  const parallel = rest.startsWith('Parallel ');
  if (parallel) rest = rest.slice('Parallel '.length);
  rest = rest.replace(/^(?:Partial|Finalize|Async) /, '');

  const nestedLoop = NESTED_LOOP.exec(rest);
  if (nestedLoop) return { type: 'Nested Loop', parallel, joinType: nestedLoop[1] };
  const join = HASH_OR_MERGE_JOIN.exec(rest);
  if (join) return { type: `${join[1]} Join`, parallel, joinType: join[2] };

  const indexScan = /^(.+?)(?: Backward)? using (\S+) on (\S+)(?: (\S+))?$/.exec(rest);
  if (indexScan) {
    return { type: indexScan[1] ?? rest, parallel, index: indexScan[2], relation: indexScan[3], alias: indexScan[4] };
  }
  const bitmapIndex = /^Bitmap Index Scan on (\S+)$/.exec(rest);
  if (bitmapIndex) return { type: 'Bitmap Index Scan', parallel, index: bitmapIndex[1] };

  const scan = /^(.+?) on (\S+)(?: (\S+))?$/.exec(rest);
  if (scan) return { type: scan[1] ?? rest, parallel, relation: scan[2], alias: scan[3] };

  return { type: rest, parallel };
}

/** `shared hit=24408 read=10, temp read=332 written=332` */
export function parseBuffers(text: string): Buffers {
  const buffers = emptyBuffers();
  for (const group of text.split(',')) {
    const [scope, ...pairs] = group.trim().split(/\s+/);
    for (const pair of pairs) {
      const [key, value] = pair.split('=');
      const count = Number(value);
      if (!Number.isFinite(count)) continue;
      if (scope === 'shared' && key === 'hit') buffers.sharedHit = count;
      else if (scope === 'shared' && key === 'read') buffers.sharedRead = count;
      else if (scope === 'shared' && key === 'dirtied') buffers.sharedDirtied = count;
      else if (scope === 'shared' && key === 'written') buffers.sharedWritten = count;
      else if (scope === 'local' && key === 'hit') buffers.localHit = count;
      else if (scope === 'local' && key === 'read') buffers.localRead = count;
      else if (scope === 'temp' && key === 'read') buffers.tempRead = count;
      else if (scope === 'temp' && key === 'written') buffers.tempWritten = count;
    }
  }
  return buffers;
}

/** Separa por comas que no estén dentro de paréntesis ni comillas: `a, lower(b, c)` → `a`, `lower(b, c)` */
export function splitTopLevel(text: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let quote: string | undefined;
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quote) {
      if (char === quote) quote = undefined;
    } else if (char === "'" || char === '"') quote = char;
    else if (char === '(') depth++;
    else if (char === ')') depth--;
    else if (char === ',' && depth === 0) {
      parts.push(text.slice(start, i).trim());
      start = i + 1;
    }
  }
  parts.push(text.slice(start).trim());
  return parts.filter((part) => part !== '');
}
