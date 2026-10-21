/**
 * Motor de análisis de Explica SQL.
 *
 * TypeScript puro: solo importa archivos de esta carpeta. Nada de Astro, React, APIs del navegador
 * ni paquetes externos, para probarlo con Vitest y medir su velocidad sin abrir una página
 * (`purity.test.ts` lo vigila).
 *
 * Flujo previsto para la fase 1:
 *   texto o JSON de EXPLAIN ANALYZE → árbol de nodos → tiempo propio por nodo
 *   → veredicto global → 8 reglas + avisos de contexto
 *
 * Organización prevista:
 *   index.ts       API pública que usa la interfaz
 *   parse/         lectores de texto (DBeaver, pgAdmin, psql) y JSON, con detección automática
 *   rules/         una regla por archivo, cada una con su prueba al lado
 *   thresholds.ts  todos los umbrales en un solo lugar
 */
export {};
