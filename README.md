# Explica SQL

Pega el plan de ejecución de tu consulta, el `EXPLAIN ANALYZE` de PostgreSQL o el `DBMS_XPLAN` de Oracle,
y en milisegundos te dice si es lenta, dónde se va el tiempo y qué hacer, con el SQL listo para copiar.
En español e inglés.

> **Estado:** en construcción. Ya se puede pegar un plan de PostgreSQL u Oracle, ver el veredicto, el
> árbol y los hallazgos con el SQL para copiar, y compartir el resultado con un link temporal. Falta
> publicarla.

## Cómo se usa

1. Ejecuta tu consulta:
   - **PostgreSQL:** `EXPLAIN (ANALYZE, BUFFERS) SELECT …` en psql, DBeaver o pgAdmin.
   - **Oracle:** la consulta con el hint `/*+ GATHER_PLAN_STATISTICS */` y, en la misma sesión,
     `SELECT * FROM TABLE(DBMS_XPLAN.DISPLAY_CURSOR(NULL, NULL, 'ALLSTATS LAST +ALIAS'))`.
     La guía `/oracle/` explica permisos, clientes y columnas.
2. Pega el resultado en la página: detecta solo si es PostgreSQL (texto o JSON) u Oracle, y se analiza
   al pegarlo.
3. Revisa el veredicto, el árbol con el tiempo propio de cada paso y los hallazgos, cada uno con qué
   hacer y el SQL listo para copiar. Cada regla tiene su página de explicación en `/reglas/`.

Para ver un ejemplo sin pegar nada, abre la página con `#ejemplo` (o `#ejemplo-oracle`) al final de la
dirección.

El análisis corre en tu navegador: el plan no sale de tu computadora.

## Compartir

El botón **Compartir** crea un link corto (`/s/k7Pq2x`) que dura 2 o 4 horas y después se borra solo.

- Se guarda el texto del plan y la versión de las reglas; quien abre el link lo ve analizado igual.
- Antes de compartir se puede **ocultar los valores literales**: los textos y números de las condiciones
  pasan a `?` en el navegador, antes de enviar nada. El análisis no cambia.
- Solo se aceptan planes que el motor puede leer, de hasta 512 kB, y 20 links por hora por IP.
- Las páginas compartidas no se indexan ni se guardan en caché.

Los links viven en Redis de [Upstash](https://upstash.com) con TTL. Para activarlo, copia
`.env.example` a `.env` y llena `UPSTASH_REDIS_REST_URL` y `UPSTASH_REDIS_REST_TOKEN` (o conecta Upstash
desde el Marketplace de Vercel, que crea `KV_REST_API_URL` y `KV_REST_API_TOKEN`). Sin esas variables,
`npm run dev` guarda los links en memoria.

## Oracle

Oracle no tiene `EXPLAIN ANALYZE`: su equivalente son las estadísticas reales de cada paso que muestra
`DBMS_XPLAN.DISPLAY_CURSOR` con `ALLSTATS LAST` (Starts, E-Rows, A-Rows, A-Time, Buffers, Reads,
Used-Tmp). Explica SQL lee ese texto y aplica las mismas reglas, con lo que cambia en Oracle:

- A-Rows y A-Time son totales de todas las ejecuciones; se comparan por ejecución con E-Rows.
- Oracle no dice cuántas filas descartó un escaneo: la regla 1 mira los bloques leídos por fila devuelta.
- A-Time va de 10 en 10 ms, así que lo que no pasa de 10 ms cuenta como rápido.
- El SQL sugerido usa sintaxis de Oracle: índices con nombre y `DBMS_STATS`. No se sugiere memoria por
  sesión, porque la PGA la reparte el servidor.
- Avisa si faltan las estadísticas de ejecución, si Oracle muestreó por falta de estadísticas, si el plan
  es paralelo o si el cliente trajo solo la primera página de filas.

También lee `EXPLAIN PLAN` + `DBMS_XPLAN.DISPLAY`, pero eso solo trae estimaciones.

## Qué revisa

Primero da un veredicto por el tiempo de ejecución: rápida (< 10 ms), aceptable (hasta 100 ms), lenta
(hasta 1 s) o muy lenta. Una consulta rápida solo recibe notas, nunca alertas. Después aplica 8 reglas
con umbrales conservadores, para no dar falsas alarmas:

| # | Regla | Se activa si… |
| --- | --- | --- |
| 1 | Escaneo completo costoso | un `Seq Scan` descarta ≥ 90 % de lo que lee, ≥ 1.000 filas, y pesa ≥ 20 % del tiempo |
| 2 | Estimación muy errada | las filas reales difieren ≥ 10× de las estimadas, con ≥ 1.000 filas reales |
| 3 | Ordenamiento en disco | `Sort Method: external merge  Disk: …` |
| 4 | Hash que no cabe en memoria | `Batches:` mayor que 1 |
| 5 | Nested Loop costoso | el lado interno da ≥ 1.000 vueltas con un escaneo completo |
| 6 | Conversión o función sobre la columna | `(columna)::tipo` o `date(columna)` en el `Filter` |
| 7 | Mucha lectura desde disco | `shared read` ≥ 10.000 bloques y ≥ 10× `shared hit` |
| 8 | Paso dominante | un paso se lleva ≥ 50 % del tiempo en una consulta de ≥ 100 ms |

También avisa si falta `ANALYZE` o `BUFFERS`, si no arrancaron los workers planeados o si planificar
tardó más que ejecutar. Lee texto (DBeaver, pgAdmin, psql) y JSON.

## Medición

### Velocidad del motor

`npm run bench` mide cuánto tarda el análisis completo (leer, armar el árbol, calcular tiempos y
aplicar las reglas) con planes grandes. Corre en cada cambio en GitHub Actions, deja la tabla en el
resumen del job y falla si la mediana pasa de la meta: **un plan de 1.000 pasos en menos de 20 ms**.
Como los runners son más lentos que un portátil, en CI falla solo si pasa del doble (`BENCH_TOLERANCE=2`).

| Plan | Tamaño | Mediana | p95 |
| --- | --- | --- | --- |
| PostgreSQL texto · 1.001 pasos | 179 kB | 5,5 ms | 7,4 ms |
| PostgreSQL JSON · 1.001 pasos | 485 kB | 9,8 ms | 11,5 ms |
| Oracle DBMS_XPLAN · 1.000 pasos | 131 kB | 10,9 ms | 13,8 ms |
| PostgreSQL texto · 1.000 niveles anidados (peor caso, ~6 MB) | 5.945 kB | 38,9 ms | 45,2 ms |

<sub>Node 22.17 en un portátil con Windows 11, 60 corridas. Los planes son sintéticos y siempre iguales
(`bench/plans.ts`).</sub>

### Caso basado en TPC-H

`npm run tpch` corre las 22 consultas de TPC-H, deja que Explica SQL las diagnostique, aplica
**exactamente el SQL que sugiere** y vuelve a medir. Corre en PostgreSQL 18 compilado a WebAssembly
([PGlite](https://pglite.dev)), así que se repite con un solo comando y sin instalar una base de datos.
Con factor de escala 0,1 (600 mil líneas de pedido):

| Consulta | Antes | SQL que sugirió Explica SQL | Después | Mejora |
| --- | --- | --- | --- | --- |
| Q20 · Promoción de partes | 238,5 s | `CREATE INDEX ON lineitem (l_partkey, l_suppkey, l_shipdate);` | 25,7 ms | 9.266× |
| Q17 · Ingreso de pedidos pequeños | 24,3 s | `CREATE INDEX ON lineitem (l_partkey);` | 1 s | 24× |
| Q19 · Ingreso con descuento | 415 ms | `CREATE INDEX ON lineitem (l_shipmode, l_shipinstruct, l_quantity);` | 45,3 ms | 9,2× |
| Q15 · Proveedor principal | 151,7 ms | `CREATE INDEX ON lineitem (l_shipdate);` | 40,3 ms | 3,8× |
| Q14 · Efecto de las promociones | 121,6 ms | `CREATE INDEX ON lineitem (l_shipdate);` | 58,3 ms | 2,1× |
| Q12 · Modo de envío y prioridad | 241,2 ms | `CREATE INDEX ON lineitem (l_shipmode, l_receiptdate);` | 143,9 ms | 1,7× |
| Q06 · Ingreso previsto | 122,8 ms | `CREATE INDEX ON lineitem (l_shipdate);` | 82,4 ms | 1,5× |

Lo que no funcionó también cuenta:

- En Q09 y Q21 la sugerencia (más `work_mem`, `ANALYZE`) no cambió el tiempo. Las estadísticas ya
  estaban al día y el error de estimación nace en los joins. Por eso la regla 2 ahora lo explica con una
  pista en lugar de prometer que `ANALYZE` lo arregla.
- Las otras 13 consultas no tienen un índice o un ajuste de memoria que sugerir. A lo sumo marcan el
  paso que más pesa (Q01, por ejemplo, recorre toda la tabla a propósito).
- El caso también corrigió al motor: el índice sugerido ahora pone primero las columnas de `=` y al
  final una de rango. Con el orden anterior, Q20 mejoraba 19× en lugar de miles de veces.

Los tiempos en WebAssembly varían entre corridas (en otra, Q17 mejoró 71× y Q19 3,9×): lo estable es el
orden de magnitud. Los planes de antes y después de cada consulta, la tabla completa y cómo se repite
están en [bench/tpch](bench/tpch/README.md).

<sub>Basado en TPC-H (*derived from TPC-H*): usa el esquema y las consultas de la especificación con
datos generados en SQL. No es una implementación oficial ni es comparable con resultados publicados de
TPC-H.</sub>

## Desarrollo

Requiere Node 22.12 o superior.

```bash
npm install
npm run dev      # http://localhost:4321
npm test         # Vitest
npm run check    # astro check (tipos)
npm run build
npm run bench    # velocidad del motor
npm run tpch     # caso basado en TPC-H (PostgreSQL en WebAssembly, sin instalar nada)
```

## Estructura

```
src/
  engine/      motor de análisis: TypeScript puro, sin dependencias de interfaz
    parse/     lectores de PostgreSQL (texto y JSON) y de Oracle (DBMS_XPLAN)
    rules/     una regla por archivo, con su prueba al lado
    thresholds.ts  todos los umbrales en un solo lugar
  components/  componentes Astro; analyzer/ es la isla de React con el resultado
  i18n/        textos en español e inglés (ui.ts, rules.ts) y formatos de números
  layouts/     plantilla base (fuentes, tema sin parpadeo) y página con encabezado
  pages/       / y /reglas/ en español; /en/ y /en/rules/ en inglés; api/ y s/ para compartir
  share/       links temporales: validación, almacén con TTL y ocultar valores literales
bench/         medición del motor y caso basado en TPC-H
```

Hecho con Astro, React, TypeScript y Tailwind CSS.

## Licencia

[MIT](LICENSE) © Eduardo Coronell
