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

export function maskLiterals(plan: string): string {
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
