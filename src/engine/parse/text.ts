import type { ParseResult, PlanNode } from '../types';
import { describeLabel, emptyNode, parseBuffers, splitTopLevel } from './node';

const NUM = String.raw`\d+(?:\.\d+)?`;
const COST = String.raw`\(cost=(${NUM})\.\.(${NUM}) rows=(${NUM}) width=(\d+)\)`;
const ACTUAL = String.raw`\((?:actual (?:time=(${NUM})\.\.(${NUM}) )?rows=(${NUM}) loops=(\d+)|(never executed))\)`;
const NODE_LINE = new RegExp(String.raw`^(.+?)(?:\s+${COST})?(?:\s+${ACTUAL})?$`);

const SUMMARY_TIME = /^(Planning|Execution) [Tt]ime: (\d+(?:\.\d+)?) ms$/;
const TOTAL_RUNTIME = /^Total runtime: (\d+(?:\.\d+)?) ms$/;
const SUBPLAN = /^(?:InitPlan|SubPlan|CTE)\b/;

/** Tipos que pueden ir como raíz sin `(cost=…)`, por ejemplo con `COSTS OFF` y sin `ANALYZE` */
const BARE_ROOT = /^(?:Parallel |Partial |Finalize )?(?:[A-Z][A-Za-z]*)(?: [A-Z][A-Za-z]*)*(?: (?:on|using) .+)?$/;

/** Plan en texto, el formato por defecto de EXPLAIN (el que se copia de DBeaver, pgAdmin o psql) */
export function parseTextPlan(lines: string[]): ParseResult {
  const nodes: PlanNode[] = [];
  const stack: { indent: number; id: number }[] = [];
  let rootIndent = -1;
  let summary = false;
  let pendingSubplan: string | undefined;
  let planningMs: number | undefined;
  let executionMs: number | undefined;

  for (const line of lines) {
    const text = line.trim();
    const indent = line.length - line.trimStart().length;

    const time = SUMMARY_TIME.exec(text);
    if (time) {
      if (time[1] === 'Planning') planningMs = Number(time[2]);
      else executionMs = Number(time[2]);
      if (nodes.length > 0) summary = true;
      continue;
    }
    const runtime = TOTAL_RUNTIME.exec(text);
    if (runtime) {
      executionMs = Number(runtime[1]);
      if (nodes.length > 0) summary = true;
      continue;
    }
    // Después del árbol solo vienen secciones de resumen: Planning:, JIT:, Triggers, Settings…
    if (summary) continue;

    const isArrow = text.startsWith('->');
    if (isArrow || nodes.length === 0) {
      const content = isArrow ? text.replace(/^->\s*/, '') : text;
      const node = parseNodeLine(content, nodes.length);
      if (!node || (!isArrow && !node.estimate && !node.actual && !node.neverExecuted && !BARE_ROOT.test(content))) {
        continue; // texto suelto antes de la raíz
      }
      while (stack.length > 0 && (stack[stack.length - 1]?.indent ?? 0) >= indent) stack.pop();
      const parent = stack[stack.length - 1];
      if (nodes.length > 0 && !parent) return { ok: false, error: 'no-indentation' };
      if (parent) {
        node.parentId = parent.id;
        node.depth = stack.length;
        nodes[parent.id]?.children.push(node.id);
        if (pendingSubplan) node.subplan = pendingSubplan;
      } else {
        rootIndent = indent;
      }
      pendingSubplan = undefined;
      nodes.push(node);
      stack.push({ indent, id: node.id });
      continue;
    }

    if (indent <= rootIndent) {
      summary = true;
      continue;
    }
    if (SUBPLAN.test(text)) {
      pendingSubplan = text;
      continue;
    }
    const current = nodes[nodes.length - 1];
    if (current) applyDetail(current, text);
  }

  if (nodes.length === 0) return { ok: false, error: 'not-a-plan' };
  return { ok: true, plan: { format: 'text', nodes, planningMs, executionMs } };
}

function parseNodeLine(content: string, id: number): PlanNode | undefined {
  const match = NODE_LINE.exec(content);
  if (!match) return undefined;
  const [, label = content, startupCost, totalCost, rows, width, startupMs, totalMs, actualRows, loops, never] = match;
  const node = emptyNode(id, label);
  Object.assign(node, describeLabel(label));
  if (totalCost !== undefined) {
    node.estimate = {
      startupCost: Number(startupCost),
      totalCost: Number(totalCost),
      rows: Number(rows),
      width: Number(width),
    };
  }
  if (never) {
    node.neverExecuted = true;
    node.actual = { rows: 0, loops: 0 };
  } else if (actualRows !== undefined) {
    node.actual = {
      startupMs: startupMs === undefined ? undefined : Number(startupMs),
      totalMs: totalMs === undefined ? undefined : Number(totalMs),
      rows: Number(actualRows),
      loops: Number(loops),
    };
  }
  return node;
}

const CONDITIONS = {
  Filter: 'filter',
  'Index Cond': 'indexCond',
  'Recheck Cond': 'recheckCond',
  'Hash Cond': 'hashCond',
  'Merge Cond': 'mergeCond',
  'Join Filter': 'joinFilter',
} as const;

const REMOVED = {
  'Rows Removed by Filter': 'rowsRemovedByFilter',
  'Rows Removed by Join Filter': 'rowsRemovedByJoinFilter',
  'Rows Removed by Index Recheck': 'rowsRemovedByIndexRecheck',
} as const;

function applyDetail(node: PlanNode, text: string) {
  node.details.push(text);
  const separator = text.indexOf(': ');
  const key = separator === -1 ? text : text.slice(0, separator);
  const value = separator === -1 ? '' : text.slice(separator + 2).trim();

  if (Object.hasOwn(CONDITIONS, key)) node[CONDITIONS[key as keyof typeof CONDITIONS]] = value;
  else if (Object.hasOwn(REMOVED, key)) node[REMOVED[key as keyof typeof REMOVED]] = Number(value);
  else if (key === 'Sort Key') node.sortKey = splitTopLevel(value);
  else if (key === 'Buffers') node.buffers = parseBuffers(value);
  else if (key === 'Workers Planned') node.workersPlanned = Number(value);
  else if (key === 'Workers Launched') node.workersLaunched = Number(value);

  // Líneas con varios datos: "Sort Method: external merge  Disk: 2656kB",
  // "Worker 0:  Sort Method: …", "Buckets: 1024  Batches: 4 (originally 1)  Memory Usage: 3585kB"
  const sortMethod = /Sort Method: (.+?)(?:\s{2}|$)/.exec(text);
  if (sortMethod && !key.startsWith('Worker')) node.sortMethod = sortMethod[1];
  const sortDisk = /\b(?:Peak )?Disk: (\d+)kB/.exec(text);
  if (sortMethod && sortDisk) node.sortDiskKb = Math.max(node.sortDiskKb ?? 0, Number(sortDisk[1]));

  const batches = /\bBatches: (\d+)(?: \(originally (\d+)\))?/.exec(text);
  if (batches) {
    node.hashBatches = Number(batches[1]);
    if (batches[2] !== undefined) node.hashOriginalBatches = Number(batches[2]);
  }
  const memory = /\bMemory Usage: (\d+)kB/.exec(text);
  if (memory) node.memoryKb = Number(memory[1]);
  const disk = /\bDisk Usage: (\d+)kB/.exec(text);
  if (disk) node.diskKb = Number(disk[1]);
}
