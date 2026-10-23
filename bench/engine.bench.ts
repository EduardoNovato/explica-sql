import { appendFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { analyze } from '../src/engine';
import hashSort from '../src/engine/fixtures/hash-sort.txt?raw';
import oracleHashSort from '../src/engine/fixtures/oracle-hash-sort.txt?raw';
import { oracleWide, postgresDeep, postgresJson, postgresWide } from './plans';

/**
 * Velocidad del motor: cuánto tarda `analyze` (leer + árbol + tiempos + reglas) con planes grandes.
 * Meta del proyecto: un plan de 1.000 pasos en menos de 20 ms. Corre en cada cambio (GitHub Actions)
 * y deja la tabla en el resumen del job.
 */

const WARMUP = 10;
const RUNS = 60;
/**
 * Margen para máquinas más lentas que un portátil (los runners de CI): la prueba falla si la mediana
 * pasa de la meta × este factor. En la tabla siempre se muestra la meta real.
 */
const TOLERANCE = Number(process.env.BENCH_TOLERANCE ?? '1');

interface Scenario {
  name: string;
  plan: string;
  steps: number;
  /** Mediana máxima permitida; si se pasa, la prueba falla */
  limitMs: number;
}

/** Meta para planes de 1.000 pasos con forma real */
const GOAL_MS = 20;

const scenarios: Scenario[] = [
  { name: 'PostgreSQL texto · 1.001 pasos', plan: postgresWide(), steps: 1001, limitMs: GOAL_MS },
  { name: 'PostgreSQL JSON · 1.001 pasos', plan: postgresJson(), steps: 1001, limitMs: GOAL_MS },
  { name: 'Oracle DBMS_XPLAN · 1.000 pasos', plan: oracleWide(), steps: 1000, limitMs: GOAL_MS },
  // 1.000 niveles de anidación son ~6 MB de espacios: no es un plan real, vigila que no vuelva lo cuadrático
  { name: 'PostgreSQL texto · 1.000 niveles (peor caso)', plan: postgresDeep(), steps: 1000, limitMs: 100 },
  { name: 'Plan TPC-H de PostgreSQL · 5 pasos', plan: hashSort, steps: 5, limitMs: 1 },
  { name: 'Plan TPC-H de Oracle · 5 pasos', plan: oracleHashSort, steps: 5, limitMs: 1 },
];

function measure(plan: string): { median: number; p95: number; max: number } {
  for (let i = 0; i < WARMUP; i++) analyze(plan);
  const times: number[] = [];
  for (let i = 0; i < RUNS; i++) {
    const start = performance.now();
    analyze(plan);
    times.push(performance.now() - start);
  }
  times.sort((a, b) => a - b);
  const at = (q: number) => times[Math.min(times.length - 1, Math.floor(q * times.length))] ?? 0;
  return { median: at(0.5), p95: at(0.95), max: times[times.length - 1] ?? 0 };
}

const rows: string[] = [];

describe('velocidad del motor', () => {
  it.each(scenarios)('$name', ({ name, plan, steps, limitMs }) => {
    const result = analyze(plan);
    expect(result.ok && result.analysis.nodes.length).toBe(steps);

    const { median, p95, max } = measure(plan);
    const kb = Math.round(new TextEncoder().encode(plan).length / 1024);
    const ms = (value: number) => value.toFixed(2);
    rows.push(`| ${name} | ${kb.toLocaleString('es-CO')} kB | ${ms(median)} ms | ${ms(p95)} ms | ${ms(max)} ms | < ${limitMs} ms |`);
    expect(median).toBeLessThan(limitMs * TOLERANCE);
  });

  it('deja la tabla de resultados', () => {
    const table = [
      `### Velocidad del motor (Node ${process.versions.node}, ${RUNS} corridas${TOLERANCE === 1 ? '' : `, falla si pasa de la meta × ${TOLERANCE}`})`,
      '',
      '| Plan | Tamaño | Mediana | p95 | Máximo | Meta |',
      '| --- | --- | --- | --- | --- | --- |',
      ...rows,
      '',
    ].join('\n');
    console.log(`\n${table}`);
    if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${table}\n`);
  });
});
