# Resultados · SF 0.1

PostgreSQL 18.6 (PGlite 0.5.9) on wasm32-unknown-emscripten, compiled by emcc (Emscripten gcc/clang-like replacement + linker emulating GNU ld) 3.1.74 (1092ec30a3fb1d46b1782ff1b4db5094d3d06ae5), 32-bit · work_mem 4MB · 600.590 líneas de pedido, 150.000 pedidos.
Tiempos: `Execution Time` de `EXPLAIN (ANALYZE, BUFFERS)`, mediana de 3 corridas (una sola si pasa de 5 s).

| Consulta | Antes | Veredicto | Alertas y avisos | SQL aplicado | Después | Mejora |
| --- | --- | --- | --- | --- | --- | --- |
| Q01 · Resumen de precios | 1,08 s | Muy lenta | Paso dominante | — | — | — |
| Q02 · Proveedor de costo mínimo | 198,3 ms | Lenta | Paso dominante | — | — | — |
| Q03 · Prioridad de envío | 230,4 ms | Lenta | — | — | — | — |
| Q04 · Prioridad de pedidos | 441,8 ms | Lenta | Paso dominante | — | — | — |
| Q05 · Volumen de proveedores locales | 122,5 ms | Lenta | — | — | — | — |
| Q06 · Ingreso previsto | 122,8 ms | Lenta | Paso dominante, Escaneo completo costoso | `CREATE INDEX ON lineitem (l_shipdate);` | 82,4 ms (Aceptable) | 1,5× |
| Q07 · Volumen de envíos | 229,8 ms | Lenta | — | — | — | — |
| Q08 · Participación en el mercado nacional | 450,3 ms | Lenta | — | — | — | — |
| Q09 · Ganancia por tipo de producto | 1,55 s | Muy lenta | Ordenamiento en disco, Estimación muy errada | `SET work_mem = '32MB';`<br>`ANALYZE partsupp;`<br>`ANALYZE part;`<br>`ANALYZE lineitem;` | 1,62 s (Muy lenta) | 1× |
| Q10 · Artículos devueltos | 323,1 ms | Lenta | — | — | — | — |
| Q11 · Existencias importantes | 120,1 ms | Lenta | Paso dominante | — | — | — |
| Q12 · Modo de envío y prioridad | 241,2 ms | Lenta | Paso dominante, Escaneo completo costoso | `CREATE INDEX ON lineitem (l_shipmode, l_receiptdate);` | 143,9 ms (Lenta) | 1,7× |
| Q13 · Distribución de clientes | 311,4 ms | Lenta | — | — | — | — |
| Q14 · Efecto de las promociones | 121,6 ms | Lenta | Paso dominante, Escaneo completo costoso | `CREATE INDEX ON lineitem (l_shipdate);` | 58,3 ms (Aceptable) | 2,1× |
| Q15 · Proveedor principal | 151,7 ms | Lenta | Paso dominante, Escaneo completo costoso | `CREATE INDEX ON lineitem (l_shipdate);` | 40,3 ms (Aceptable) | 3,8× |
| Q16 · Relación entre partes y proveedores | 132,2 ms | Lenta | — | — | — | — |
| Q17 · Ingreso de pedidos pequeños | 24,29 s | Muy lenta | Paso dominante, Escaneo completo costoso | `CREATE INDEX ON lineitem (l_partkey);` | 1 s (Muy lenta) | 24,2× |
| Q18 · Clientes de gran volumen | 2,89 s | Muy lenta | — | — | — | — |
| Q19 · Ingreso con descuento | 415 ms | Lenta | Paso dominante, Escaneo completo costoso | `CREATE INDEX ON lineitem (l_shipmode, l_shipinstruct, l_quantity);` | 45,3 ms (Aceptable) | 9,2× |
| Q20 · Promoción de partes | 238,45 s | Muy lenta | Paso dominante, Nested Loop costoso | `CREATE INDEX ON lineitem (l_partkey, l_suppkey, l_shipdate);` | 25,7 ms (Aceptable) | 9.265,8× |
| Q21 · Proveedores que hicieron esperar pedidos | 454,3 ms | Lenta | Estimación muy errada | `ANALYZE lineitem;`<br>`ANALYZE nation;`<br>`ANALYZE supplier;` | 489,5 ms (Lenta) | 0,9× |
| Q22 · Oportunidades de venta global | 149,4 ms | Lenta | Estimación muy errada | — | — | — |
