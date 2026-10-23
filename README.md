# Explica SQL

Pega el plan de ejecución de tu consulta, el `EXPLAIN ANALYZE` de PostgreSQL o el `DBMS_XPLAN` de Oracle,
y en milisegundos te dice si es lenta, dónde se va el tiempo y qué hacer, con el SQL listo para copiar.
En español e inglés.

> **Estado:** en construcción. Ya se puede pegar un plan, ver el veredicto, el árbol y los hallazgos
> con el SQL para copiar, y compartir el resultado con un link temporal. Falta publicarla.

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
tardó más que ejecutar. Lee texto (DBeaver, pgAdmin, psql) y JSON, y analiza un plan de 1.000 nodos
en unos 11 ms.

## Desarrollo

Requiere Node 22.12 o superior.

```bash
npm install
npm run dev      # http://localhost:4321
npm test         # Vitest
npm run check    # astro check (tipos)
npm run build
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
```

Hecho con Astro, React, TypeScript y Tailwind CSS.

## Licencia

[MIT](LICENSE) © Eduardo Coronell
