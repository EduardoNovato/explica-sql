import type { NoticeId, ParseError, Severity, Verdict } from '../engine';

export const languages = {
  es: { label: 'ES', name: 'Español', locale: 'es-CO', path: '/', rulesPath: '/reglas/' },
  en: { label: 'EN', name: 'English', locale: 'en-US', path: '/en/', rulesPath: '/en/rules/' },
} as const;

export type Lang = keyof typeof languages;
export const defaultLang: Lang = 'es';

export const author = {
  name: 'Eduardo Coronell',
  portfolio: 'https://eduardocoronell.vercel.app',
};

const es = {
  meta: {
    title: 'Explica SQL · Entiende el EXPLAIN ANALYZE de PostgreSQL',
    description:
      'Pega el resultado de EXPLAIN ANALYZE de PostgreSQL y descubre en milisegundos si tu consulta es lenta, dónde se va el tiempo y qué hacer. El análisis corre en tu navegador.',
  },
  skip: 'Saltar al contenido',
  header: {
    home: 'Explica SQL, inicio',
    rules: 'Reglas',
    langLabel: 'Idioma',
    darkMode: 'Modo oscuro',
  },
  hero: {
    eyebrow: 'PostgreSQL · EXPLAIN ANALYZE',
    tagline:
      'Pega el plan de ejecución de tu consulta y descubre en milisegundos si es lenta, dónde se va el tiempo y qué hacer, con el SQL listo para copiar.',
  },
  command: {
    title: 'Ejecuta tu consulta así',
    copy: 'Copiar',
    copyLong: 'Copiar el comando EXPLAIN',
    copied: 'Comando copiado',
    copyError: 'No se pudo copiar. Selecciónalo y cópialo a mano.',
    hint: 'ANALYZE ejecuta la consulta de verdad para medir los tiempos: si es un INSERT, UPDATE o DELETE, envuélvela en BEGIN … ROLLBACK. BUFFERS agrega cuánto se leyó de memoria y de disco.',
  },
  input: {
    title: 'Pega el resultado',
    hint: 'Sirve el texto que copias de DBeaver, pgAdmin o psql, o el formato JSON. Al pegarlo se analiza solo.',
    placeholder: [
      'QUERY PLAN',
      'Seq Scan on pedidos  (cost=0.00..1.08 rows=8 width=44) (actual time=0.011..0.014 rows=8 loops=1)',
      '  Buffers: shared hit=1',
      'Planning Time: 0.062 ms',
      'Execution Time: 0.032 ms',
    ].join('\n'),
    lineOne: '{n} línea',
    lineOther: '{n} líneas',
    empty: 'Sin plan todavía',
    clear: 'Limpiar',
    analyze: 'Analizar',
    example: 'Probar un ejemplo',
    exampleLong: 'Cargar un plan de ejemplo basado en TPC-H y analizarlo',
    privacy: 'El análisis corre en tu navegador: el plan no sale de tu computadora.',
  },
  verdict: {
    fast: 'Rápida',
    acceptable: 'Aceptable',
    slow: 'Lenta',
    'very-slow': 'Muy lenta',
  } satisfies Record<Verdict, string>,
  analysis: {
    title: 'Resultado',
    estimatesOnly: 'Solo estimaciones',
    execution: 'Ejecución',
    planning: 'Planificación',
    rowsReturned: 'Filas devueltas',
    rowsRead: 'Filas leídas',
    slowest: 'Paso más costoso',
    findings: 'Hallazgos',
    none: 'ninguno',
    severity: { alert: 'Alerta', warning: 'Aviso', note: 'Nota' } satisfies Record<Severity, string>,
    severityCount: {
      alert: ['{n} alerta', '{n} alertas'],
      warning: ['{n} aviso', '{n} avisos'],
      note: ['{n} nota', '{n} notas'],
    } satisfies Record<Severity, [string, string]>,
    findingsTitle: 'Hallazgos',
    noFindingsFast: 'Rápida y sin nada que revisar.',
    noFindings: 'Nada supera los umbrales: no hay hallazgos.',
    noFindingsNoAnalyze: 'Sin tiempos reales no hay hallazgos que dar.',
    fix: 'Qué hacer:',
    copySql: 'Copiar SQL',
    copied: 'SQL copiado',
    copyError: 'No se pudo copiar. Selecciónalo y cópialo a mano.',
    showInTree: 'Ver en el árbol',
    moreAbout: 'Sobre esta regla',
    treeTitle: 'Árbol del plan',
    treeHint: 'La barra es el tiempo propio de cada paso: su tiempo menos el de los pasos que tiene adentro.',
    rows: '{n} filas',
    estimated: 'estimadas {n}',
    removed: 'descartó {n}',
    loops: '{n} vueltas',
    neverExecuted: 'no se ejecutó',
    details: 'Detalles',
    findingOnNode: 'Hallazgo en este paso',
    notices: {
      'no-analyze':
        'Este plan no tiene tiempos reales, solo estimaciones. Córrelo con EXPLAIN (ANALYZE, BUFFERS) para medir la consulta.',
      'no-buffers': 'Agrega BUFFERS al EXPLAIN para ver cuánto se leyó de memoria y de disco.',
      'workers-not-launched':
        'Se planearon {planned} workers en paralelo y arrancaron {launched}: el servidor no tenía workers libres (max_parallel_workers).',
      'slow-planning': 'Planificar ({planningMs}) tardó más que ejecutar ({executionMs}).',
    } satisfies Record<NoticeId, string>,
    errors: {
      empty: 'Pega el resultado de EXPLAIN (ANALYZE, BUFFERS).',
      'not-a-plan': 'Esto no parece un plan de PostgreSQL. Copia el resultado completo de EXPLAIN (ANALYZE, BUFFERS).',
      'invalid-json': 'El JSON está incompleto o roto. Cópialo completo, desde el primer [ hasta el último ].',
      'no-indentation':
        'El plan perdió la sangría al copiarlo y no se puede armar el árbol. Cópialo de nuevo conservando los espacios del inicio de cada línea.',
    } satisfies Record<ParseError, string>,
  },
  rulesPage: {
    title: 'Las 8 reglas',
    description:
      'Qué revisa Explica SQL en un plan de PostgreSQL, cuándo da una alerta y cómo se arregla cada problema.',
    intro:
      'Primero se da un veredicto por el tiempo de ejecución: rápida (menos de 10 ms), aceptable (hasta 100 ms), lenta (hasta 1 s) o muy lenta. Una consulta rápida solo recibe notas, nunca alertas. Después se aplican estas reglas, con umbrales conservadores para no dar falsas alarmas.',
    rule: 'Regla {n}',
    what: 'Qué detecta',
    when: 'Cuándo salta',
    why: 'Por qué importa',
    how: 'Cómo se arregla',
    example: 'Así se ve en un plan',
    exampleSql: 'SQL sugerido',
    back: 'Volver al analizador',
    all: 'Todas las reglas',
    next: 'Siguiente regla',
  },
  footer: {
    madeBy: 'Hecho por',
    place: 'en Barranquilla',
    license: 'Código abierto · MIT',
  },
};

export type UiStrings = typeof es;

const en: UiStrings = {
  meta: {
    title: 'Explica SQL · Understand PostgreSQL’s EXPLAIN ANALYZE',
    description:
      'Paste the output of PostgreSQL’s EXPLAIN ANALYZE and find out in milliseconds whether your query is slow, where the time goes and what to do. The analysis runs in your browser.',
  },
  skip: 'Skip to Content',
  header: {
    home: 'Explica SQL, home',
    rules: 'Rules',
    langLabel: 'Language',
    darkMode: 'Dark Mode',
  },
  hero: {
    eyebrow: 'PostgreSQL · EXPLAIN ANALYZE',
    tagline:
      'Paste your query’s execution plan and find out in milliseconds whether it is slow, where the time goes and what to do, with the SQL ready to copy.',
  },
  command: {
    title: 'Run Your Query Like This',
    copy: 'Copy',
    copyLong: 'Copy the EXPLAIN command',
    copied: 'Command copied',
    copyError: 'Couldn’t copy it. Select it and copy it by hand.',
    hint: 'ANALYZE really runs the query to measure it: for an INSERT, UPDATE or DELETE, wrap it in BEGIN … ROLLBACK. BUFFERS adds how much was read from memory and from disk.',
  },
  input: {
    title: 'Paste the Output',
    hint: 'Text copied from DBeaver, pgAdmin or psql works, and so does the JSON format. It is analyzed as soon as you paste it.',
    placeholder: [
      'QUERY PLAN',
      'Seq Scan on orders  (cost=0.00..1.08 rows=8 width=44) (actual time=0.011..0.014 rows=8 loops=1)',
      '  Buffers: shared hit=1',
      'Planning Time: 0.062 ms',
      'Execution Time: 0.032 ms',
    ].join('\n'),
    lineOne: '{n} line',
    lineOther: '{n} lines',
    empty: 'No plan yet',
    clear: 'Clear',
    analyze: 'Analyze',
    example: 'Try an Example',
    exampleLong: 'Load an example plan based on TPC-H and analyze it',
    privacy: 'The analysis runs in your browser: your plan never leaves your computer.',
  },
  verdict: {
    fast: 'Fast',
    acceptable: 'Acceptable',
    slow: 'Slow',
    'very-slow': 'Very Slow',
  },
  analysis: {
    title: 'Result',
    estimatesOnly: 'Estimates Only',
    execution: 'Execution',
    planning: 'Planning',
    rowsReturned: 'Rows returned',
    rowsRead: 'Rows read',
    slowest: 'Costliest step',
    findings: 'Findings',
    none: 'none',
    severity: { alert: 'Alert', warning: 'Warning', note: 'Note' },
    severityCount: {
      alert: ['{n} alert', '{n} alerts'],
      warning: ['{n} warning', '{n} warnings'],
      note: ['{n} note', '{n} notes'],
    },
    findingsTitle: 'Findings',
    noFindingsFast: 'Fast, and nothing to review.',
    noFindings: 'Nothing crosses the thresholds: no findings.',
    noFindingsNoAnalyze: 'Without real timings there are no findings to report.',
    fix: 'What to do:',
    copySql: 'Copy SQL',
    copied: 'SQL copied',
    copyError: 'Couldn’t copy it. Select it and copy it by hand.',
    showInTree: 'Show in tree',
    moreAbout: 'About this rule',
    treeTitle: 'Plan Tree',
    treeHint: 'The bar is each step’s own time: its time minus the time of the steps inside it.',
    rows: '{n} rows',
    estimated: '{n} estimated',
    removed: 'removed {n}',
    loops: '{n} loops',
    neverExecuted: 'never executed',
    details: 'Details',
    findingOnNode: 'Finding on this step',
    notices: {
      'no-analyze': 'This plan has no real timings, only estimates. Run it with EXPLAIN (ANALYZE, BUFFERS) to measure the query.',
      'no-buffers': 'Add BUFFERS to the EXPLAIN to see how much was read from memory and from disk.',
      'workers-not-launched':
        '{planned} parallel workers were planned and {launched} started: the server had no free workers (max_parallel_workers).',
      'slow-planning': 'Planning ({planningMs}) took longer than execution ({executionMs}).',
    },
    errors: {
      empty: 'Paste the output of EXPLAIN (ANALYZE, BUFFERS).',
      'not-a-plan': 'This doesn’t look like a PostgreSQL plan. Copy the full output of EXPLAIN (ANALYZE, BUFFERS).',
      'invalid-json': 'The JSON is incomplete or broken. Copy all of it, from the first [ to the last ].',
      'no-indentation':
        'The plan lost its indentation when copied, so the tree can’t be built. Copy it again keeping the spaces at the start of each line.',
    },
  },
  rulesPage: {
    title: 'The 8 Rules',
    description: 'What Explica SQL checks in a PostgreSQL plan, when it raises an alert and how to fix each problem.',
    intro:
      'First comes a verdict based on execution time: fast (under 10 ms), acceptable (up to 100 ms), slow (up to 1 s) or very slow. A fast query only gets notes, never alerts. Then these rules run, with conservative thresholds to avoid false alarms.',
    rule: 'Rule {n}',
    what: 'What it detects',
    when: 'When it fires',
    why: 'Why it matters',
    how: 'How to fix it',
    example: 'What it looks like in a plan',
    exampleSql: 'Suggested SQL',
    back: 'Back to the analyzer',
    all: 'All rules',
    next: 'Next rule',
  },
  footer: {
    madeBy: 'Made by',
    place: 'in Barranquilla',
    license: 'Open source · MIT',
  },
};

export const ui: Record<Lang, UiStrings> = { es, en };

export function useTranslations(lang: Lang) {
  return ui[lang];
}
