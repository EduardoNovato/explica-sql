import type { Dialect, NoticeId, ParseError, Severity, Verdict } from '../engine';
import type { CreateError } from '../share/config';

export const languages = {
  es: { label: 'ES', name: 'Español', locale: 'es-CO', path: '/', rulesPath: '/reglas/', oraclePath: '/oracle/' },
  en: { label: 'EN', name: 'English', locale: 'en-US', path: '/en/', rulesPath: '/en/rules/', oraclePath: '/en/oracle/' },
} as const;

export type Lang = keyof typeof languages;
export const defaultLang: Lang = 'es';

export const author = {
  name: 'Eduardo Coronell',
  portfolio: 'https://eduardocoronell.vercel.app',
};

const es = {
  meta: {
    title: 'Explica SQL · Entiende el plan de ejecución de PostgreSQL y Oracle',
    description:
      'Pega el EXPLAIN ANALYZE de PostgreSQL o el DBMS_XPLAN de Oracle y descubre en milisegundos si tu consulta es lenta, dónde se va el tiempo y qué hacer. El análisis corre en tu navegador.',
  },
  skip: 'Saltar al contenido',
  header: {
    home: 'Explica SQL, inicio',
    rules: 'Reglas',
    oracle: 'Oracle',
    langLabel: 'Idioma',
    darkMode: 'Modo oscuro',
  },
  hero: {
    eyebrow: 'PostgreSQL · Oracle',
    tagline:
      'Pega el plan de ejecución de tu consulta en PostgreSQL u Oracle y descubre en milisegundos si es lenta, dónde se va el tiempo y qué hacer, con el SQL listo para copiar.',
  },
  command: {
    title: 'Ejecuta tu consulta así',
    tabsLabel: 'Motor de base de datos',
    copy: 'Copiar',
    copyLong: 'Copiar el comando EXPLAIN',
    copyOracleLong: 'Copiar los comandos para Oracle',
    copied: 'Comando copiado',
    copyError: 'No se pudo copiar. Selecciónalo y cópialo a mano.',
    hint: 'ANALYZE ejecuta la consulta de verdad para medir los tiempos: si es un INSERT, UPDATE o DELETE, envuélvela en BEGIN … ROLLBACK. BUFFERS agrega cuánto se leyó de memoria y de disco.',
    oracleSql: [
      '-- 1. Tu consulta con el hint (trae todas las filas)',
      'SELECT /*+ GATHER_PLAN_STATISTICS */ … ;',
      '',
      '-- 2. En la misma sesión: el plan con los datos reales',
      "SELECT * FROM TABLE(DBMS_XPLAN.DISPLAY_CURSOR(NULL, NULL, 'ALLSTATS LAST +ALIAS'));",
    ].join('\n'),
    oracleHint:
      'Oracle no tiene EXPLAIN ANALYZE: su equivalente son las estadísticas reales que muestra DBMS_XPLAN. Trae todas las filas de tu consulta (DBeaver y SQL Developer solo traen la primera página) y copia todo lo que devuelve el segundo comando.',
    oracleGuide: 'Guía completa para Oracle: permisos, clientes y qué significa cada columna',
  },
  input: {
    title: 'Pega el resultado',
    hint: 'Sirve el EXPLAIN de PostgreSQL (DBeaver, pgAdmin, psql o JSON) y el DBMS_XPLAN de Oracle. Al pegarlo se analiza solo.',
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
    exampleLong: 'Cargar un plan de ejemplo basado en TPC-H, del motor elegido arriba, y analizarlo',
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
    blocksRead: 'Bloques leídos',
    slowest: 'Paso más costoso',
    findings: 'Hallazgos',
    none: 'ninguno',
    atMost: '≤ {time}',
    dialect: { postgres: 'PostgreSQL', oracle: 'Oracle' } satisfies Record<Dialect, string>,
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
      'oracle-no-stats':
        "Este plan no tiene datos reales, solo estimaciones. Ejecuta la consulta con el hint /*+ GATHER_PLAN_STATISTICS */ y pide el plan con DBMS_XPLAN.DISPLAY_CURSOR(NULL, NULL, 'ALLSTATS LAST +ALIAS').",
      'oracle-dynamic-sampling':
        'Oracle tuvo que muestrear (dynamic sampling) porque a alguna tabla le faltan estadísticas. Actualízalas con DBMS_STATS.GATHER_TABLE_STATS.',
      'oracle-parallel':
        'El plan corre en paralelo (PX): los tiempos de los procesos se suman entre sí, así que algunos porcentajes pueden pasar del total.',
      'oracle-partial-fetch':
        'La consulta devolvió justo {rows} filas, lo que trae una página del cliente: parece que no se trajeron todas y los tiempos quedaron cortos. Trae todas las filas antes de pedir el plan.',
    } satisfies Record<NoticeId, string>,
    errors: {
      empty: 'Pega el resultado de EXPLAIN (ANALYZE, BUFFERS) o de DBMS_XPLAN.',
      'not-a-plan':
        'Esto no parece un plan de PostgreSQL ni de Oracle. Copia el resultado completo de EXPLAIN (ANALYZE, BUFFERS) o de DBMS_XPLAN.DISPLAY_CURSOR.',
      'invalid-json': 'El JSON está incompleto o roto. Cópialo completo, desde el primer [ hasta el último ].',
      'no-indentation':
        'El plan perdió la sangría al copiarlo y no se puede armar el árbol. Cópialo de nuevo conservando los espacios del inicio de cada línea.',
    } satisfies Record<ParseError, string>,
  },
  share: {
    button: 'Compartir',
    title: 'Compartir este resultado',
    privacy:
      'Se guarda una copia del plan en el servidor durante el tiempo que elijas y después se borra sola. Cualquiera con el link puede verlo, incluidos los nombres de tablas y columnas.',
    duration: 'El link dura',
    hours: '{n} horas',
    mask: 'Ocultar valores literales',
    maskHint: 'Los textos y números de las condiciones se cambian por ? antes de salir de tu computadora. El análisis no cambia.',
    create: 'Crear link',
    creating: 'Creando…',
    ready: 'Listo: el link vence a las {time}',
    linkLabel: 'Link para compartir',
    copy: 'Copiar link',
    copied: 'Link copiado',
    copyError: 'No se pudo copiar. Selecciónalo y cópialo a mano.',
    errors: {
      invalid: 'No se pudo crear el link. Recarga la página e intenta de nuevo.',
      'too-large': 'El plan es muy grande para compartirlo (máximo 512 kB).',
      'not-a-plan': 'Solo se pueden compartir planes que se puedan analizar.',
      'rate-limited': 'Creaste muchos links en poco tiempo. Intenta de nuevo en un rato.',
      unavailable: 'Compartir no está disponible en este momento.',
      network: 'No hubo conexión con el servidor. Revisa tu internet e intenta de nuevo.',
    } satisfies Record<CreateError | 'network', string>,
    viewTitle: 'Plan compartido',
    viewIntro:
      'Alguien compartió contigo este plan de ejecución. Se analiza en tu navegador, igual que en la página principal.',
    planLabel: 'Plan compartido',
    expires: 'Este link vence a las {time} ({relative}).',
    expired: 'Este link ya venció.',
    masked: 'Los valores literales se ocultaron antes de compartirlo.',
    otherVersion: 'Se compartió con la versión {from} de las reglas y se muestra con la versión {to}: el resultado puede variar.',
    analyzeOwn: 'Analizar mi propio plan',
    goneTitle: 'Este link venció o no existe',
    goneBody:
      'Los links compartidos duran 2 o 4 horas y después se borran solos. Pídele a quien te lo mandó que lo comparta de nuevo, o analiza tu propio plan.',
    errorTitle: 'No se pudo cargar el plan',
    errorBody: 'El servidor no respondió. Intenta de nuevo en un momento.',
  },
  rulesPage: {
    title: 'Las 8 reglas',
    description:
      'Qué revisa Explica SQL en un plan de PostgreSQL u Oracle, cuándo da una alerta y cómo se arregla cada problema.',
    intro:
      'Primero se da un veredicto por el tiempo de ejecución: rápida (menos de 10 ms), aceptable (hasta 100 ms), lenta (hasta 1 s) o muy lenta. Una consulta rápida solo recibe notas, nunca alertas. Después se aplican estas reglas, con umbrales conservadores para no dar falsas alarmas. Sirven para PostgreSQL y para Oracle: cada página explica cómo se ve en los dos.',
    rule: 'Regla {n}',
    what: 'Qué detecta',
    when: 'Cuándo salta',
    why: 'Por qué importa',
    how: 'Cómo se arregla',
    example: 'Así se ve en un plan',
    exampleSql: 'SQL sugerido',
    oracle: 'En Oracle',
    oracleExample: 'Así se ve en Oracle',
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
    title: 'Explica SQL · Understand PostgreSQL and Oracle Execution Plans',
    description:
      'Paste PostgreSQL’s EXPLAIN ANALYZE or Oracle’s DBMS_XPLAN and find out in milliseconds whether your query is slow, where the time goes and what to do. The analysis runs in your browser.',
  },
  skip: 'Skip to Content',
  header: {
    home: 'Explica SQL, home',
    rules: 'Rules',
    oracle: 'Oracle',
    langLabel: 'Language',
    darkMode: 'Dark Mode',
  },
  hero: {
    eyebrow: 'PostgreSQL · Oracle',
    tagline:
      'Paste your query’s execution plan from PostgreSQL or Oracle and find out in milliseconds whether it is slow, where the time goes and what to do, with the SQL ready to copy.',
  },
  command: {
    title: 'Run Your Query Like This',
    tabsLabel: 'Database engine',
    copy: 'Copy',
    copyLong: 'Copy the EXPLAIN command',
    copyOracleLong: 'Copy the commands for Oracle',
    copied: 'Command copied',
    copyError: 'Couldn’t copy it. Select it and copy it by hand.',
    hint: 'ANALYZE really runs the query to measure it: for an INSERT, UPDATE or DELETE, wrap it in BEGIN … ROLLBACK. BUFFERS adds how much was read from memory and from disk.',
    oracleSql: [
      '-- 1. Your query with the hint (fetch every row)',
      'SELECT /*+ GATHER_PLAN_STATISTICS */ … ;',
      '',
      '-- 2. In the same session: the plan with the real figures',
      "SELECT * FROM TABLE(DBMS_XPLAN.DISPLAY_CURSOR(NULL, NULL, 'ALLSTATS LAST +ALIAS'));",
    ].join('\n'),
    oracleHint:
      'Oracle has no EXPLAIN ANALYZE: its equivalent is the real statistics DBMS_XPLAN shows. Fetch every row of your query (DBeaver and SQL Developer only fetch the first page) and copy everything the second command returns.',
    oracleGuide: 'Full guide for Oracle: privileges, clients and what each column means',
  },
  input: {
    title: 'Paste the Output',
    hint: 'PostgreSQL’s EXPLAIN (DBeaver, pgAdmin, psql or JSON) and Oracle’s DBMS_XPLAN both work. It is analyzed as soon as you paste it.',
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
    exampleLong: 'Load an example plan based on TPC-H, for the engine chosen above, and analyze it',
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
    blocksRead: 'Blocks read',
    slowest: 'Costliest step',
    findings: 'Findings',
    none: 'none',
    atMost: '≤ {time}',
    dialect: { postgres: 'PostgreSQL', oracle: 'Oracle' },
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
      'oracle-no-stats':
        "This plan has no real figures, only estimates. Run the query with the /*+ GATHER_PLAN_STATISTICS */ hint and get the plan with DBMS_XPLAN.DISPLAY_CURSOR(NULL, NULL, 'ALLSTATS LAST +ALIAS').",
      'oracle-dynamic-sampling':
        'Oracle had to sample (dynamic sampling) because some table is missing statistics. Refresh them with DBMS_STATS.GATHER_TABLE_STATS.',
      'oracle-parallel':
        'The plan runs in parallel (PX): the processes’ times add up, so some percentages can go over the total.',
      'oracle-partial-fetch':
        'The query returned exactly {rows} rows, one page of the client: it looks like not every row was fetched and the timings fell short. Fetch every row before getting the plan.',
    },
    errors: {
      empty: 'Paste the output of EXPLAIN (ANALYZE, BUFFERS) or DBMS_XPLAN.',
      'not-a-plan':
        'This doesn’t look like a PostgreSQL or Oracle plan. Copy the full output of EXPLAIN (ANALYZE, BUFFERS) or DBMS_XPLAN.DISPLAY_CURSOR.',
      'invalid-json': 'The JSON is incomplete or broken. Copy all of it, from the first [ to the last ].',
      'no-indentation':
        'The plan lost its indentation when copied, so the tree can’t be built. Copy it again keeping the spaces at the start of each line.',
    },
  },
  share: {
    button: 'Share',
    title: 'Share This Result',
    privacy:
      'A copy of the plan is stored on the server for the time you choose and then deletes itself. Anyone with the link can see it, including table and column names.',
    duration: 'Link lasts',
    hours: '{n} hours',
    mask: 'Hide literal values',
    maskHint: 'Text and numbers in the conditions are replaced with ? before they leave your computer. The analysis doesn’t change.',
    create: 'Create Link',
    creating: 'Creating…',
    ready: 'Done: the link expires at {time}',
    linkLabel: 'Link to share',
    copy: 'Copy Link',
    copied: 'Link copied',
    copyError: 'Couldn’t copy it. Select it and copy it by hand.',
    errors: {
      invalid: 'The link couldn’t be created. Reload the page and try again.',
      'too-large': 'The plan is too big to share (512 kB max).',
      'not-a-plan': 'Only plans that can be analyzed can be shared.',
      'rate-limited': 'You created many links in a short time. Try again in a while.',
      unavailable: 'Sharing isn’t available right now.',
      network: 'Couldn’t reach the server. Check your connection and try again.',
    },
    viewTitle: 'Shared Plan',
    viewIntro: 'Someone shared this execution plan with you. It’s analyzed in your browser, just like on the main page.',
    planLabel: 'Shared plan',
    expires: 'This link expires at {time} ({relative}).',
    expired: 'This link has already expired.',
    masked: 'Literal values were hidden before sharing.',
    otherVersion: 'It was shared with version {from} of the rules and is shown with version {to}: the result may differ.',
    analyzeOwn: 'Analyze my own plan',
    goneTitle: 'This Link Expired or Doesn’t Exist',
    goneBody:
      'Shared links last 2 or 4 hours and then delete themselves. Ask whoever sent it to share it again, or analyze your own plan.',
    errorTitle: 'The Plan Couldn’t Be Loaded',
    errorBody: 'The server didn’t respond. Try again in a moment.',
  },
  rulesPage: {
    title: 'The 8 Rules',
    description: 'What Explica SQL checks in a PostgreSQL or Oracle plan, when it raises an alert and how to fix each problem.',
    intro:
      'First comes a verdict based on execution time: fast (under 10 ms), acceptable (up to 100 ms), slow (up to 1 s) or very slow. A fast query only gets notes, never alerts. Then these rules run, with conservative thresholds to avoid false alarms. They work for PostgreSQL and Oracle: each page explains what it looks like in both.',
    rule: 'Rule {n}',
    what: 'What it detects',
    when: 'When it fires',
    why: 'Why it matters',
    how: 'How to fix it',
    example: 'What it looks like in a plan',
    exampleSql: 'Suggested SQL',
    oracle: 'In Oracle',
    oracleExample: 'What it looks like in Oracle',
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
