import type { ParseResult } from '../types';
import { cleanLines } from './clean';
import { parseJsonPlan } from './json';
import { isOraclePlan, parseOraclePlan } from './oracle';
import { parseTextPlan } from './text';

/** Lee el plan de PostgreSQL (texto o JSON) o de Oracle (DBMS_XPLAN); detecta el formato solo */
export function parsePlan(input: string): ParseResult {
  const lines = cleanLines(input);
  if (lines.length === 0) return { ok: false, error: 'empty' };
  if (isOraclePlan(lines)) return parseOraclePlan(lines);
  const first = lines[0]?.trimStart() ?? '';
  if (first.startsWith('[') || first.startsWith('{')) return parseJsonPlan(lines.join('\n'));
  // pgAdmin copia el JSON (una sola celda de varias líneas) entre comillas y duplica las internas
  if (/^"[[{]/.test(first)) {
    const quoted = lines.join('\n').trim();
    return parseJsonPlan(quoted.slice(1, quoted.endsWith('"') ? -1 : undefined).replace(/""/g, '"'));
  }
  return parseTextPlan(lines);
}
