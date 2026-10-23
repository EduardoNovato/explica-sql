/**
 * Lectura mínima de las condiciones que imprime PostgreSQL (`Filter`, `Index Cond`, `Sort Key`…)
 * para saber qué columnas usan y si van envueltas en una función o una conversión de tipo.
 */

export interface ColumnRef {
  qualifier?: string;
  name: string;
  /** Función más externa que envuelve la columna, por ejemplo `date` en `date(creado_en)` */
  fn?: string;
  /** Texto de esa llamada: `date(creado_en)` */
  fnExpression?: string;
  /** Conversión directa de la columna: `(numero)::text` */
  cast?: string;
}

interface Token {
  kind: 'word' | 'quoted' | 'string' | 'number' | 'param' | 'cast' | 'punct' | 'op';
  text: string;
  start: number;
  end: number;
}

/** `$1` en PostgreSQL; `:B1`, `:SYS_B_0` o `:Z` (variables de enlace) en Oracle */
const TOKEN =
  /\s+|'(?:[^']|'')*'|"(?:[^"]|"")*"|[A-Za-z_][\w$#]*|\$\d+|\d+(?:\.\d+)?|::|:\w+|[(),.[\]]|[^\s\w'"(),.[\]$:]+|./gy;

function tokenize(expr: string): Token[] {
  const tokens: Token[] = [];
  TOKEN.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = TOKEN.exec(expr)) !== null) {
    const text = match[0];
    const start = match.index;
    const first = text.charAt(0);
    if (/\s/.test(first)) continue;
    let kind: Token['kind'] = 'op';
    if (first === "'") kind = 'string';
    else if (first === '"') kind = 'quoted';
    else if (/[A-Za-z_]/.test(first)) kind = 'word';
    else if (first === '$' || (first === ':' && text !== '::' && text.length > 1)) kind = 'param';
    else if (/\d/.test(first)) kind = 'number';
    else if (text === '::') kind = 'cast';
    else if ('(),.[]'.includes(text)) kind = 'punct';
    tokens.push({ kind, text, start, end: start + text.length });
  }
  return tokens;
}

/** Palabras que PostgreSQL imprime y no son columnas ni funciones */
const KEYWORDS = new Set([
  'AND', 'OR', 'NOT', 'NULL', 'IS', 'TRUE', 'FALSE', 'ANY', 'ALL', 'SOME', 'IN', 'LIKE', 'ILIKE', 'SIMILAR', 'TO',
  'BETWEEN', 'CASE', 'WHEN', 'THEN', 'ELSE', 'END', 'DESC', 'ASC', 'NULLS', 'FIRST', 'LAST', 'ARRAY', 'ROW',
  'EXISTS', 'DISTINCT', 'FROM', 'COLLATE', 'ESCAPE', 'AT', 'TIME', 'ZONE', 'INTERVAL', 'USING',
  'SubPlan', 'InitPlan', 'hashed', 'returns', 'alternatives',
  // Pseudocolumnas y valores de Oracle
  'ROWNUM', 'ROWID', 'SYSDATE', 'SYSTIMESTAMP', 'LEVEL', 'PRIOR',
]);

const TYPE_WORDS = new Set(['varying', 'without', 'with', 'time', 'zone', 'precision']);

const isName = (token: Token | undefined) => token?.kind === 'word' || token?.kind === 'quoted';

/** Índice del último token de un tipo que empieza en `i` (después de `::`) */
function typeEnd(tokens: Token[], i: number): number {
  let last = i;
  let j = i + 1;
  while (tokens[j]?.kind === 'word' && TYPE_WORDS.has(tokens[j]?.text ?? '')) last = j++;
  if (tokens[j]?.text === '(' && tokens[j + 1]?.kind === 'number') {
    let k = j + 1;
    while (tokens[k] && tokens[k]?.text !== ')') k++;
    last = k;
    j = k + 1;
  }
  while (tokens[j]?.text === '[' && tokens[j + 1]?.text === ']') {
    last = j + 1;
    j += 2;
  }
  return last;
}

export function columnRefs(expr: string): ColumnRef[] {
  const tokens = tokenize(expr);
  const refs: ColumnRef[] = [];
  const frames: { fn?: string; start: number; refs: ColumnRef[]; items: number }[] = [];
  const countItem = () => {
    const frame = frames[frames.length - 1];
    if (frame) frame.items++;
  };

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (!token) continue;
    const next = tokens[i + 1];

    if (token.kind === 'cast') {
      i = typeEnd(tokens, i + 1);
      countItem();
      continue;
    }
    if (token.text === '(') {
      const previous = tokens[i - 1];
      const fn = previous?.kind === 'word' && !KEYWORDS.has(previous.text) && tokens[i - 2]?.kind !== 'cast' ? previous.text : undefined;
      frames.push({ fn, start: fn && previous ? previous.start : token.start, refs: [], items: 0 });
      continue;
    }
    if (token.text === ')') {
      const frame = frames.pop();
      if (!frame) continue;
      if (next?.kind === 'cast' && !frame.fn && frame.items === 1 && frame.refs.length === 1) {
        const last = tokens[typeEnd(tokens, i + 2)];
        const ref = frame.refs[0];
        if (ref && last) ref.cast = expr.slice(frame.start, last.end);
      }
      if (frame.fn) {
        for (const ref of frame.refs) {
          ref.fn = frame.fn;
          ref.fnExpression = expr.slice(frame.start, token.end);
        }
      }
      const parent = frames[frames.length - 1];
      if (parent) parent.refs.push(...frame.refs);
      countItem();
      continue;
    }
    if (isName(token)) {
      if (next?.text === '(' || (token.kind === 'word' && KEYWORDS.has(token.text)) || tokens[i - 1]?.text === '.') {
        countItem();
        continue;
      }
      let ref: ColumnRef = { name: token.text };
      if (next?.text === '.' && isName(tokens[i + 2])) {
        ref = { qualifier: token.text, name: tokens[i + 2]?.text ?? '' };
        i += 2;
      }
      refs.push(ref);
      frames[frames.length - 1]?.refs.push(ref);
      countItem();
      continue;
    }
    countItem();
  }
  return refs;
}

/** Nombres de las funciones llamadas en la expresión */
export function functionCalls(expr: string): string[] {
  const tokens = tokenize(expr);
  return tokens
    .filter((token, i) => token.kind === 'word' && tokens[i + 1]?.text === '(' && !KEYWORDS.has(token.text) && tokens[i - 1]?.kind !== 'cast')
    .map((token) => token.text);
}

/** `l.l_shipdate DESC NULLS LAST` → columna y orden; `undefined` si la clave es una expresión */
export function sortKeyColumn(key: string): { qualifier?: string; name: string; order: string } | undefined {
  const match = /^(?:("?[\w$]+"?)\.)?("?[\w$]+"?)((?: (?:ASC|DESC))?(?: NULLS (?:FIRST|LAST))?)$/.exec(key.trim());
  if (!match || !match[2]) return undefined;
  return { qualifier: match[1], name: match[2], order: match[3] ?? '' };
}
