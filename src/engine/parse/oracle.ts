import type { NodeKind, OracleNotes, ParseResult, PlanNode } from '../types';
import { emptyBuffers, emptyNode } from './node';

/**
 * Plan de Oracle en el texto de DBMS_XPLAN: la tabla `| Id | Operation | Name | …` y las secciones
 * de alias, predicados y notas. Sirve tanto con estadísticas reales (`DISPLAY_CURSOR` con
 * `ALLSTATS LAST`: Starts, E-Rows, A-Rows, A-Time, Buffers, Reads, Used-Tmp…) como con solo
 * estimaciones (`EXPLAIN PLAN` + `DISPLAY`: Rows, Bytes, Cost).
 *
 * En Oracle, A-Rows y A-Time son totales de todas las ejecuciones (Starts) y E-Rows es por ejecución;
 * aquí se pasan a "por vuelta", como en PostgreSQL, para que el resto del motor no cambie.
 */

const TABLE_HEADER = /^\|\s*Id\s*\|\s*Operation\s*\|/;

/** A-Time de Oracle solo tiene centésimas de segundo */
export const ORACLE_TIME_RESOLUTION_MS = 10;

export const isOraclePlan = (lines: string[]) => lines.some((line) => TABLE_HEADER.test(line.trim()));

/** Celdas entre barras, sin recortar (la sangría de Operation marca la jerarquía) */
function cells(line: string): string[] {
  const text = line.trim();
  const parts = (text.startsWith('|') ? text.slice(1) : text).split('|');
  if (parts.length > 0 && parts[parts.length - 1]?.trim() === '') parts.pop();
  return parts;
}

const SUFFIX = { K: 1, M: 2, G: 3, T: 4, P: 5 } as const;

/** Conteos con sufijo de Oracle: `440K` = 440.000 */
function parseCount(text: string | undefined): number | undefined {
  const match = /^(\d+(?:\.\d+)?)\s*([KMGTP])?$/.exec(text?.trim() ?? '');
  if (!match) return undefined;
  return Number(match[1]) * 1000 ** (match[2] ? SUFFIX[match[2] as keyof typeof SUFFIX] : 0);
}

/** Tamaños en kB. Las columnas de memoria vienen en bytes (`25M`); Used-Tmp, en kB */
function parseKb(text: string | undefined, unit: 'bytes' | 'kb'): number | undefined {
  const match = /^(\d+(?:\.\d+)?)\s*([KMGTP])?/.exec(text?.trim() ?? '');
  if (!match) return undefined;
  const value = Number(match[1]) * 1024 ** (match[2] ? SUFFIX[match[2] as keyof typeof SUFFIX] : 0);
  return unit === 'bytes' ? value / 1024 : value;
}

/** `00:00:03.32` → 3320 ms */
function parseTime(text: string | undefined): number | undefined {
  const match = /^(\d+):(\d+):(\d+(?:\.\d+)?)$/.exec(text?.trim() ?? '');
  if (!match) return undefined;
  return ((Number(match[1]) * 60 + Number(match[2])) * 60 + Number(match[3])) * 1000;
}

const JOIN_KINDS: NodeKind[] = ['nested-loop', 'hash-join', 'merge-join'];

function kindOf(operation: string): NodeKind {
  if (/^(TABLE|MAT_VIEW) ACCESS (STORAGE |INMEMORY )?FULL/.test(operation)) return 'full-scan';
  if (/^(TABLE|MAT_VIEW) ACCESS/.test(operation)) return 'table-access';
  if (/^INDEX\b|^BITMAP INDEX/.test(operation)) return 'index-scan';
  if (/^NESTED LOOPS/.test(operation)) return 'nested-loop';
  if (/^HASH JOIN/.test(operation)) return 'hash-join';
  if (/^MERGE JOIN/.test(operation)) return 'merge-join';
  if (/^HASH (GROUP BY|UNIQUE)/.test(operation)) return 'hash-aggregate';
  if (/^(SORT (ORDER BY|GROUP BY|UNIQUE|JOIN)|WINDOW SORT|BUFFER SORT)/.test(operation)) return 'sort';
  if (/^COUNT STOPKEY/.test(operation)) return 'limit';
  if (/^PX COORDINATOR/.test(operation)) return 'gather';
  if (/STATEMENT$/.test(operation)) return 'statement';
  return 'other';
}

function joinTypeOf(operation: string): string | undefined {
  const match = /\b(RIGHT SEMI|RIGHT ANTI|FULL OUTER|OUTER|SEMI|ANTI)\b/.exec(operation);
  return match?.[1] ? match[1].charAt(0) + match[1].slice(1).toLowerCase() : undefined;
}

/** Secciones que pueden venir después de la tabla */
const SECTION = /^(Query Block Name|Predicate Information|Column Projection Information|Note$|Hint Report|Outline Data|Remote SQL Information|Statement Information|Global Information|Plan Statistics)/;

function sectionLines(lines: string[], title: RegExp): string[] {
  const start = lines.findIndex((line) => title.test(line.trim()));
  if (start === -1) return [];
  const section: string[] = [];
  for (const line of lines.slice(start + 1)) {
    if (SECTION.test(line.trim())) break;
    section.push(line);
  }
  return section;
}

/** `   3 - access("O"."O_ORDERKEY"="L"."L_ORDERKEY")`, con líneas de continuación si es largo */
function readPredicates(lines: string[]): Map<number, { access: string[]; filter: string[] }> {
  const raw: { id: number; text: string }[] = [];
  for (const line of sectionLines(lines, /^Predicate Information/)) {
    const start = /^\s*(\d+)\s+-\s+(.*)$/.exec(line);
    if (start) raw.push({ id: Number(start[1]), text: (start[2] ?? '').trim() });
    else if (/^\s*(access|filter)\(/.test(line) && raw.length > 0) raw.push({ id: raw[raw.length - 1]?.id ?? 0, text: line.trim() });
    else if (line.trim() !== '' && raw.length > 0) {
      const last = raw[raw.length - 1];
      if (last) last.text += ` ${line.trim()}`;
    }
  }
  const predicates = new Map<number, { access: string[]; filter: string[] }>();
  for (const { id, text } of raw) {
    const match = /^(access|filter)\((.*)\)$/.exec(text);
    if (!match) continue;
    const entry = predicates.get(id) ?? { access: [], filter: [] };
    entry[match[1] as 'access' | 'filter'].push(match[2] ?? '');
    predicates.set(id, entry);
  }
  return predicates;
}

/** `   2 - SEL$1 / "O"@"SEL$1"` → alias O del paso 2 */
function readAliases(lines: string[]): Map<number, string> {
  const aliases = new Map<number, string>();
  for (const line of sectionLines(lines, /^Query Block Name/)) {
    const match = /^\s*(\d+)\s+-\s+\S+\s*\/\s*"?([^"@]+)"?@/.exec(line);
    if (match?.[2]) aliases.set(Number(match[1]), match[2]);
  }
  return aliases;
}

function readNotes(lines: string[]): OracleNotes {
  const text = sectionLines(lines, /^Note$/).join(' ');
  return {
    noRuntimeStats: /basic plan statistics not available/i.test(text),
    dynamicSampling: /dynamic (statistics|sampling) used/i.test(text),
  };
}

const conditions = (list: string[] | undefined) => (list && list.length > 0 ? list.join(' AND ') : undefined);

/** Columnas que no se muestran como datos del paso pero sí en "Detalles" */
const DETAIL_COLUMNS = ['Writes', 'OMem', '1Mem', 'Used-Mem', 'Used-Tmp', 'Max-Tmp', 'Pstart', 'Pstop', 'TQ', 'IN-OUT', 'PQ Distrib'];

export function parseOraclePlan(lines: string[]): ParseResult {
  const headerIndex = lines.findIndex((line) => TABLE_HEADER.test(line.trim()));
  if (headerIndex === -1) return { ok: false, error: 'not-a-plan' };
  const header = cells(lines[headerIndex] ?? '').map((cell) => cell.trim());
  const positions = new Map<string, number>();
  const column = (name: string) => {
    let index = positions.get(name);
    if (index === undefined) {
      index = header.findIndex((cell) => cell === name || cell.startsWith(`${name} `));
      positions.set(name, index);
    }
    return index;
  };

  const rows: string[][] = [];
  let end = headerIndex + 1;
  for (; end < lines.length; end++) {
    const line = lines[end] ?? '';
    if (!line.trim().startsWith('|')) break;
    rows.push(cells(line));
  }
  if (rows.length === 0) return { ok: false, error: 'not-a-plan' };

  const after = lines.slice(end);
  const predicates = readPredicates(after);
  const aliases = readAliases(after);
  const notes = readNotes(after);
  const hasActuals = column('A-Rows') !== -1 && !notes.noRuntimeStats;

  const nodes: PlanNode[] = [];
  const stack: { indent: number; node: PlanNode }[] = [];
  let rootIndent = -1;

  for (const row of rows) {
    const value = (name: string) => {
      const index = column(name);
      return index === -1 ? undefined : row[index];
    };
    const idMatch = /^([*-])?\s*(\d+)$/.exec(value('Id')?.trim() ?? '');
    const operationCell = value('Operation') ?? '';
    const operation = operationCell.trim().replace(/\s+/g, ' ');
    if (!idMatch || operation === '') continue;
    const planId = Number(idMatch[2]);
    const indent = operationCell.length - operationCell.trimStart().length;
    if (rootIndent === -1) rootIndent = indent;

    const name = value('Name')?.trim() || undefined;
    const kind = kindOf(operation);
    const node = emptyNode(nodes.length, name ? `${operation} · ${name}` : operation);
    node.type = operation;
    node.kind = kind;
    node.joinType = joinTypeOf(operation);
    node.parallel = operation.startsWith('PX ');
    if (kind === 'full-scan' || kind === 'table-access') node.relation = name;
    if (kind === 'index-scan') node.index = name;
    const alias = aliases.get(planId);
    if (alias && alias !== name) node.alias = alias;

    const estimatedRows = parseCount(value('E-Rows')) ?? parseCount(value('Rows'));
    if (estimatedRows !== undefined) {
      node.estimate = { startupCost: 0, totalCost: parseCount(value('Cost')?.split('(')[0]) ?? 0, rows: estimatedRows, width: 0 };
    }

    const actualRows = hasActuals ? parseCount(value('A-Rows')) : undefined;
    if (actualRows !== undefined) {
      const starts = parseCount(value('Starts')) ?? 1;
      const totalMs = parseTime(value('A-Time'));
      if (starts === 0) {
        node.neverExecuted = true;
        node.actual = { rows: 0, loops: 0 };
      } else {
        node.actual = { rows: actualRows / starts, loops: starts, totalMs: totalMs === undefined ? undefined : totalMs / starts };
      }
    }

    // Buffers son los bloques pedidos; Reads, los que vinieron del disco. Reads puede pasar a Buffers
    // cuando incluye lo que un SORT o un HASH relee de su espacio temporal: eso no cuenta como bloque de tabla
    const buffers = hasActuals ? parseCount(value('Buffers')) : undefined;
    if (buffers !== undefined) {
      const reads = Math.min(parseCount(value('Reads')) ?? 0, buffers);
      node.buffers = { ...emptyBuffers(), sharedHit: buffers - reads, sharedRead: reads };
    }

    const tempKb = parseKb(value('Used-Tmp'), 'kb');
    if (tempKb !== undefined && tempKb > 0) {
      if (kind === 'sort') node.sortDiskKb = tempKb;
      else node.diskKb = tempKb;
    }
    node.memoryKb = parseKb(value('Used-Mem'), 'bytes');

    const predicate = predicates.get(planId);
    const join = JOIN_KINDS.includes(kind);
    const access = conditions(predicate?.access);
    if (kind === 'hash-join') node.hashCond = access;
    else if (kind === 'merge-join') node.mergeCond = access;
    else node.indexCond = access;
    if (join) node.joinFilter = conditions(predicate?.filter);
    else node.filter = conditions(predicate?.filter);

    node.details = [
      ...(predicate?.access ?? []).map((text) => `access(${text})`),
      ...(predicate?.filter ?? []).map((text) => `filter(${text})`),
      ...DETAIL_COLUMNS.map((name) => [name, value(name)?.trim()] as const)
        .filter(([, text]) => text)
        .map(([name, text]) => `${name}: ${text}`),
    ];

    const depth = indent - rootIndent;
    while (stack.length > 0 && (stack[stack.length - 1]?.indent ?? 0) >= depth) stack.pop();
    const parent = stack[stack.length - 1]?.node;
    if (parent) {
      node.parentId = parent.id;
      node.depth = stack.length;
      parent.children.push(node.id);
    } else if (nodes.length > 0) {
      return { ok: false, error: 'no-indentation' };
    }
    nodes.push(node);
    stack.push({ indent: depth, node });
  }

  if (nodes.length === 0) return { ok: false, error: 'not-a-plan' };
  const root = nodes[0];
  const executionMs = root?.actual?.totalMs === undefined ? undefined : root.actual.totalMs * root.actual.loops;
  return {
    ok: true,
    plan: { format: 'text', dialect: 'oracle', nodes, executionMs, timeResolutionMs: ORACLE_TIME_RESOLUTION_MS, oracle: notes },
  };
}
