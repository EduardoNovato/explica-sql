import { thresholds, type RuleId, type Severity } from '../engine';
import type { Lang } from './ui';

/** Mensajes de un hallazgo; las plantillas usan marcadores `{dato}` que llena la interfaz */
export interface RuleMessages {
  body: string;
  /** Mensaje cuando el hallazgo es alerta (regla 6) */
  bodyAlert?: string;
  fix: string;
  fixAlert?: string;
  /** Qué hacer cuando no hay SQL para sugerir */
  fixNoSql?: string;
}

/**
 * Textos de las 8 reglas: los hallazgos y la página de explicación de cada una. `oracle` reemplaza
 * los mensajes que en Oracle se dicen distinto; los marcadores de `page.when` salen de los umbrales
 * del motor.
 */
export interface RuleText extends RuleMessages {
  slug: string;
  title: string;
  short: string;
  oracle?: Partial<RuleMessages>;
  page: { what: string; when: string; why: string; how: string; oracle: string };
}

/** Numeración del plan: regla 1 a 8 */
export const ruleOrder: RuleId[] = [
  'seq-scan',
  'misestimate',
  'sort-disk',
  'hash-batches',
  'nested-loop',
  'cast-in-filter',
  'disk-reads',
  'dominant-node',
];

/** Severidad habitual de cada regla (la regla 6 es nota salvo que acompañe a la 1) */
export const ruleSeverity: Record<RuleId, Severity> = {
  'seq-scan': 'alert',
  misestimate: 'warning',
  'sort-disk': 'alert',
  'hash-batches': 'alert',
  'nested-loop': 'alert',
  'cast-in-filter': 'note',
  'disk-reads': 'warning',
  'dominant-node': 'alert',
};

/** Valores para los marcadores de "Cuándo salta" y "En Oracle" */
export const ruleThresholds: Record<RuleId, Record<string, number>> = {
  'seq-scan': { ...thresholds.seqScan, minBlocks: thresholds.oracleFullScan.minBlocks },
  misestimate: { ...thresholds.misestimate },
  'sort-disk': {},
  'hash-batches': {},
  'nested-loop': { ...thresholds.nestedLoop },
  'cast-in-filter': {},
  'disk-reads': { ...thresholds.diskReads },
  'dominant-node': { ...thresholds.dominantNode },
};

interface Example {
  plan: string;
  sql: string;
}

/** Ejemplos con tablas de TPC-H o inventadas: iguales en los dos idiomas */
export const ruleExamples: Record<RuleId, Example & { oracle: Example }> = {
  'seq-scan': {
    plan: `Seq Scan on orders  (cost=0.00..44076.00 rows=15 width=107) (actual time=12.418..185.330 rows=14 loops=1)
  Filter: (o_custkey = 74221)
  Rows Removed by Filter: 1499986`,
    sql: 'CREATE INDEX ON orders (o_custkey);',
    oracle: {
      plan: `| Id  | Operation         | Name   | Starts | E-Rows | A-Rows |   A-Time   | Buffers | Reads  |
|   0 | SELECT STATEMENT  |        |      1 |        |     14 |00:00:00.19 |   25076 |  23028 |
|*  1 |  TABLE ACCESS FULL| ORDERS |      1 |     15 |     14 |00:00:00.19 |   25076 |  23028 |

   1 - filter("O_CUSTKEY"=74221)`,
      sql: 'CREATE INDEX ORDERS_O_CUSTKEY_IX ON ORDERS (O_CUSTKEY);',
    },
  },
  misestimate: {
    plan: `Seq Scan on customer  (cost=0.00..5100.00 rows=12 width=8) (actual time=0.020..38.400 rows=6020 loops=1)
  Filter: ((c_nationkey = 7) AND (c_mktsegment = 'BUILDING'::bpchar))
  Rows Removed by Filter: 143980`,
    sql: `CREATE STATISTICS customer_c_nationkey_c_mktsegment_stats (dependencies) ON c_nationkey, c_mktsegment FROM customer;
ANALYZE customer;`,
    oracle: {
      plan: `| Id  | Operation         | Name     | Starts | E-Rows | A-Rows |   A-Time   | Buffers |
|   0 | SELECT STATEMENT  |          |      1 |        |   6020 |00:00:00.04 |    3600 |
|*  1 |  TABLE ACCESS FULL| CUSTOMER |      1 |     12 |   6020 |00:00:00.04 |    3600 |

   1 - filter(("C_NATIONKEY"=7 AND "C_MKTSEGMENT"='BUILDING'))`,
      sql: `SELECT DBMS_STATS.CREATE_EXTENDED_STATS(USER, 'CUSTOMER', '(C_NATIONKEY, C_MKTSEGMENT)') FROM dual;
BEGIN DBMS_STATS.GATHER_TABLE_STATS(USER, 'CUSTOMER'); END;`,
    },
  },
  'sort-disk': {
    plan: `Sort  (cost=412563.45..414063.45 rows=600000 width=24) (actual time=3105.226..3290.513 rows=541203 loops=1)
  Sort Key: l.l_shipdate
  Sort Method: external merge  Disk: 22016kB`,
    sql: `SET work_mem = '128MB';
CREATE INDEX ON lineitem (l_shipdate);`,
    oracle: {
      plan: `| Id  | Operation     | Name | Starts | E-Rows | A-Rows |   A-Time   | Used-Mem | Used-Tmp|
|   1 |  SORT ORDER BY|      |      1 |    600K|    541K|00:00:03.32 |   25M (1)|   22528 |`,
      sql: '',
    },
  },
  'hash-batches': {
    plan: `->  Hash  (cost=5852.00..5852.00 rows=150000 width=8) (actual time=195.880..195.881 rows=150000 loops=1)
      Buckets: 131072  Batches: 4  Memory Usage: 2466kB`,
    sql: `SET work_mem = '16MB';`,
    oracle: {
      plan: `| Id  | Operation   | Name | Starts | E-Rows | A-Rows |   A-Time   | Used-Mem | Used-Tmp|
|*  2 |   HASH JOIN |      |      1 |    600K|    541K|00:00:02.81 |   43M (1)|   80896 |`,
      sql: '',
    },
  },
  'nested-loop': {
    plan: `Nested Loop  (cost=0.00..1823412.00 rows=2000 width=12) (actual time=0.950..1520.442 rows=2000 loops=1)
  ->  Seq Scan on clientes c  (cost=0.00..35.00 rows=2000 width=8) (actual time=0.008..0.410 rows=2000 loops=1)
  ->  Seq Scan on pedidos p  (cost=0.00..911.00 rows=1 width=8) (actual time=0.380..0.758 rows=1 loops=2000)
        Filter: (p.cliente_id = c.id)
        Rows Removed by Filter: 49999`,
    sql: 'CREATE INDEX ON pedidos (cliente_id);',
    oracle: {
      plan: `| Id  | Operation          | Name     | Starts | E-Rows | A-Rows |   A-Time   |
|   1 |  NESTED LOOPS      |          |      1 |   2000 |   2000 |00:00:01.53 |
|   2 |   TABLE ACCESS FULL| CLIENTES |      1 |   2000 |   2000 |00:00:00.01 |
|*  3 |   TABLE ACCESS FULL| PEDIDOS  |   2000 |      1 |   2000 |00:00:01.52 |

   3 - filter("P"."CLIENTE_ID"="C"."ID")`,
      sql: 'CREATE INDEX PEDIDOS_CLIENTE_ID_IX ON PEDIDOS (CLIENTE_ID);',
    },
  },
  'cast-in-filter': {
    plan: `Seq Scan on pedidos  (cost=0.00..2350.00 rows=500 width=40) (actual time=0.900..48.700 rows=310 loops=1)
  Filter: (date(creado_en) = '2026-03-15'::date)
  Rows Removed by Filter: 99690`,
    sql: 'CREATE INDEX ON pedidos ((date(creado_en)));',
    oracle: {
      plan: `| Id  | Operation         | Name    | Starts | E-Rows | A-Rows |   A-Time   | Buffers |
|*  1 |  TABLE ACCESS FULL| PEDIDOS |      1 |      1 |      1 |00:00:00.42 |    6215 |

   1 - filter(TO_NUMBER("NUMERO")=4521)`,
      sql: 'CREATE INDEX PEDIDOS_TO_NUMBER_NUMERO_FN_IX ON PEDIDOS (TO_NUMBER(NUMERO));',
    },
  },
  'disk-reads': {
    plan: `Seq Scan on orders  (cost=0.00..44076.00 rows=15 width=107) (actual time=12.418..185.330 rows=14 loops=1)
  Buffers: shared hit=2048 read=23028`,
    sql: '',
    oracle: {
      plan: `| Id  | Operation         | Name   | Starts | A-Rows |   A-Time   | Buffers | Reads  |
|*  1 |  TABLE ACCESS FULL| ORDERS |      1 |     14 |00:00:00.19 |   25076 |  23028 |`,
      sql: '',
    },
  },
  'dominant-node': {
    plan: `Result  (cost=2841.20..2842.47 rows=1 width=512) (actual time=24.310..142.870 rows=3870 loops=1)
  ->  Sort  (cost=2841.20..2841.20 rows=1 width=480) (actual time=24.250..25.904 rows=3870 loops=1)`,
    sql: '',
    oracle: {
      plan: `| Id  | Operation           | Name     | Starts | A-Rows |   A-Time   |
|*  2 |   HASH JOIN         |          |      1 |    541K|00:00:02.81 |
|   3 |    TABLE ACCESS FULL| ORDERS   |      1 |   1500K|00:00:00.21 |
|*  4 |    TABLE ACCESS FULL| LINEITEM |      1 |    541K|00:00:02.12 |`,
      sql: '',
    },
  },
};

const es: Record<RuleId, RuleText> = {
  'seq-scan': {
    slug: 'escaneo-completo',
    title: 'Escaneo completo costoso',
    short: 'Lee toda la tabla para quedarse con muy pocas filas.',
    body: 'Lee toda la tabla {table} y descarta {removedRows} filas ({removedShare}) para quedarse con {keptRows}. Este paso se lleva el {timeShare} del tiempo.',
    fix: 'Un índice con las columnas del filtro ({columns}) permite ir directo a las filas que sirven.',
    fixNoSql: 'La columna del filtro va dentro de una función, así que un índice normal no sirve: revisa el hallazgo de la conversión.',
    oracle: {
      body: 'Lee toda la tabla {table} ({blocks} bloques) para devolver solo {keptRows} filas: casi todo lo que lee se descarta. Este paso se lleva el {timeShare} del tiempo.',
    },
    page: {
      what: 'Un Seq Scan recorre la tabla completa. Esta regla salta cuando además descarta casi todo lo que lee con el Filter y ese recorrido pesa en el tiempo total.',
      when: 'Descarta al menos el {minRemovedShare} de las filas que lee, son {minRemovedRows} filas o más y el paso se lleva al menos el {minTimeShare} del tiempo.',
      why: 'Leer millones de filas para devolver unas pocas gasta disco, memoria y CPU, y empeora a medida que la tabla crece: lo que hoy tarda 200 ms mañana tarda segundos.',
      how: 'Crea un índice con las columnas del Filter, empezando por las que se comparan con =. En tablas pequeñas, o cuando la consulta trae casi toda la tabla, PostgreSQL prefiere el Seq Scan y está bien: por eso la regla exige que descarte casi todo.',
      oracle:
        'Es un TABLE ACCESS FULL. Oracle no dice cuántas filas descartó, así que la señal es otra: el paso tiene un filter(), lee {minBlocks} bloques o más (Buffers) y devuelve menos de una fila cada dos bloques (A-Rows). En un bloque caben decenas de filas, así que eso solo pasa cuando casi todo se descarta. El índice sugerido lleva nombre, como exige Oracle.',
    },
  },
  misestimate: {
    slug: 'estimacion-errada',
    title: 'Estimación muy errada',
    short: 'El planificador esperaba muchas más o muchas menos filas de las que salieron.',
    body: 'El planificador esperaba {estimatedRows} filas aquí y salieron {actualRows}: se equivocó {factor}.',
    fix: 'Con estadísticas al día elige mejor cómo leer y unir las tablas. Corre ANALYZE; si el filtro combina columnas que dependen entre sí, crea estadísticas extendidas.',
    oracle: {
      fix: 'Con estadísticas al día, Oracle elige mejor cómo leer y unir las tablas. Actualízalas con DBMS_STATS; si el filtro combina columnas que dependen entre sí, crea estadísticas extendidas.',
    },
    page: {
      what: 'Compara las filas que el planificador estimó (rows= dentro de cost) con las que realmente salieron (rows= dentro de actual). Reporta solo el paso donde nace el error, no los de arriba que lo heredan.',
      when: 'La diferencia es de {minFactor} veces o más y salieron al menos {minActualRows} filas reales. No cuenta lo que se dejó de leer por un LIMIT.',
      why: 'Todo el plan se elige con esas estimaciones: con una cifra muy baja, PostgreSQL puede escoger un Nested Loop que da miles de vueltas; con una muy alta, leer la tabla completa.',
      how: 'Primero ANALYZE de la tabla. Si la condición combina columnas relacionadas (ciudad y país, por ejemplo), CREATE STATISTICS ayuda. Si el filtro usa funciones, el planificador no puede estimarlas: reescribe la condición.',
      oracle:
        'Compara E-Rows (estimadas por ejecución) multiplicadas por Starts con A-Rows (reales, sumando todas las ejecuciones). En la parte paralela del plan (bajo PX) no se compara, porque ahí E-Rows es el total. Se arregla con DBMS_STATS.GATHER_TABLE_STATS y, para columnas relacionadas, con DBMS_STATS.CREATE_EXTENDED_STATS.',
    },
  },
  'sort-disk': {
    slug: 'ordenamiento-en-disco',
    title: 'Ordenamiento en disco',
    short: 'El ordenamiento no cupo en memoria y tuvo que usar archivos temporales.',
    body: 'El ordenamiento por {sortKey} no cupo en work_mem y escribió {diskKb} en disco.',
    fix: 'Sube work_mem solo para tu sesión ({workMem}, unas tres veces lo que bajó a disco) o crea un índice que entregue las filas ya ordenadas.',
    oracle: {
      body: 'El ordenamiento no cupo en la memoria de trabajo (PGA) y usó {diskKb} de espacio temporal.',
      fix: 'En Oracle esa memoria la reparte el servidor (PGA_AGGREGATE_TARGET), así que no se cambia por sesión: ordena menos filas o columnas, o crea un índice con las columnas del ORDER BY para que Oracle no tenga que ordenar. Si pasa seguido, revisa la PGA con el DBA.',
    },
    page: {
      what: 'Sort Method: external merge significa que el ordenamiento no cupo en work_mem y se hizo por partes, en archivos temporales.',
      when: 'Siempre que el plan diga external merge o external sort con Disk.',
      why: 'Escribir y volver a leer del disco es mucho más lento que ordenar en memoria, y con varias consultas a la vez todas compiten por el disco.',
      how: 'SET work_mem solo en tu sesión sirve para probar si alcanza. No lo subas para todo el servidor sin calcular: cada ordenamiento de cada conexión puede usar esa memoria. Si el orden coincide con un índice, PostgreSQL puede saltarse el Sort.',
      oracle:
        'Se ve como un SORT (ORDER BY, GROUP BY, UNIQUE o JOIN) con valor en la columna Used-Tmp: la memoria de trabajo (PGA) no alcanzó y usó espacio temporal. Oracle reparte esa memoria solo (PGA_AGGREGATE_TARGET), así que no hay un work_mem por sesión: se reduce lo que se ordena, se ordena con un índice o el DBA revisa la PGA.',
    },
  },
  'hash-batches': {
    slug: 'hash-en-lotes',
    title: 'Hash que no cabe en memoria',
    short: 'La tabla hash de un join o de un GROUP BY se partió en lotes que pasan por disco.',
    body: 'La tabla hash no cupo en memoria y se partió en {batches} lotes que pasan por disco.',
    fix: 'Sube work_mem para tu sesión ({workMem}) o trae menos columnas del lado que se carga en el hash.',
    oracle: {
      body: 'La tabla hash no cupo en la memoria de trabajo (PGA) y usó {diskKb} de espacio temporal.',
      fix: 'Trae menos columnas o filas del lado que se carga en memoria (la primera tabla del HASH JOIN), o filtra antes del join. Si pasa seguido, revisa la PGA con el DBA.',
    },
    page: {
      what: 'Un Hash Join carga una de las tablas en memoria y un HashAggregate agrupa en memoria. Si Batches es mayor que 1, no cupo y se repartió en lotes en disco.',
      when: 'Siempre que Batches sea mayor que 1.',
      why: 'Cada lote extra escribe y relee filas del disco. Además, si dice Batches: 4 (originally 1), la estimación de filas se quedó corta.',
      how: 'Más work_mem (o hash_mem_multiplier) para tu sesión, o menos columnas en el SELECT del lado que se carga en el hash. Si la estimación estaba errada, revisa también las estadísticas.',
      oracle:
        'Se ve como un HASH JOIN, HASH GROUP BY o HASH UNIQUE con valor en Used-Tmp. Como la memoria de trabajo la reparte Oracle (PGA), la salida es traer menos datos al hash: menos columnas, filtrar antes del join o, si pasa seguido, que el DBA revise la PGA.',
    },
  },
  'nested-loop': {
    slug: 'nested-loop-costoso',
    title: 'Nested Loop costoso',
    short: 'El join recorre una tabla completa por cada fila del otro lado.',
    body: 'El lado interno del join se repite {loops} veces y en cada vuelta lee completa la tabla {table}. Se lleva el {timeShare} del tiempo.',
    fix: 'Un índice en la columna del join ({columns}) cambia cada lectura completa por una búsqueda directa.',
    fixNoSql: 'Un índice en la columna con la que se une {table} cambia cada lectura completa por una búsqueda directa.',
    page: {
      what: 'Un Nested Loop ejecuta su lado interno una vez por cada fila del lado externo (loops). Si el lado interno es un Seq Scan, la tabla se lee completa una y otra vez.',
      when: 'El escaneo completo del lado interno da {minInnerLoops} vueltas o más. Si se lee una sola vez y se guarda en memoria (Materialize), no cuenta.',
      why: 'El costo crece como filas × filas: 2.000 clientes contra 50.000 pedidos son 100 millones de filas leídas.',
      how: 'Crea un índice en la columna del join de la tabla interna. Con él, cada vuelta es una búsqueda por índice, o PostgreSQL cambia a un Hash Join.',
      oracle:
        'Se ve como un NESTED LOOPS cuyo segundo hijo es un TABLE ACCESS FULL con Starts de {minInnerLoops} o más. Para sugerir la columna exacta del índice ayuda el formato +ALIAS, que dice qué alias corresponde a cada tabla.',
    },
  },
  'cast-in-filter': {
    slug: 'conversion-en-filtro',
    title: 'Conversión o función sobre la columna',
    short: 'El filtro transforma la columna antes de compararla.',
    body: 'El filtro transforma la columna: {expressions}. Aquí no causa problemas (de varchar a text, por ejemplo, es automático), pero un índice normal no serviría para esta condición.',
    bodyAlert: 'El filtro envuelve la columna en {expressions}, así que un índice normal no sirve y la tabla se lee completa.',
    fix: 'Nada que hacer por ahora. Si la tabla crece, compara con el mismo tipo de la columna.',
    fixAlert: 'Compara con el mismo tipo de la columna, cambia la función por un rango (fecha >= … AND fecha < …) o crea un índice de expresión.',
    oracle: {
      body: 'El filtro transforma la columna: {expressions}. Aquí no causa problemas, pero un índice normal no serviría para esta condición. Si es TO_NUMBER, TO_CHAR o INTERNAL_FUNCTION, suele ser una conversión implícita: la columna se compara con otro tipo de dato.',
      bodyAlert:
        'El filtro envuelve la columna en {expressions}, así que un índice normal no sirve y la tabla se lee completa. Si es TO_NUMBER, TO_CHAR o INTERNAL_FUNCTION, Oracle está convirtiendo la columna porque se compara con otro tipo de dato.',
      fixAlert:
        "Compara con el mismo tipo de la columna (si es VARCHAR2, usa columna = '4521' y no columna = 4521), cambia la función por un rango (fecha >= … AND fecha < … en vez de TRUNC(fecha)) o crea un índice de función.",
    },
    page: {
      what: 'Busca en el Filter columnas convertidas, como (columna)::text, o envueltas en funciones, como date(columna) o lower(columna).',
      when: 'Es alerta solo si el mismo paso es un escaneo completo costoso (regla 1). Si no, queda como nota informativa.',
      why: 'Un índice guarda los valores de la columna tal cual: si la condición compara date(creado_en), el índice de creado_en no sirve. Muchas conversiones son inofensivas (de varchar a text), por eso no alarma de entrada.',
      how: "Compara con el tipo correcto (WHERE id = 5, no id::text = '5'), usa rangos en vez de funciones sobre fechas o crea un índice de expresión con la misma función.",
      oracle:
        'En Oracle aparecen en filter() como TO_NUMBER("COL"), TO_CHAR("COL"), TRUNC("FECHA"), NVL("COL", …) o INTERNAL_FUNCTION("COL"). Las conversiones implícitas son la causa más común: una columna VARCHAR2 comparada con un número hace que Oracle aplique TO_NUMBER a cada fila y deje de usar el índice.',
    },
  },
  'disk-reads': {
    slug: 'lectura-de-disco',
    title: 'Mucha lectura desde disco',
    short: 'Casi todo lo que leyó vino del disco y no de la memoria.',
    body: 'Leyó {readBlocks} bloques desde disco ({readMb}) y encontró {hitBlocks} en memoria.',
    fix: 'Puede ser caché fría: repite la medición. Si se mantiene, lee menos (con un índice) o dale más memoria a shared_buffers.',
    oracle: {
      fix: 'Puede ser caché fría: repite la medición. Si se mantiene, lee menos (con un índice) o revisa con el DBA el tamaño del buffer cache.',
    },
    page: {
      what: 'Con BUFFERS, cada paso dice cuántos bloques de 8 kB encontró en memoria (shared hit) y cuántos tuvo que leer del disco (shared read). La regla cuenta solo lo del propio paso, sin los que tiene adentro.',
      when: 'Lee {minReadBlocks} bloques o más desde disco y al menos {minReadToHitRatio} veces lo que encontró en memoria.',
      why: 'El disco es mucho más lento que la memoria. Pero la primera ejecución de una consulta siempre lee más del disco: por eso es aviso y no alerta.',
      how: 'Repite el EXPLAIN: si la segunda vez sale shared hit, era caché fría. Si no, reduce lo que se lee con un índice o revisa si shared_buffers se quedó pequeño para tus datos.',
      oracle:
        'Compara Reads (bloques leídos del disco) con Buffers (bloques pedidos en total), solo en los pasos que leen tablas o índices: lo que un SORT relee de su espacio temporal ya lo cubre la regla 3. Los escaneos completos grandes suelen leer directo del disco (direct path read), así que en tablas grandes es normal que casi todo sea Reads.',
    },
  },
  'dominant-node': {
    slug: 'paso-dominante',
    title: 'Paso dominante',
    short: 'Un solo paso se lleva la mayor parte del tiempo: empieza por ahí.',
    body: '{node} se lleva el {timeShare} del tiempo ({selfMs}). Empieza por aquí.',
    fix: 'Mira sus datos en el árbol y los otros hallazgos de este paso.',
    page: {
      what: 'Calcula el tiempo propio de cada paso (su tiempo menos el de los pasos que tiene adentro) y señala el que se lleva la mayor parte.',
      when: 'Un paso se lleva el {minTimeShare} del tiempo o más y la consulta tarda {minTotalMs} o más.',
      why: 'Optimizar un paso que pesa el 5 % no se nota. Empezar por el que pesa más da el mayor beneficio con menos esfuerzo.',
      how: 'Revisa el tipo de paso y sus datos: si es un escaneo, ¿descarta mucho? Si es un Sort o un Hash, ¿fue a disco? Si es un Result, ¿hay funciones en el SELECT?',
      oracle:
        'Usa el A-Time propio de cada paso: su A-Time menos el de sus hijos. A-Time solo tiene centésimas de segundo, así que en pasos muy rápidos el porcentaje es aproximado.',
    },
  },
};

const en: Record<RuleId, RuleText> = {
  'seq-scan': {
    slug: 'full-table-scan',
    title: 'Costly Full Table Scan',
    short: 'Reads the whole table to keep very few rows.',
    body: 'Reads the whole {table} table and throws away {removedRows} rows ({removedShare}) to keep {keptRows}. This step takes {timeShare} of the time.',
    fix: 'An index on the filter columns ({columns}) lets PostgreSQL go straight to the rows it needs.',
    fixNoSql: 'The filter column is wrapped in a function, so a plain index won’t help: see the conversion finding.',
    oracle: {
      body: 'Reads the whole {table} table ({blocks} blocks) to return only {keptRows} rows: almost everything it reads is thrown away. This step takes {timeShare} of the time.',
      fix: 'An index on the filter columns ({columns}) lets Oracle go straight to the rows it needs.',
    },
    page: {
      what: 'A Seq Scan reads the entire table. This rule fires when it also throws away almost everything it reads through the Filter, and that scan weighs on the total time.',
      when: 'It removes at least {minRemovedShare} of the rows it reads, that is {minRemovedRows} rows or more, and the step takes at least {minTimeShare} of the time.',
      why: 'Reading millions of rows to return a few wastes disk, memory and CPU, and gets worse as the table grows: what takes 200 ms today takes seconds tomorrow.',
      how: 'Create an index on the Filter columns, starting with the ones compared with =. On small tables, or when the query returns most of the table, PostgreSQL prefers the Seq Scan and that’s fine: that’s why the rule requires it to discard almost everything.',
      oracle:
        'It’s a TABLE ACCESS FULL. Oracle doesn’t say how many rows it discarded, so the signal is different: the step has a filter(), reads {minBlocks} blocks or more (Buffers) and returns less than one row every two blocks (A-Rows). A block holds dozens of rows, so that only happens when almost everything is discarded. The suggested index has a name, as Oracle requires.',
    },
  },
  misestimate: {
    slug: 'row-misestimate',
    title: 'Row Estimate Way Off',
    short: 'The planner expected far more or far fewer rows than it got.',
    body: 'The planner expected {estimatedRows} rows here and got {actualRows}: off by {factor}.',
    fix: 'With fresh statistics it picks better ways to read and join tables. Run ANALYZE; if the filter combines columns that depend on each other, create extended statistics.',
    oracle: {
      fix: 'With fresh statistics, Oracle picks better ways to read and join tables. Refresh them with DBMS_STATS; if the filter combines columns that depend on each other, create extended statistics.',
    },
    page: {
      what: 'Compares the rows the planner estimated (rows= inside cost) with the rows that actually came out (rows= inside actual). It reports only the step where the error starts, not the ones above that inherit it.',
      when: 'The difference is {minFactor} times or more and at least {minActualRows} real rows came out. Rows left unread because of a LIMIT don’t count.',
      why: 'The whole plan is chosen from those estimates: too low and PostgreSQL may pick a Nested Loop that runs thousands of times; too high and it may read the whole table.',
      how: 'Start with ANALYZE on the table. If the condition combines related columns (city and country, for example), CREATE STATISTICS helps. If the filter uses functions, the planner can’t estimate them: rewrite the condition.',
      oracle:
        'Compares E-Rows (estimated per execution) times Starts with A-Rows (real, adding up every execution). In the parallel part of the plan (under PX) it doesn’t compare, because there E-Rows is the total. Fix it with DBMS_STATS.GATHER_TABLE_STATS and, for related columns, DBMS_STATS.CREATE_EXTENDED_STATS.',
    },
  },
  'sort-disk': {
    slug: 'sort-on-disk',
    title: 'Sort Spilled to Disk',
    short: 'The sort didn’t fit in memory and had to use temporary files.',
    body: 'Sorting by {sortKey} didn’t fit in work_mem and wrote {diskKb} to disk.',
    fix: 'Raise work_mem for your session only ({workMem}, about three times what went to disk) or add an index that returns the rows already sorted.',
    oracle: {
      body: 'The sort didn’t fit in work memory (PGA) and used {diskKb} of temporary space.',
      fix: 'In Oracle the server hands out that memory (PGA_AGGREGATE_TARGET), so it isn’t changed per session: sort fewer rows or columns, or create an index with the ORDER BY columns so Oracle doesn’t have to sort. If it happens often, review the PGA with your DBA.',
    },
    page: {
      what: 'Sort Method: external merge means the sort didn’t fit in work_mem and was done in pieces, in temporary files.',
      when: 'Whenever the plan says external merge or external sort with Disk.',
      why: 'Writing to disk and reading it back is much slower than sorting in memory, and with several queries at once they all compete for the disk.',
      how: 'SET work_mem in your session only is a good way to test whether it’s enough. Don’t raise it for the whole server without doing the math: every sort on every connection can use that memory. If the order matches an index, PostgreSQL can skip the Sort.',
      oracle:
        'It shows up as a SORT (ORDER BY, GROUP BY, UNIQUE or JOIN) with a value in the Used-Tmp column: work memory (PGA) wasn’t enough and it used temporary space. Oracle hands out that memory by itself (PGA_AGGREGATE_TARGET), so there’s no per-session work_mem: sort less, sort with an index, or have your DBA review the PGA.',
    },
  },
  'hash-batches': {
    slug: 'hash-batches',
    title: 'Hash Too Big for Memory',
    short: 'The hash table of a join or a GROUP BY was split into batches that go through disk.',
    body: 'The hash table didn’t fit in memory and was split into {batches} batches that go through disk.',
    fix: 'Raise work_mem for your session ({workMem}) or bring fewer columns from the side loaded into the hash.',
    oracle: {
      body: 'The hash table didn’t fit in work memory (PGA) and used {diskKb} of temporary space.',
      fix: 'Bring fewer columns or rows from the side loaded into memory (the first table of the HASH JOIN), or filter before the join. If it happens often, review the PGA with your DBA.',
    },
    page: {
      what: 'A Hash Join loads one of the tables into memory, and a HashAggregate groups in memory. If Batches is greater than 1, it didn’t fit and was split into batches on disk.',
      when: 'Whenever Batches is greater than 1.',
      why: 'Every extra batch writes rows to disk and reads them back. Also, if it says Batches: 4 (originally 1), the row estimate fell short.',
      how: 'More work_mem (or hash_mem_multiplier) for your session, or fewer columns in the SELECT from the side loaded into the hash. If the estimate was off, check the statistics too.',
      oracle:
        'It shows up as a HASH JOIN, HASH GROUP BY or HASH UNIQUE with a value in Used-Tmp. Since Oracle hands out work memory (PGA), the way out is bringing less data into the hash: fewer columns, filtering before the join or, if it happens often, having your DBA review the PGA.',
    },
  },
  'nested-loop': {
    slug: 'costly-nested-loop',
    title: 'Costly Nested Loop',
    short: 'The join scans a whole table for every row on the other side.',
    body: 'The inner side of the join runs {loops} times and reads the whole {table} table each time. It takes {timeShare} of the time.',
    fix: 'An index on the join column ({columns}) turns each full read into a direct lookup.',
    fixNoSql: 'An index on the column {table} is joined on turns each full read into a direct lookup.',
    page: {
      what: 'A Nested Loop runs its inner side once for every row on the outer side (loops). If the inner side is a Seq Scan, the table is read in full again and again.',
      when: 'The full scan on the inner side runs {minInnerLoops} times or more. If it’s read once and kept in memory (Materialize), it doesn’t count.',
      why: 'The cost grows as rows × rows: 2,000 customers against 50,000 orders is 100 million rows read.',
      how: 'Create an index on the join column of the inner table. With it, each loop becomes an index lookup, or PostgreSQL switches to a Hash Join.',
      oracle:
        'It shows up as a NESTED LOOPS whose second child is a TABLE ACCESS FULL with Starts of {minInnerLoops} or more. The +ALIAS format helps suggest the exact index column, since it tells which alias belongs to each table.',
    },
  },
  'cast-in-filter': {
    slug: 'cast-in-filter',
    title: 'Cast or Function on the Column',
    short: 'The filter transforms the column before comparing it.',
    body: 'The filter transforms the column: {expressions}. It causes no trouble here (varchar to text, for example, is automatic), but a plain index wouldn’t work for this condition.',
    bodyAlert: 'The filter wraps the column in {expressions}, so a plain index can’t be used and the whole table is read.',
    fix: 'Nothing to do for now. If the table grows, compare against the column’s own type.',
    fixAlert: 'Compare against the column’s own type, replace the function with a range (date >= … AND date < …) or create an expression index.',
    oracle: {
      body: 'The filter transforms the column: {expressions}. It causes no trouble here, but a plain index wouldn’t work for this condition. TO_NUMBER, TO_CHAR or INTERNAL_FUNCTION usually mean an implicit conversion: the column is compared with another data type.',
      bodyAlert:
        'The filter wraps the column in {expressions}, so a plain index can’t be used and the whole table is read. With TO_NUMBER, TO_CHAR or INTERNAL_FUNCTION, Oracle is converting the column because it’s compared with another data type.',
      fixAlert:
        "Compare against the column’s own type (for a VARCHAR2, use column = '4521', not column = 4521), replace the function with a range (date >= … AND date < … instead of TRUNC(date)) or create a function-based index.",
    },
    page: {
      what: 'Looks in the Filter for columns that are cast, like (column)::text, or wrapped in functions, like date(column) or lower(column).',
      when: 'It’s an alert only if the same step is a costly full table scan (rule 1). Otherwise it stays as an informational note.',
      why: 'An index stores the column values as they are: if the condition compares date(created_at), the index on created_at can’t be used. Many casts are harmless (varchar to text), so it doesn’t raise an alarm by default.',
      how: "Compare with the right type (WHERE id = 5, not id::text = '5'), use ranges instead of functions on dates, or create an expression index with the same function.",
      oracle:
        'In Oracle they show up in filter() as TO_NUMBER("COL"), TO_CHAR("COL"), TRUNC("DATE_COL"), NVL("COL", …) or INTERNAL_FUNCTION("COL"). Implicit conversions are the most common cause: a VARCHAR2 column compared with a number makes Oracle apply TO_NUMBER to every row and stop using the index.',
    },
  },
  'disk-reads': {
    slug: 'disk-reads',
    title: 'Heavy Disk Reads',
    short: 'Almost everything it read came from disk, not from memory.',
    body: 'Read {readBlocks} blocks from disk ({readMb}) and found {hitBlocks} in memory.',
    fix: 'It may be a cold cache: run it again. If it stays, read less (with an index) or give shared_buffers more memory.',
    oracle: {
      fix: 'It may be a cold cache: run it again. If it stays, read less (with an index) or review the buffer cache size with your DBA.',
    },
    page: {
      what: 'With BUFFERS, every step says how many 8 kB blocks it found in memory (shared hit) and how many it had to read from disk (shared read). The rule counts only the step’s own reads, not the steps inside it.',
      when: 'It reads {minReadBlocks} blocks or more from disk, and at least {minReadToHitRatio} times what it found in memory.',
      why: 'Disk is much slower than memory. But the first run of a query always reads more from disk: that’s why this is a warning, not an alert.',
      how: 'Run the EXPLAIN again: if the second time shows shared hit, it was a cold cache. If not, read less with an index or check whether shared_buffers is too small for your data.',
      oracle:
        'Compares Reads (blocks read from disk) with Buffers (blocks requested in total), only on steps that read tables or indexes: what a SORT reads back from its temporary space is covered by rule 3. Big full scans often read straight from disk (direct path read), so on large tables it’s normal for almost everything to be Reads.',
    },
  },
  'dominant-node': {
    slug: 'dominant-step',
    title: 'Dominant Step',
    short: 'A single step takes most of the time: start there.',
    body: '{node} takes {timeShare} of the time ({selfMs}). Start here.',
    fix: 'Check its data in the tree and the other findings for this step.',
    page: {
      what: 'Computes each step’s own time (its time minus the time of the steps inside it) and points to the one that takes most of it.',
      when: 'A step takes {minTimeShare} of the time or more and the query takes {minTotalMs} or more.',
      why: 'Speeding up a step that weighs 5% won’t show. Starting with the heaviest one gives the biggest win for the least effort.',
      how: 'Look at the step type and its data: if it’s a scan, does it discard a lot? If it’s a Sort or a Hash, did it go to disk? If it’s a Result, are there functions in the SELECT?',
      oracle:
        'It uses each step’s own A-Time: its A-Time minus its children’s. A-Time only has hundredths of a second, so for very fast steps the percentage is approximate.',
    },
  },
};

/** Pistas extra que el motor marca en `data.hint`; las que terminan en `-oracle` reemplazan a la general en Oracle */
export const ruleHints: Record<Lang, Record<string, string>> = {
  es: {
    functions:
      "El filtro usa funciones y el planificador no puede saber qué devuelven, así que ANALYZE no lo arregla. Si es un filtro opcional del tipo columna LIKE función(parámetro, '%'), agrega la condición solo cuando venga el parámetro.",
    'functions-oracle':
      "El filtro usa funciones y Oracle no puede saber qué devuelven, así que DBMS_STATS no lo arregla. Si es un filtro opcional del tipo columna LIKE NVL(parámetro, '%'), agrega la condición solo cuando venga el parámetro.",
    'select-functions':
      'Este Result solo calcula las columnas del SELECT, así que el tiempo se va en funciones o subconsultas que corren por cada fila. Córrelo con EXPLAIN (ANALYZE, BUFFERS, VERBOSE) para ver en Output qué calcula, y cámbialo por un JOIN.',
  },
  en: {
    functions:
      "The filter uses functions and the planner can’t know what they return, so ANALYZE won’t fix it. If it’s an optional filter like column LIKE function(parameter, '%'), add the condition only when the parameter is given.",
    'functions-oracle':
      "The filter uses functions and Oracle can’t know what they return, so DBMS_STATS won’t fix it. If it’s an optional filter like column LIKE NVL(parameter, '%'), add the condition only when the parameter is given.",
    'select-functions':
      'This Result only computes the SELECT columns, so the time goes into functions or subqueries that run for every row. Run it with EXPLAIN (ANALYZE, BUFFERS, VERBOSE) to see in Output what it computes, and replace it with a JOIN.',
  },
};

export const ruleTexts: Record<Lang, Record<RuleId, RuleText>> = { es, en };

export const rulePath = (lang: Lang, rule: RuleId) =>
  `${lang === 'es' ? '/reglas/' : '/en/rules/'}${ruleTexts[lang][rule].slug}/`;
