import type { Lang } from './ui';

/** Guía para usar Explica SQL con Oracle: de dónde sale el plan, permisos y cómo se lee */
export interface OracleGuideText {
  title: string;
  description: string;
  lead: string;
  stepsTitle: string;
  steps: { text: string; code?: string }[];
  example: string;
  clientsTitle: string;
  clients: { name: string; text: string }[];
  otherSqlTitle: string;
  otherSql: string;
  otherSqlCode: string;
  permissionsTitle: string;
  permissions: string;
  permissionsCode: string;
  estimatesTitle: string;
  estimates: string;
  estimatesCode: string;
  columnsTitle: string;
  columns: { name: string; text: string }[];
  differencesTitle: string;
  differences: string[];
  notes: string[];
  back: string;
}

const es: OracleGuideText = {
  title: 'Explica SQL con Oracle',
  description:
    'Cómo sacar el plan de ejecución real de una consulta en Oracle con DBMS_XPLAN y analizarlo en Explica SQL: paso a paso, permisos y qué significa cada columna.',
  lead: 'Oracle no tiene EXPLAIN ANALYZE. Su equivalente son las estadísticas reales de cada paso del plan, que muestra DBMS_XPLAN. Explica SQL lee ese texto y da el mismo análisis que con PostgreSQL: veredicto, árbol, hallazgos y SQL con sintaxis de Oracle.',
  stepsTitle: 'Paso a paso',
  steps: [
    {
      text: 'Ejecuta tu consulta con el hint GATHER_PLAN_STATISTICS y trae todas las filas. Si el cliente trae solo la primera página, los tiempos quedan cortos.',
      code: 'SELECT /*+ GATHER_PLAN_STATISTICS */ c.nombre, SUM(p.total)\nFROM clientes c JOIN pedidos p ON p.cliente_id = c.id\nGROUP BY c.nombre;',
    },
    {
      text: 'En la misma sesión, pide el plan con las estadísticas de esa última ejecución:',
      code: "SELECT * FROM TABLE(DBMS_XPLAN.DISPLAY_CURSOR(NULL, NULL, 'ALLSTATS LAST +ALIAS'));",
    },
    {
      text: 'Copia todo el resultado, desde SQL_ID hasta el final (con la sección Predicate Information), y pégalo en el paso 2 de Explica SQL. Se reconoce solo como Oracle.',
    },
  ],
  example: 'Probar con un ejemplo de Oracle',
  clientsTitle: 'Según tu cliente',
  clients: [
    {
      name: 'SQL Developer',
      text: 'Ejecuta los dos comandos con «Ejecutar script» (F5) y copia la salida. Si usas la grilla, baja hasta el final del resultado para que traiga todas las filas antes de pedir el plan.',
    },
    {
      name: 'DBeaver',
      text: 'En el resultado de tu consulta usa «Fetch all rows»; después ejecuta el DISPLAY_CURSOR y copia la columna PLAN_TABLE_OUTPUT completa.',
    },
    {
      name: 'SQL*Plus',
      text: 'Antes de empezar, SET LINESIZE 400 PAGESIZE 2000 y SET SERVEROUTPUT OFF. Si no, el plan sale cortado o DISPLAY_CURSOR muestra otra consulta.',
    },
    { name: 'Toad, PL/SQL Developer', text: 'Ejecuta los comandos como script y copia la salida de texto.' },
  ],
  otherSqlTitle: 'Si muestra otra consulta',
  otherSql:
    'DISPLAY_CURSOR(NULL, NULL, …) muestra la última consulta de tu sesión. Si el cliente ejecutó algo en el medio, busca el SQL_ID de la tuya y pásalo:',
  otherSqlCode:
    "SELECT sql_id, child_number FROM v$sql\nWHERE sql_text LIKE 'SELECT /*+ GATHER_PLAN_STATISTICS */%'\n  AND sql_text NOT LIKE '%v$sql%';\n\nSELECT * FROM TABLE(DBMS_XPLAN.DISPLAY_CURSOR('el_sql_id', 0, 'ALLSTATS LAST +ALIAS'));",
  permissionsTitle: 'Permisos',
  permissions:
    'DISPLAY_CURSOR lee vistas del diccionario de datos. Si te da un error de permisos, pídele al DBA lectura sobre estas vistas (o el rol SELECT_CATALOG_ROLE):',
  permissionsCode:
    'GRANT SELECT ON V_$SQL TO tu_usuario;\nGRANT SELECT ON V_$SQL_PLAN TO tu_usuario;\nGRANT SELECT ON V_$SQL_PLAN_STATISTICS_ALL TO tu_usuario;\nGRANT SELECT ON V_$SESSION TO tu_usuario;',
  estimatesTitle: 'Sin permisos: solo estimaciones',
  estimates:
    'EXPLAIN PLAN no ejecuta la consulta ni necesita esos permisos, pero solo da estimaciones. Explica SQL lo lee y muestra el árbol, sin veredicto ni tiempos.',
  estimatesCode: 'EXPLAIN PLAN FOR SELECT … ;\n\nSELECT * FROM TABLE(DBMS_XPLAN.DISPLAY);',
  columnsTitle: 'Qué significa cada columna',
  columns: [
    { name: 'Starts', text: 'Cuántas veces se ejecutó el paso: las vueltas.' },
    { name: 'E-Rows', text: 'Filas que Oracle estimó para cada ejecución.' },
    { name: 'A-Rows', text: 'Filas reales, sumando todas las ejecuciones.' },
    { name: 'A-Time', text: 'Tiempo real del paso con sus hijos, en centésimas de segundo.' },
    { name: 'Buffers', text: 'Bloques que pidió, de memoria o de disco.' },
    { name: 'Reads', text: 'Bloques que tuvo que leer del disco.' },
    { name: 'Used-Mem, Used-Tmp', text: 'Memoria que usó un SORT o un HASH, y el espacio temporal si no le alcanzó.' },
  ],
  differencesTitle: 'Diferencias con PostgreSQL',
  differences: [
    'A-Time solo tiene centésimas de segundo: una consulta de 00:00:00.01 cuenta como rápida, y en los pasos muy rápidos los porcentajes son aproximados.',
    'GATHER_PLAN_STATISTICS le agrega algo de trabajo a la consulta: los tiempos pueden salir un poco más altos que en una ejecución normal.',
    'Oracle no dice cuántas filas descartó un escaneo. Por eso la regla 1 mira los bloques leídos por cada fila devuelta.',
    'La memoria de trabajo la reparte Oracle (PGA): en lugar de SET work_mem se sugiere reducir lo que se ordena o revisar la PGA con el DBA.',
    'En los planes en paralelo (PX) los tiempos de los procesos se suman: se avisa y en esa parte no se compara la estimación de filas.',
  ],
  notes: [
    'No necesitas licencias extra: DBMS_XPLAN.DISPLAY_CURSOR viene con la base de datos. SQL Monitor sí pide el Tuning Pack, y Explica SQL no lo usa.',
    'Funciona con el formato de DBMS_XPLAN de Oracle 11g en adelante (19c, 21c, 23ai).',
  ],
  back: 'Volver al analizador',
};

const en: OracleGuideText = {
  title: 'Explica SQL with Oracle',
  description:
    'How to get a query’s real execution plan in Oracle with DBMS_XPLAN and analyze it in Explica SQL: step by step, privileges and what each column means.',
  lead: 'Oracle has no EXPLAIN ANALYZE. Its equivalent is the real statistics of each plan step, shown by DBMS_XPLAN. Explica SQL reads that text and gives the same analysis as with PostgreSQL: verdict, tree, findings and SQL in Oracle syntax.',
  stepsTitle: 'Step by Step',
  steps: [
    {
      text: 'Run your query with the GATHER_PLAN_STATISTICS hint and fetch every row. If the client only fetches the first page, the timings fall short.',
      code: 'SELECT /*+ GATHER_PLAN_STATISTICS */ c.name, SUM(o.total)\nFROM customers c JOIN orders o ON o.customer_id = c.id\nGROUP BY c.name;',
    },
    {
      text: 'In the same session, get the plan with the statistics of that last run:',
      code: "SELECT * FROM TABLE(DBMS_XPLAN.DISPLAY_CURSOR(NULL, NULL, 'ALLSTATS LAST +ALIAS'));",
    },
    {
      text: 'Copy the whole output, from SQL_ID to the end (including the Predicate Information section), and paste it into step 2 of Explica SQL. It’s recognized as Oracle on its own.',
    },
  ],
  example: 'Try an Oracle example',
  clientsTitle: 'Depending on Your Client',
  clients: [
    {
      name: 'SQL Developer',
      text: 'Run both commands with “Run Script” (F5) and copy the output. If you use the grid, scroll to the end of the result so every row is fetched before getting the plan.',
    },
    {
      name: 'DBeaver',
      text: 'On your query’s result use “Fetch all rows”; then run the DISPLAY_CURSOR and copy the whole PLAN_TABLE_OUTPUT column.',
    },
    {
      name: 'SQL*Plus',
      text: 'Before starting, SET LINESIZE 400 PAGESIZE 2000 and SET SERVEROUTPUT OFF. Otherwise the plan gets cut or DISPLAY_CURSOR shows another query.',
    },
    { name: 'Toad, PL/SQL Developer', text: 'Run the commands as a script and copy the text output.' },
  ],
  otherSqlTitle: 'If It Shows Another Query',
  otherSql:
    'DISPLAY_CURSOR(NULL, NULL, …) shows the last query of your session. If the client ran something in between, find your query’s SQL_ID and pass it:',
  otherSqlCode:
    "SELECT sql_id, child_number FROM v$sql\nWHERE sql_text LIKE 'SELECT /*+ GATHER_PLAN_STATISTICS */%'\n  AND sql_text NOT LIKE '%v$sql%';\n\nSELECT * FROM TABLE(DBMS_XPLAN.DISPLAY_CURSOR('the_sql_id', 0, 'ALLSTATS LAST +ALIAS'));",
  permissionsTitle: 'Privileges',
  permissions:
    'DISPLAY_CURSOR reads data dictionary views. If you get a privilege error, ask your DBA for read access to these views (or the SELECT_CATALOG_ROLE role):',
  permissionsCode:
    'GRANT SELECT ON V_$SQL TO your_user;\nGRANT SELECT ON V_$SQL_PLAN TO your_user;\nGRANT SELECT ON V_$SQL_PLAN_STATISTICS_ALL TO your_user;\nGRANT SELECT ON V_$SESSION TO your_user;',
  estimatesTitle: 'Without Privileges: Estimates Only',
  estimates:
    'EXPLAIN PLAN doesn’t run the query or need those privileges, but it only gives estimates. Explica SQL reads it and shows the tree, with no verdict or timings.',
  estimatesCode: 'EXPLAIN PLAN FOR SELECT … ;\n\nSELECT * FROM TABLE(DBMS_XPLAN.DISPLAY);',
  columnsTitle: 'What Each Column Means',
  columns: [
    { name: 'Starts', text: 'How many times the step ran: the loops.' },
    { name: 'E-Rows', text: 'Rows Oracle estimated for each run.' },
    { name: 'A-Rows', text: 'Real rows, adding up every run.' },
    { name: 'A-Time', text: 'Real time of the step and its children, in hundredths of a second.' },
    { name: 'Buffers', text: 'Blocks it requested, from memory or disk.' },
    { name: 'Reads', text: 'Blocks it had to read from disk.' },
    { name: 'Used-Mem, Used-Tmp', text: 'Memory a SORT or a HASH used, and the temporary space when it wasn’t enough.' },
  ],
  differencesTitle: 'Differences from PostgreSQL',
  differences: [
    'A-Time only has hundredths of a second: a query of 00:00:00.01 counts as fast, and for very fast steps the percentages are approximate.',
    'GATHER_PLAN_STATISTICS adds some work to the query: timings can come out a bit higher than in a normal run.',
    'Oracle doesn’t say how many rows a scan discarded. That’s why rule 1 looks at blocks read per row returned.',
    'Oracle hands out work memory (PGA): instead of SET work_mem, the suggestion is to sort less or review the PGA with your DBA.',
    'In parallel plans (PX) the processes’ times add up: there’s a notice, and the row estimate isn’t compared in that part.',
  ],
  notes: [
    'No extra licenses needed: DBMS_XPLAN.DISPLAY_CURSOR ships with the database. SQL Monitor does need the Tuning Pack, and Explica SQL doesn’t use it.',
    'Works with the DBMS_XPLAN format from Oracle 11g on (19c, 21c, 23ai).',
  ],
  back: 'Back to the analyzer',
};

export const oracleGuide: Record<Lang, OracleGuideText> = { es, en };
