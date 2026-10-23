/** Contadores de `Buffers:` (bloques de 8 kB). Incluyen los de los hijos, como los muestra PostgreSQL. */
export interface Buffers {
  sharedHit: number;
  sharedRead: number;
  sharedDirtied: number;
  sharedWritten: number;
  localHit: number;
  localRead: number;
  tempRead: number;
  tempWritten: number;
}

/** Motor de base de datos que generó el plan */
export type Dialect = 'postgres' | 'oracle';

/**
 * Qué hace el paso, igual para los dos motores: así las reglas no dependen de los nombres de
 * PostgreSQL (`Seq Scan`) ni de Oracle (`TABLE ACCESS FULL`).
 */
export type NodeKind =
  | 'full-scan'
  | 'table-access'
  | 'index-scan'
  | 'nested-loop'
  | 'hash-join'
  | 'merge-join'
  | 'hash'
  | 'hash-aggregate'
  | 'sort'
  | 'limit'
  | 'gather'
  | 'result'
  | 'statement'
  | 'other';

/** Un nodo del plan. `actual` y las filas van por vuelta (`loops`), igual que en EXPLAIN de PostgreSQL. */
export interface PlanNode {
  id: number;
  parentId?: number;
  children: number[];
  depth: number;

  /** Tipo como lo nombra el motor, normalizado: `Seq Scan`, `Hash Join`, `TABLE ACCESS FULL`… */
  type: string;
  kind: NodeKind;
  /** Encabezado como lo muestra el motor: `Parallel Seq Scan on orders o`, `TABLE ACCESS FULL · ORDERS` */
  label: string;
  parallel: boolean;
  joinType?: string;
  relation?: string;
  alias?: string;
  index?: string;
  /** `InitPlan 1 (returns $0)`, `SubPlan 1`, `CTE nombre` */
  subplan?: string;

  estimate?: { startupCost: number; totalCost: number; rows: number; width: number };
  actual?: { startupMs?: number; totalMs?: number; rows: number; loops: number };
  neverExecuted: boolean;

  filter?: string;
  indexCond?: string;
  recheckCond?: string;
  hashCond?: string;
  mergeCond?: string;
  joinFilter?: string;
  rowsRemovedByFilter?: number;
  rowsRemovedByJoinFilter?: number;
  rowsRemovedByIndexRecheck?: number;

  sortKey?: string[];
  sortMethod?: string;
  /** Lo que el ordenamiento escribió a disco (el mayor entre el nodo y sus workers) */
  sortDiskKb?: number;
  hashBatches?: number;
  hashOriginalBatches?: number;
  memoryKb?: number;
  /** Lo que un hash bajó a disco (HashAggregate en PostgreSQL, `Used-Tmp` de un hash en Oracle) */
  diskKb?: number;
  workersPlanned?: number;
  workersLaunched?: number;
  buffers?: Buffers;

  /** Líneas de detalle tal cual, para mostrarlas en el árbol */
  details: string[];

  /** Tiempo del nodo con sus hijos, en milisegundos de reloj (lo llena el análisis) */
  inclusiveMs: number;
  /** Tiempo propio: el del nodo menos el de sus hijos */
  selfMs: number;
  /** Fracción del tiempo total que es propia de este nodo (0 a 1) */
  selfShare: number;
}

export type PlanFormat = 'text' | 'json';

/** Lo que dice la sección `Note` de un plan de Oracle */
export interface OracleNotes {
  /** Faltan las estadísticas de ejecución (no se usó GATHER_PLAN_STATISTICS) */
  noRuntimeStats: boolean;
  /** Oracle muestreó porque faltan estadísticas de alguna tabla */
  dynamicSampling: boolean;
}

export interface ParsedPlan {
  format: PlanFormat;
  dialect: Dialect;
  /** En preorden: `nodes[0]` es la raíz y `nodes[n].id === n` */
  nodes: PlanNode[];
  planningMs?: number;
  executionMs?: number;
  /** Precisión de los tiempos cuando es gruesa (A-Time de Oracle: 10 ms) */
  timeResolutionMs?: number;
  oracle?: OracleNotes;
}

export type ParseError = 'empty' | 'not-a-plan' | 'invalid-json' | 'no-indentation';

export type ParseResult = { ok: true; plan: ParsedPlan } | { ok: false; error: ParseError };

export type Verdict = 'fast' | 'acceptable' | 'slow' | 'very-slow';

export type Severity = 'alert' | 'warning' | 'note';

export type RuleId =
  | 'seq-scan'
  | 'misestimate'
  | 'sort-disk'
  | 'hash-batches'
  | 'nested-loop'
  | 'cast-in-filter'
  | 'disk-reads'
  | 'dominant-node';

/** Valores para armar el mensaje en la interfaz (cada idioma tiene su plantilla) */
export type FindingData = Record<string, string | number>;

export interface Finding {
  rule: RuleId;
  severity: Severity;
  /** Nodo que se ilumina al pasar el cursor */
  nodeId: number;
  relatedNodeIds?: number[];
  /** Milisegundos en juego; ordena los hallazgos de igual severidad */
  impactMs: number;
  data: FindingData;
  /** SQL listo para copiar (puede venir vacío) */
  sql: string[];
}

export type NoticeId =
  | 'no-analyze'
  | 'no-buffers'
  | 'workers-not-launched'
  | 'slow-planning'
  | 'oracle-no-stats'
  | 'oracle-dynamic-sampling'
  | 'oracle-parallel'
  | 'oracle-partial-fetch';

export interface Notice {
  id: NoticeId;
  nodeId?: number;
  data: FindingData;
}

export interface Analysis {
  format: PlanFormat;
  dialect: Dialect;
  rulesVersion: number;
  nodes: PlanNode[];
  planningMs?: number;
  executionMs?: number;
  /** Tiempo de referencia para los porcentajes */
  totalMs: number;
  /** Precisión de los tiempos cuando es gruesa (A-Time de Oracle: 10 ms) */
  timeResolutionMs?: number;
  hasAnalyze: boolean;
  hasBuffers: boolean;
  /** Sin `ANALYZE` no hay tiempos reales y no se da veredicto */
  verdict?: Verdict;
  metrics: {
    slowestNodeId?: number;
    /** Filas que leyeron los escaneos (PostgreSQL; Oracle no dice cuántas descartó) */
    rowsRead?: number;
    /** Bloques leídos en total (Oracle, en lugar de filas leídas) */
    blocksRead?: number;
    rowsReturned?: number;
  };
  findings: Finding[];
  notices: Notice[];
}

export type AnalyzeResult = { ok: true; analysis: Analysis } | { ok: false; error: ParseError };

/** Cómo se escribe el SQL sugerido en cada motor */
export interface SqlDialect {
  createIndex(relation: string, columns: string[]): string;
  createExpressionIndex(relation: string, expression: string): string;
  /** `undefined` si el motor no permite cambiar la memoria de trabajo por sesión */
  setWorkMem(value: string): string | undefined;
  gatherStats(relation: string): string;
  extendedStats(relation: string, columns: string[]): string;
  /** Quita comillas que el motor agrega solo, para mostrar y sugerir nombres limpios */
  cleanIdentifier(name: string): string;
}

/** Lo que recibe cada regla */
export interface RuleContext {
  nodes: PlanNode[];
  totalMs: number;
  dialect: Dialect;
  sql: SqlDialect;
}

export interface Rule {
  id: RuleId;
  check(ctx: RuleContext): Finding[];
}
