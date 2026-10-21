/**
 * Todos los umbrales del motor en un solo lugar. Son conservadores a propósito: es mejor callar
 * que dar una falsa alarma.
 *
 * Si cambia un umbral o la lógica de una regla, sube RULES_VERSION: los links compartidos guardan
 * la versión con la que se analizó el plan.
 */
export const RULES_VERSION = 1;

export const verdictLimits = {
  /** Menos de esto es "rápida": solo notas, ninguna alerta */
  fastBelowMs: 10,
  acceptableBelowMs: 100,
  /** Hasta esto (inclusive) es "lenta"; más es "muy lenta" */
  slowUpToMs: 1000,
} as const;

export const thresholds = {
  /** Regla 1: escaneo completo que descarta casi todo */
  seqScan: { minRemovedShare: 0.9, minRemovedRows: 1000, minTimeShare: 0.2 },
  /** Regla 2: filas estimadas contra reales */
  misestimate: { minFactor: 10, minActualRows: 1000 },
  /** Regla 3: work_mem sugerido = lo que se escribió a disco × este factor */
  sortDisk: { workMemFactor: 3 },
  /** Regla 5: vueltas del lado interno de un Nested Loop */
  nestedLoop: { minInnerLoops: 1000 },
  /** Regla 7: bloques leídos de disco frente a los encontrados en memoria */
  diskReads: { minReadToHitRatio: 10, minReadBlocks: 10_000 },
  /** Regla 8: un nodo que se lleva la mayor parte del tiempo */
  dominantNode: { minTimeShare: 0.5, minTotalMs: 100 },
  /** Aviso de planificación lenta: además de superar la ejecución, debe pesar al menos esto */
  slowPlanning: { minPlanningMs: 10 },
  /** Nunca sugerir un work_mem por debajo de este valor */
  workMem: { minMb: 4 },
} as const;
