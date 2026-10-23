import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { describe, expect, it } from 'vitest';
import { analyze, type Analysis } from '../../src/engine';
import { ruleTexts } from '../../src/i18n/rules';
import { tpchQueries } from './queries';

/**
 * Caso basado en TPC-H: las 22 consultas → diagnóstico de Explica SQL → aplicar el SQL que sugiere →
 * medir de nuevo. Corre en PGlite (PostgreSQL compilado a WebAssembly) para que se pueda repetir en
 * cualquier computadora con `npm run tpch`, sin instalar una base de datos.
 *
 * TPCH_SF cambia el factor de escala (0.1 por defecto) y TPCH_QUERIES elige consultas (q17,q20).
 */

const SF = Number(process.env.TPCH_SF ?? '0.1');
const ONLY = process.env.TPCH_QUERIES?.split(',').map((id) => id.trim());
const HERE = new URL('.', import.meta.url);
const DATA_DIR = fileURLToPath(new URL(`.data/sf-${SF}`, HERE));
const OUT_DIR = fileURLToPath(new URL(`resultados/sf-${SF}/`, HERE));
/** Consultas que tardan más que esto se miden una sola vez */
const SLOW_MS = 5000;
const RUNS = 3;

const read = (name: string) => readFileSync(new URL(name, HERE), 'utf8');

async function explain(db: PGlite, sql: string): Promise<string> {
  const result = await db.query<{ 'QUERY PLAN': string }>(`EXPLAIN (ANALYZE, BUFFERS) ${sql}`);
  return result.rows.map((row) => row['QUERY PLAN']).join('\n');
}

function analysisOf(plan: string): Analysis {
  const result = analyze(plan);
  if (!result.ok) throw new Error(`Explica SQL no pudo leer el plan: ${result.error}`);
  return result.analysis;
}

/** Corre la consulta varias veces (una si es lenta) y devuelve el plan de la mediana */
async function measure(db: PGlite, sql: string): Promise<{ plan: string; analysis: Analysis; ms: number }> {
  const first = await explain(db, sql);
  const runs = [{ plan: first, analysis: analysisOf(first) }];
  if ((runs[0]?.analysis.executionMs ?? 0) < SLOW_MS) {
    for (let i = 1; i < RUNS; i++) {
      const plan = await explain(db, sql);
      runs.push({ plan, analysis: analysisOf(plan) });
    }
  }
  runs.sort((a, b) => (a.analysis.executionMs ?? 0) - (b.analysis.executionMs ?? 0));
  const median = runs[Math.floor(runs.length / 2)] ?? runs[0];
  if (!median) throw new Error('sin mediciones');
  return { ...median, ms: median.analysis.executionMs ?? 0 };
}

const names = async (db: PGlite, sql: string) => (await db.query<{ name: string }>(sql)).rows.map((row) => row.name);
const indexes = (db: PGlite) => names(db, "select indexname as name from pg_indexes where schemaname = 'public'");
const statistics = (db: PGlite) => names(db, 'select stxname as name from pg_statistic_ext');

interface Row {
  id: string;
  title: string;
  before: Analysis;
  beforeMs: number;
  applied: string[];
  after?: Analysis;
  afterMs?: number;
}

const ms = (value: number) =>
  value >= 1000 ? `${(value / 1000).toLocaleString('es-CO', { maximumFractionDigits: 2 })} s` : `${value.toLocaleString('es-CO', { maximumFractionDigits: 1 })} ms`;
const verdict = (analysis: Analysis) => ({ fast: 'Rápida', acceptable: 'Aceptable', slow: 'Lenta', 'very-slow': 'Muy lenta' })[analysis.verdict ?? 'fast'];
const findings = (analysis: Analysis) =>
  analysis.findings
    .filter((finding) => finding.severity !== 'note')
    .map((finding) => ruleTexts.es[finding.rule].title)
    .filter((title, i, all) => all.indexOf(title) === i)
    .join(', ') || '—';

describe('caso basado en TPC-H', () => {
  it(`22 consultas con SF ${SF}: diagnóstico, sugerencia aplicada y nueva medición`, async () => {
    mkdirSync(DATA_DIR, { recursive: true });
    mkdirSync(OUT_DIR, { recursive: true });
    const db = new PGlite(DATA_DIR);
    await db.waitReady;

    const ready = await db.query<{ ok: boolean }>("select to_regclass('public.lineitem') is not null as ok");
    if (!ready.rows[0]?.ok) {
      const start = performance.now();
      await db.exec(read('schema.sql'));
      await db.exec(read('generate.sql').replaceAll('{{SF}}', String(SF)));
      await db.exec('ANALYZE');
      console.log(`Datos generados en ${ms(performance.now() - start)}`);
    }

    const environment = (await db.query<{ version: string; work_mem: string; lineitem: number; orders: number }>(
      "select version(), current_setting('work_mem') as work_mem, (select count(*) from lineitem)::int as lineitem, (select count(*) from orders)::int as orders",
    )).rows[0];

    const rows: Row[] = [];
    for (const query of tpchQueries(SF).filter((q) => !ONLY || ONLY.includes(q.id))) {
      const before = await measure(db, query.sql);
      writeFileSync(`${OUT_DIR}${query.id}-antes.txt`, `${before.plan}\n`);
      const row: Row = { id: query.id, title: query.title, before: before.analysis, beforeMs: before.ms, applied: [] };

      // Lo que sugiere Explica SQL en las alertas y avisos, tal cual
      const applied = [...new Set(before.analysis.findings.filter((f) => f.severity !== 'note').flatMap((f) => f.sql))];
      if (applied.length > 0) {
        const indexesBefore = await indexes(db);
        const statisticsBefore = await statistics(db);
        for (const sql of applied) await db.exec(sql);
        const after = await measure(db, query.sql);
        writeFileSync(`${OUT_DIR}${query.id}-despues.txt`, `${after.plan}\n`);
        Object.assign(row, { applied, after: after.analysis, afterMs: after.ms });

        // Se deshace para que la siguiente consulta empiece igual que todas
        for (const name of (await indexes(db)).filter((index) => !indexesBefore.includes(index))) await db.exec(`DROP INDEX ${name}`);
        for (const name of (await statistics(db)).filter((stat) => !statisticsBefore.includes(stat))) await db.exec(`DROP STATISTICS ${name}`);
        await db.exec('RESET work_mem');
      }
      rows.push(row);
      console.log(`${query.id} ${ms(row.beforeMs)}${row.afterMs === undefined ? '' : ` → ${ms(row.afterMs)}`} · ${findings(row.before)}`);
    }
    await db.close();

    const lines = [
      `# Resultados · SF ${SF}`,
      '',
      `${environment?.version} · work_mem ${environment?.work_mem} · ${environment?.lineitem.toLocaleString('es-CO')} líneas de pedido, ${environment?.orders.toLocaleString('es-CO')} pedidos.`,
      `Tiempos: \`Execution Time\` de \`EXPLAIN (ANALYZE, BUFFERS)\`, mediana de ${RUNS} corridas (una sola si pasa de ${SLOW_MS / 1000} s).`,
      '',
      '| Consulta | Antes | Veredicto | Alertas y avisos | SQL aplicado | Después | Mejora |',
      '| --- | --- | --- | --- | --- | --- | --- |',
      ...rows.map((row) => {
        const sql = row.applied.length > 0 ? row.applied.map((line) => `\`${line}\``).join('<br>') : '—';
        const after = row.after && row.afterMs !== undefined ? `${ms(row.afterMs)} (${verdict(row.after)})` : '—';
        const gain = row.afterMs ? `${(row.beforeMs / row.afterMs).toLocaleString('es-CO', { maximumFractionDigits: 1 })}×` : '—';
        return `| ${row.id.toUpperCase()} · ${row.title} | ${ms(row.beforeMs)} | ${verdict(row.before)} | ${findings(row.before)} | ${sql} | ${after} | ${gain} |`;
      }),
      '',
    ];
    writeFileSync(`${OUT_DIR}RESULTADOS.md`, lines.join('\n'));
    console.log(`\n${lines.join('\n')}`);
    expect(rows.length).toBeGreaterThan(0);
  });
});
