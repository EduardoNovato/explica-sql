# Explica SQL

Pega el resultado de `EXPLAIN ANALYZE` de PostgreSQL y en milisegundos te dice si la consulta es lenta,
dónde se va el tiempo y qué hacer, con el SQL listo para copiar. En español e inglés.

> **Estado:** en construcción. Ya están la página bilingüe y el motor de análisis con sus pruebas;
> falta conectar el motor a la página.

## Cómo se usa

1. Ejecuta tu consulta con `EXPLAIN (ANALYZE, BUFFERS) SELECT …` en psql, DBeaver o pgAdmin.
2. Pega el resultado (texto o JSON) en la página.

El análisis corre en tu navegador: el plan no sale de tu computadora.

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
| 8 | Nodo dominante | un nodo se lleva ≥ 50 % del tiempo en una consulta de ≥ 100 ms |

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
    parse/     lectores de texto y JSON
    rules/     una regla por archivo, con su prueba al lado
    thresholds.ts  todos los umbrales en un solo lugar
  components/  componentes Astro y la isla de React
  i18n/ui.ts   textos en español e inglés
  layouts/     plantilla base (fuentes, tema sin parpadeo)
  pages/       / (español) y /en/ (inglés)
```

Hecho con Astro, React, TypeScript y Tailwind CSS.

## Licencia

[MIT](LICENSE) © Eduardo Coronell
