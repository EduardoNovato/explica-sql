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

/** Un nodo del plan. `actual` y las filas van por vuelta (`loops`), igual que en EXPLAIN. */
export interface PlanNode {
  id: number;
  parentId?: number;
  children: number[];
  depth: number;

  /** Tipo normalizado: `Seq Scan`, `Hash Join`, `HashAggregate`… (sin `Parallel`, `Partial` ni tipo de join) */
  type: string;
  /** Encabezado como lo muestra PostgreSQL: `Parallel Seq Scan on orders o` */
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

export interface ParsedPlan {
  format: PlanFormat;
  /** En preorden: `nodes[0]` es la raíz y `nodes[n].id === n` */
  nodes: PlanNode[];
  planningMs?: number;
  executionMs?: number;
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

export type NoticeId = 'no-analyze' | 'no-buffers' | 'workers-not-launched' | 'slow-planning';

export interface Notice {
  id: NoticeId;
  nodeId?: number;
  data: FindingData;
}

export interface Analysis {
  format: PlanFormat;
  rulesVersion: number;
  nodes: PlanNode[];
  planningMs?: number;
  executionMs?: number;
  /** Tiempo de referencia para los porcentajes */
  totalMs: number;
  hasAnalyze: boolean;
  hasBuffers: boolean;
  /** Sin `ANALYZE` no hay tiempos reales y no se da veredicto */
  verdict?: Verdict;
  metrics: {
    slowestNodeId?: number;
    rowsRead?: number;
    rowsReturned?: number;
  };
  findings: Finding[];
  notices: Notice[];
}

export type AnalyzeResult = { ok: true; analysis: Analysis } | { ok: false; error: ParseError };

/** Lo que recibe cada regla */
export interface RuleContext {
  nodes: PlanNode[];
  totalMs: number;
}

export interface Rule {
  id: RuleId;
  check(ctx: RuleContext): Finding[];
}
