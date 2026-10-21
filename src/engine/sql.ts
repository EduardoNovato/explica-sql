import { columnRefs, type ColumnRef } from './expression';
import { thresholds } from './thresholds';
import { namesOf } from './tree';
import type { PlanNode } from './types';

/** Máximo de columnas que se sugieren en un índice */
const MAX_INDEX_COLUMNS = 3;

/** Referencias de la condición que pertenecen a la tabla del nodo (sin calificar o con su alias) */
export function ownColumns(node: PlanNode, expr: string | undefined): ColumnRef[] {
  if (!expr) return [];
  const names = namesOf(node);
  return columnRefs(expr).filter((ref) => ref.qualifier === undefined || names.includes(ref.qualifier));
}

/** Columnas sueltas (no envueltas en funciones), sin repetir y en el orden en que aparecen */
export function plainColumns(refs: ColumnRef[]): string[] {
  const columns: string[] = [];
  for (const ref of refs) if (!ref.fn && !columns.includes(ref.name)) columns.push(ref.name);
  return columns.slice(0, MAX_INDEX_COLUMNS);
}

export const createIndex = (relation: string, columns: string[]) => `CREATE INDEX ON ${relation} (${columns.join(', ')});`;

export const createExpressionIndex = (relation: string, expression: string) => `CREATE INDEX ON ${relation} ((${expression}));`;

/** Valor de work_mem para que quepan `kb` kilobytes: la potencia de 2 en MB inmediatamente superior */
export function workMemFor(kb: number): string {
  let mb: number = thresholds.workMem.minMb;
  while (mb * 1024 < kb) mb *= 2;
  return mb >= 1024 ? `${mb / 1024}GB` : `${mb}MB`;
}

export const setWorkMem = (value: string) => `SET work_mem = '${value}';`;

/** Nombre de tabla sin esquema ni comillas, para armar nombres de objetos */
export const bareName = (relation: string) => (relation.split('.').pop() ?? relation).replace(/"/g, '');
