/**
 * Planes sintéticos para medir el motor. Siempre los mismos (sin azar), para que las mediciones se
 * puedan repetir. Tablas inventadas, con la forma de un plan grande real: muchas ramas con joins,
 * filtros, buffers y algún paso que ordena en disco.
 */

/** Rama de 4 pasos en PostgreSQL: Hash Join con un Seq Scan y un Hash sobre otro Seq Scan */
function postgresBranch(i: number, indent: string): string[] {
  const inner = `${indent}      `;
  const leaf = `${inner}      `;
  return [
    `${indent}->  Hash Join  (cost=${i}.00..${i * 10}.00 rows=${100 + i} width=24) (actual time=0.${200 + (i % 700)}..${1 + (i % 9)}.${100 + (i % 800)} rows=${90 + (i % 50)} loops=1)`,
    `${indent}      Hash Cond: (p${i}.cliente_id = c${i}.id)`,
    `${indent}      Buffers: shared hit=${40 + (i % 60)} read=${i % 7}`,
    `${inner}->  Seq Scan on pedidos_${i} p${i}  (cost=0.00..${i}.00 rows=${1000 + i} width=16) (actual time=0.010..0.${400 + (i % 500)} rows=${900 + (i % 100)} loops=1)`,
    `${leaf}Filter: ((estado)::text = 'pagado'::text)`,
    `${leaf}Rows Removed by Filter: ${200 + (i % 300)}`,
    `${leaf}Buffers: shared hit=${30 + (i % 40)} read=${i % 5}`,
    `${inner}->  Hash  (cost=1.00..1.00 rows=${50 + (i % 30)} width=8) (actual time=0.0${10 + (i % 80)}..0.0${10 + (i % 80)} rows=${50 + (i % 30)} loops=1)`,
    `${leaf}Buckets: 1024  Batches: 1  Memory Usage: ${8 + (i % 20)}kB`,
    `${leaf}->  Seq Scan on clientes_${i} c${i}  (cost=0.00..1.00 rows=${50 + (i % 30)} width=8) (actual time=0.005..0.0${20 + (i % 70)} rows=${50 + (i % 30)} loops=1)`,
  ];
}

/** Plan ancho: un Append con 250 ramas de 4 pasos (1.001 pasos en total) */
export function postgresWide(branches = 250): string {
  const lines = [
    `Append  (cost=0.00..99999.00 rows=50000 width=24) (actual time=0.010..1450.000 rows=45000 loops=1)`,
    '  Buffers: shared hit=40000 read=1500',
  ];
  for (let i = 1; i <= branches; i++) lines.push(...postgresBranch(i, '  '));
  lines.push('Planning Time: 4.210 ms', 'Execution Time: 1460.500 ms');
  return lines.join('\n');
}

/** Peor caso de sangría: 1.000 pasos anidados uno dentro de otro (unos 6 MB de espacios) */
export function postgresDeep(depth = 1000): string {
  const lines: string[] = [];
  for (let i = 0; i < depth - 1; i++) {
    const arrow = i === 0 ? '' : `${' '.repeat(2 + (i - 1) * 6)}->  `;
    const detail = ' '.repeat(i === 0 ? 2 : 2 + (i - 1) * 6 + 6);
    lines.push(`${arrow}Sort  (cost=1.00..2.00 rows=10 width=8) (actual time=1.000..${(depth - i) * 2} rows=10 loops=1)`);
    lines.push(`${detail}Sort Key: total`);
  }
  lines.push(`${' '.repeat(2 + (depth - 2) * 6)}->  Seq Scan on pedidos  (cost=0.00..1.00 rows=10 width=8) (actual time=0.010..1.000 rows=10 loops=1)`);
  lines.push('Execution Time: 2500.000 ms');
  return lines.join('\n');
}

/** El mismo plan ancho en EXPLAIN (FORMAT JSON) */
export function postgresJson(branches = 250): string {
  const scan = (name: string, alias: string, i: number, filter?: string) => ({
    'Node Type': 'Seq Scan',
    'Relation Name': name,
    Alias: alias,
    'Startup Cost': 0,
    'Total Cost': i,
    'Plan Rows': 1000 + i,
    'Plan Width': 16,
    'Actual Startup Time': 0.01,
    'Actual Total Time': 0.4 + (i % 500) / 1000,
    'Actual Rows': 900 + (i % 100),
    'Actual Loops': 1,
    ...(filter ? { Filter: filter, 'Rows Removed by Filter': 200 + (i % 300) } : {}),
    'Shared Hit Blocks': 30 + (i % 40),
    'Shared Read Blocks': i % 5,
  });
  const branch = (i: number) => ({
    'Node Type': 'Hash Join',
    'Join Type': 'Inner',
    'Startup Cost': i,
    'Total Cost': i * 10,
    'Plan Rows': 100 + i,
    'Plan Width': 24,
    'Actual Startup Time': 0.2,
    'Actual Total Time': 1 + (i % 9),
    'Actual Rows': 90 + (i % 50),
    'Actual Loops': 1,
    'Hash Cond': `(p${i}.cliente_id = c${i}.id)`,
    'Shared Hit Blocks': 40 + (i % 60),
    'Shared Read Blocks': i % 7,
    Plans: [
      scan(`pedidos_${i}`, `p${i}`, i, "((estado)::text = 'pagado'::text)"),
      {
        'Node Type': 'Hash',
        'Plan Rows': 50,
        'Actual Total Time': 0.05,
        'Actual Rows': 50,
        'Actual Loops': 1,
        'Hash Batches': 1,
        'Peak Memory Usage': 9,
        Plans: [scan(`clientes_${i}`, `c${i}`, i)],
      },
    ],
  });
  const plan = {
    'Node Type': 'Append',
    'Total Cost': 99999,
    'Plan Rows': 50000,
    'Actual Total Time': 1450,
    'Actual Rows': 45000,
    'Actual Loops': 1,
    Plans: Array.from({ length: branches }, (_, i) => branch(i + 1)),
  };
  return JSON.stringify([{ Plan: plan, 'Planning Time': 4.21, 'Execution Time': 1460.5 }], null, 2);
}

/** Plan de Oracle (DBMS_XPLAN con ALLSTATS LAST) con 1.000 pasos y sus predicados */
export function oracleWide(steps = 1000): string {
  const rows = [
    '| Id  | Operation              | Name         | Starts | E-Rows | A-Rows |   A-Time   | Buffers | Reads  |',
    '|   0 | SELECT STATEMENT       |              |      1 |        |  33000 |00:00:04.10 |   99900 |    100 |',
    '|   1 |  UNION-ALL             |              |      1 |        |  33000 |00:00:04.10 |   99900 |    100 |',
  ];
  const predicates: string[] = [];
  let id = 2;
  while (id < steps) {
    const join = id;
    rows.push(`|*${String(join).padStart(4)} |   HASH JOIN            |              |      1 |    110 |    100 |00:00:00.0${join % 9} |     120 |      1 |`);
    predicates.push(`  ${join} - access("P"."CLIENTE_ID"="C"."ID")`);
    if (++id >= steps) break;
    rows.push(`|${String(id).padStart(5)} |    TABLE ACCESS FULL   | CLIENTES_${id} |      1 |     50 |     50 |00:00:00.01 |      20 |      0 |`);
    if (++id >= steps) break;
    rows.push(`|*${String(id).padStart(4)} |    TABLE ACCESS FULL   | PEDIDOS_${id} |      1 |   1000 |    900 |00:00:00.0${id % 9} |     100 |      1 |`);
    predicates.push(`  ${id} - filter("P"."ESTADO"='pagado')`);
    id++;
  }
  return [...rows, '', 'Predicate Information (identified by operation id):', '', ...predicates].join('\n');
}
