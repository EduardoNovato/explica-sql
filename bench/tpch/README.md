# Caso basado en TPC-H

Este caso pone a prueba lo que sugiere Explica SQL con las 22 consultas de TPC-H: correr cada consulta,
dejar que Explica SQL la diagnostique, aplicar exactamente el SQL que sugiere y volver a medir.

> Basado en TPC-H (*derived from TPC-H*): usa el esquema y las consultas de la especificación, pero no
> es una implementación oficial ni sus números son comparables con resultados publicados de TPC-H.

## Cómo se repite

```bash
npm run tpch
```

Con eso basta: no hay que instalar una base de datos.

- **Factor de escala:** `TPCH_SF=0.01 npm run tpch` lo cambia; el valor por defecto es 0,1 (600 mil líneas de pedido).
- **Solo algunas consultas:** `TPCH_QUERIES=q17,q20 npm run tpch`.
- **Datos:** la primera corrida genera los datos y los guarda en `bench/tpch/.data/`; las siguientes los reutilizan.

## Qué hace

1. **Base de datos:** PostgreSQL 18 compilado a WebAssembly ([PGlite](https://pglite.dev)), dentro del
   mismo proceso de Node. Es el PostgreSQL de verdad, pero más lento que uno nativo: sirven las
   comparaciones de antes y después, no los tiempos absolutos.
2. **Esquema** ([schema.sql](schema.sql)): las 8 tablas de TPC-H, solo con llaves primarias.
3. **Datos** ([generate.sql](generate.sql)): un generador en SQL, no el `dbgen` oficial. Respeta las
   cantidades por factor de escala y los valores que usan las consultas (marcas, contenedores, tipos,
   fechas, países, prioridades). Siempre da los mismos datos: usa `hashint8` en lugar de azar.
4. **Consultas** ([queries.ts](queries.ts)): las 22, con los parámetros de validación de la
   especificación. La 15 usa un CTE en lugar de la vista temporal.
5. **Por cada consulta** ([tpch.bench.ts](tpch.bench.ts)):
   - `EXPLAIN (ANALYZE, BUFFERS)`, mediana de 3 corridas (una sola si pasa de 5 s);
   - el motor de Explica SQL lee ese plan;
   - si hay alertas o avisos con SQL, se aplica ese SQL tal cual y se mide de nuevo;
   - se deshace el cambio (se borran los índices y estadísticas nuevos, `RESET work_mem`) para que
     ninguna consulta se beneficie del arreglo de otra.
6. **Resultados:** en `resultados/sf-<factor>/` quedan el plan de antes y el de después de cada
   consulta, y la tabla [RESULTADOS.md](resultados/sf-0.1/RESULTADOS.md).
