/**
 * Oculta los valores literales del plan antes de compartirlo: los textos entre comillas simples
 * pasan a `'?'` y los números de las condiciones a `?`. Corre en el navegador, así que los valores
 * reales nunca salen de la computadora. Costos, tiempos y filas no se tocan: el análisis da lo mismo.
 */

const STRING = /'(?:[^']|'')*'/g;
/** Números sueltos: no los que son parte de un nombre (t1), un parámetro ($1), un SubPlan ni un tipo numeric(12,2) */
const NUMBER = /(?<![\w$.]|Plan |::[a-z ]+\([\d, ]*)-?\d+(?:\.\d+)?(?:e[+-]?\d+)?(?![\w.])/gi;

/** Detalles que llevan expresiones con valores */
const CONDITION_KEYS = new Set([
  'Filter',
  'Index Cond',
  'Recheck Cond',
  'Hash Cond',
  'Merge Cond',
  'Join Filter',
  'One-Time Filter',
  'TID Cond',
  'Order By',
  'Run Condition',
  'Output',
  'Group Key',
  'Sort Key',
  'Presorted Key',
  'Cache Key',
]);

const maskStrings = (text: string) => text.replace(STRING, "'?'");
const maskCondition = (text: string) => maskStrings(text).replace(NUMBER, '?');

const ORACLE_TABLE = /^\s*\|\s*Id\s*\|\s*Operation\s*\|/m;
/** Secciones de DBMS_XPLAN que siguen a los predicados */
const ORACLE_SECTION = /^\s*(Column Projection Information|Note$|Query Block Name|Hint Report|Outline Data|Remote SQL Information)/;

/**
 * Oracle: el texto de la consulta (entre `SQL_ID …` y `Plan hash value`) y la sección de predicados.
 * Los textos se ocultan sobre la sección completa porque Oracle parte las líneas largas, incluso a
 * mitad de un texto entre comillas; los números del inicio (`   3 - access(`) son ids y se respetan.
 */
function maskOracle(plan: string): string {
  const lines = plan.replace(/\r\n?/g, '\n').split('\n');
  const out: string[] = [];
  let mode: 'plain' | 'sql' | 'predicates' = 'plain';
  let block: string[] = [];

  const flush = () => {
    if (block.length === 0) return;
    const masked = maskStrings(block.join('\n')).split('\n');
    out.push(
      ...masked.map((line) => {
        if (mode === 'sql') return line.replace(NUMBER, '?');
        const id = /^(\s*\d+\s+-\s+)(.*)$/.exec(line);
        return id ? `${id[1]}${(id[2] ?? '').replace(NUMBER, '?')}` : line.replace(NUMBER, '?');
      }),
    );
    block = [];
  };

  for (const line of lines) {
    const text = line.trim();
    if (mode === 'plain' && /^SQL_ID\s/.test(text)) {
      out.push(line);
      mode = 'sql';
    } else if (mode === 'sql' && (/^Plan hash value:/.test(text) || ORACLE_TABLE.test(line))) {
      flush();
      out.push(line);
      mode = 'plain';
    } else if (/^Predicate Information/.test(text)) {
      flush();
      out.push(line);
      mode = 'predicates';
    } else if (mode === 'predicates' && ORACLE_SECTION.test(line)) {
      flush();
      out.push(line);
      mode = 'plain';
    } else if (mode === 'plain' || /^-+$/.test(text)) {
      if (mode !== 'plain') flush();
      out.push(line);
    } else {
      block.push(line);
    }
  }
  flush();
  return out.join('\n');
}

export function maskLiterals(plan: string): string {
  if (ORACLE_TABLE.test(plan)) return maskOracle(plan);
  const start = plan.trimStart();
  if (start.startsWith('[') || start.startsWith('{')) {
    try {
      return JSON.stringify(maskJson(JSON.parse(start)), null, 2);
    } catch {
      return maskStrings(plan);
    }
  }
  return plan
    .split('\n')
    .map((line) => {
      const key = /^[\s"]*([A-Za-z][A-Za-z -]*?):\s/.exec(line)?.[1];
      return key !== undefined && CONDITION_KEYS.has(key) ? maskCondition(line) : maskStrings(line);
    })
    .join('\n');
}

function maskJson(value: unknown, key?: string): unknown {
  if (typeof value === 'string') return key !== undefined && CONDITION_KEYS.has(key) ? maskCondition(value) : value;
  if (Array.isArray(value)) return value.map((item) => maskJson(item, key));
  if (typeof value === 'object' && value !== null) {
    return Object.fromEntries(Object.entries(value).map(([name, item]) => [name, maskJson(item, name)]));
  }
  return value;
}
