import { columnRefs, type ColumnRef } from './expression';
import { thresholds } from './thresholds';
import { namesOf } from './tree';
import type { Dialect, PlanNode, SqlDialect } from './types';

/** Máximo de columnas que se sugieren en un índice */
const MAX_INDEX_COLUMNS = 3;

/**
 * Referencias de la condición que pertenecen a la tabla del nodo (sin calificar o con su alias),
 * con los nombres ya limpios para el motor.
 */
export function ownColumns(node: PlanNode, expr: string | undefined, sql: SqlDialect): ColumnRef[] {
  if (!expr) return [];
  const names = namesOf(node).map(sql.cleanIdentifier);
  return columnRefs(expr)
    .map((ref) => ({ ...ref, name: sql.cleanIdentifier(ref.name), qualifier: ref.qualifier && sql.cleanIdentifier(ref.qualifier) }))
    .filter((ref) => ref.qualifier === undefined || names.includes(ref.qualifier));
}

/** Columnas sueltas (no envueltas en funciones), sin repetir y en el orden en que aparecen */
export function plainColumns(refs: ColumnRef[]): string[] {
  const columns: string[] = [];
  for (const ref of refs) if (!ref.fn && !columns.includes(ref.name)) columns.push(ref.name);
  return columns.slice(0, MAX_INDEX_COLUMNS);
}

/** Valor de work_mem para que quepan `kb` kilobytes: la potencia de 2 en MB inmediatamente superior */
export function workMemFor(kb: number): string {
  let mb: number = thresholds.workMem.minMb;
  while (mb * 1024 < kb) mb *= 2;
  return mb >= 1024 ? `${mb / 1024}GB` : `${mb}MB`;
}

/** Nombre de tabla sin esquema ni comillas, para armar nombres de objetos */
export const bareName = (relation: string) => (relation.split('.').pop() ?? relation).replace(/"/g, '');

export const postgresSql: SqlDialect = {
  createIndex: (relation, columns) => `CREATE INDEX ON ${relation} (${columns.join(', ')});`,
  createExpressionIndex: (relation, expression) => `CREATE INDEX ON ${relation} ((${expression}));`,
  setWorkMem: (value) => `SET work_mem = '${value}';`,
  gatherStats: (relation) => `ANALYZE ${relation};`,
  extendedStats: (relation, columns) =>
    `CREATE STATISTICS ${bareName(relation)}_${columns.map((column) => column.replace(/"/g, '')).join('_')}_stats (dependencies) ON ${columns.join(', ')} FROM ${relation};`,
  cleanIdentifier: (name) => name,
};

/** Oracle exige nombre para el índice; hasta 30 caracteres para que sirva también en 12.1 */
const oracleIndexName = (relation: string, parts: string[], suffix: string) =>
  `${[bareName(relation), ...parts].join('_')}`
    .toUpperCase()
    .replace(/[^A-Z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .slice(0, 30 - suffix.length - 1)
    .replace(/_$/, '')
    .concat(`_${suffix}`);

/** Quita las comillas de los nombres en mayúsculas dentro de una expresión: `TRUNC("CREADO_EN")` → `TRUNC(CREADO_EN)` */
const unquoteOracle = (text: string) => text.replace(/"([A-Z][A-Z0-9_$#]*)"/g, '$1');

export const oracleSql: SqlDialect = {
  createIndex: (relation, columns) => `CREATE INDEX ${oracleIndexName(relation, columns, 'IX')} ON ${relation} (${columns.join(', ')});`,
  createExpressionIndex: (relation, expression) => {
    const clean = unquoteOracle(expression);
    return `CREATE INDEX ${oracleIndexName(relation, [clean.replace(/\W+/g, '_')], 'FN_IX')} ON ${relation} (${clean});`;
  },
  // La memoria de trabajo la reparte Oracle (PGA_AGGREGATE_TARGET): no se sugiere cambiarla por sesión
  setWorkMem: () => undefined,
  gatherStats: (relation) => `BEGIN DBMS_STATS.GATHER_TABLE_STATS(USER, '${bareName(relation)}'); END;`,
  extendedStats: (relation, columns) =>
    `SELECT DBMS_STATS.CREATE_EXTENDED_STATS(USER, '${bareName(relation)}', '(${columns.join(', ')})') FROM dual;`,
  // Oracle cita todo en sus predicados ("O_CUSTKEY"); si el nombre está en mayúsculas, las comillas sobran
  cleanIdentifier: (name) => (/^"[A-Z][A-Z0-9_$#]*"$/.test(name) ? name.slice(1, -1) : name),
};

export const sqlFor = (dialect: Dialect): SqlDialect => (dialect === 'oracle' ? oracleSql : postgresSql);
