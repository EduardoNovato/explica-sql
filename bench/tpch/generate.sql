-- Datos basados en TPC-H, generados en SQL. No es el dbgen oficial: siempre da los mismos datos
-- (hashint8 en vez de azar) con las cantidades y los dominios de valores que usan las 22 consultas.
-- {{SF}} es el factor de escala: con 0.1 son 600 mil líneas de pedido.

-- Número "aleatorio" reproducible entre 0 y n - 1
CREATE FUNCTION rnd(k bigint, salt integer, n integer) RETURNS integer
  LANGUAGE sql IMMUTABLE PARALLEL SAFE
  RETURN (abs(hashint8(k * 1000003 + salt)) % n)::integer;

CREATE TABLE tpch_size AS
SELECT
  greatest(1, (10000 * {{SF}})::integer) AS suppliers,
  greatest(1, (150000 * {{SF}})::integer) AS customers,
  greatest(1, (200000 * {{SF}})::integer) AS parts,
  greatest(1, (1500000 * {{SF}})::integer) AS orders;

INSERT INTO region VALUES
  (0, 'AFRICA', ''), (1, 'AMERICA', ''), (2, 'ASIA', ''), (3, 'EUROPE', ''), (4, 'MIDDLE EAST', '');

INSERT INTO nation VALUES
  (0, 'ALGERIA', 0, ''), (1, 'ARGENTINA', 1, ''), (2, 'BRAZIL', 1, ''), (3, 'CANADA', 1, ''),
  (4, 'EGYPT', 4, ''), (5, 'ETHIOPIA', 0, ''), (6, 'FRANCE', 3, ''), (7, 'GERMANY', 3, ''),
  (8, 'INDIA', 2, ''), (9, 'INDONESIA', 2, ''), (10, 'IRAN', 4, ''), (11, 'IRAQ', 4, ''),
  (12, 'JAPAN', 2, ''), (13, 'JORDAN', 4, ''), (14, 'KENYA', 0, ''), (15, 'MOROCCO', 0, ''),
  (16, 'MOZAMBIQUE', 0, ''), (17, 'PERU', 1, ''), (18, 'CHINA', 2, ''), (19, 'ROMANIA', 3, ''),
  (20, 'SAUDI ARABIA', 4, ''), (21, 'VIETNAM', 2, ''), (22, 'RUSSIA', 3, ''),
  (23, 'UNITED KINGDOM', 3, ''), (24, 'UNITED STATES', 1, '');

INSERT INTO part
SELECT
  k,
  concat_ws(' ', w.colors[1 + rnd(k, 1, 32)], w.colors[1 + rnd(k, 2, 32)], w.colors[1 + rnd(k, 3, 32)],
    w.colors[1 + rnd(k, 4, 32)], w.colors[1 + rnd(k, 5, 32)]),
  'Manufacturer#' || m,
  'Brand#' || m || (1 + rnd(k, 7, 5)),
  w.type1[1 + rnd(k, 8, 6)] || ' ' || w.type2[1 + rnd(k, 9, 5)] || ' ' || w.type3[1 + rnd(k, 10, 5)],
  1 + rnd(k, 11, 50),
  w.cont1[1 + rnd(k, 12, 5)] || ' ' || w.cont2[1 + rnd(k, 13, 8)],
  (90000 + ((k / 10) % 20001) + 100 * (k % 1000)) / 100.0,
  'parte'
FROM tpch_size,
  generate_series(1, parts) AS k,
  LATERAL (SELECT 1 + rnd(k, 6, 5) AS m) AS mfgr,
  (SELECT
     ARRAY['almond', 'antique', 'aquamarine', 'azure', 'beige', 'bisque', 'black', 'blanched', 'blue', 'blush',
       'brown', 'burlywood', 'chartreuse', 'chocolate', 'coral', 'cornflower', 'cream', 'cyan', 'dark', 'forest',
       'frosted', 'gainsboro', 'ghost', 'goldenrod', 'green', 'honeydew', 'hot', 'indian', 'ivory', 'khaki',
       'lavender', 'lemon'] AS colors,
     ARRAY['STANDARD', 'SMALL', 'MEDIUM', 'LARGE', 'ECONOMY', 'PROMO'] AS type1,
     ARRAY['ANODIZED', 'BURNISHED', 'PLATED', 'POLISHED', 'BRUSHED'] AS type2,
     ARRAY['TIN', 'NICKEL', 'BRASS', 'STEEL', 'COPPER'] AS type3,
     ARRAY['SM', 'LG', 'MED', 'JUMBO', 'WRAP'] AS cont1,
     ARRAY['CASE', 'BOX', 'BAG', 'JAR', 'PKG', 'PACK', 'CAN', 'DRUM'] AS cont2) AS w;

INSERT INTO supplier
SELECT
  k,
  'Supplier#' || lpad(k::text, 9, '0'),
  'calle ' || k,
  n,
  (10 + n) || '-' || (100 + rnd(k, 2, 900)) || '-' || (100 + rnd(k, 3, 900)) || '-' || (1000 + rnd(k, 4, 9000)),
  (rnd(k, 5, 1099998) - 99999) / 100.0,
  CASE WHEN rnd(k, 6, 1000) < 5 THEN 'Customer serious Complaints' ELSE 'proveedor regular' END
FROM tpch_size, generate_series(1, suppliers) AS k, LATERAL (SELECT rnd(k, 1, 25) AS n) AS nat;

-- Cuatro proveedores por parte, con la fórmula de la especificación
INSERT INTO partsupp
SELECT
  p,
  ((p + j * (suppliers / 4 + (p - 1) / suppliers)) % suppliers) + 1,
  1 + rnd(p * 4 + j, 1, 9999),
  (100 + rnd(p * 4 + j, 2, 99901)) / 100.0,
  'existencias'
FROM tpch_size, generate_series(1, parts) AS p, generate_series(0, 3) AS j;

INSERT INTO customer
SELECT
  k,
  'Customer#' || lpad(k::text, 9, '0'),
  'avenida ' || k,
  n,
  (10 + n) || '-' || (100 + rnd(k, 2, 900)) || '-' || (100 + rnd(k, 3, 900)) || '-' || (1000 + rnd(k, 4, 9000)),
  (rnd(k, 5, 1099998) - 99999) / 100.0,
  (ARRAY['AUTOMOBILE', 'BUILDING', 'FURNITURE', 'MACHINERY', 'HOUSEHOLD'])[1 + rnd(k, 6, 5)],
  'cliente'
FROM tpch_size, generate_series(1, customers) AS k, LATERAL (SELECT rnd(k, 1, 25) AS n) AS nat;

-- Solo dos de cada tres clientes tienen pedidos (las consultas 13 y 22 cuentan con eso)
INSERT INTO orders
SELECT
  k,
  CASE WHEN c % 3 <> 0 THEN c WHEN c < customers THEN c + 1 ELSE c - 1 END,
  'O',
  0,
  date '1992-01-01' + rnd(k, 2, 2406),
  (ARRAY['1-URGENT', '2-HIGH', '3-MEDIUM', '4-NOT SPECIFIED', '5-LOW'])[1 + rnd(k, 3, 5)],
  'Clerk#' || lpad((1 + rnd(k, 4, greatest(1, (1000 * {{SF}})::integer)))::text, 9, '0'),
  0,
  CASE WHEN rnd(k, 5, 100) < 1 THEN 'special packages requests' ELSE 'pedido regular' END
FROM tpch_size, generate_series(1, orders) AS k, LATERAL (SELECT 1 + rnd(k, 1, customers) AS c) AS cust;

-- De una a siete líneas por pedido
INSERT INTO lineitem
SELECT
  l_orderkey, l_partkey,
  ((l_partkey + supplier_slot * (suppliers / 4 + (l_partkey - 1) / suppliers)) % suppliers) + 1,
  l_linenumber, quantity,
  quantity * (90000 + ((l_partkey / 10) % 20001) + 100 * (l_partkey % 1000)) / 100.0,
  discount, tax,
  CASE WHEN receipt <= date '1995-06-17' THEN (CASE WHEN rnd(seed, 9, 2) = 0 THEN 'R' ELSE 'A' END) ELSE 'N' END,
  CASE WHEN ship > date '1995-06-17' THEN 'O' ELSE 'F' END,
  ship, commitdate, receipt,
  (ARRAY['DELIVER IN PERSON', 'COLLECT COD', 'NONE', 'TAKE BACK RETURN'])[1 + rnd(seed, 10, 4)],
  (ARRAY['REG AIR', 'AIR', 'RAIL', 'SHIP', 'TRUCK', 'MAIL', 'FOB'])[1 + rnd(seed, 11, 7)],
  'línea'
FROM (
  SELECT
    o.o_orderkey AS l_orderkey,
    j AS l_linenumber,
    seed,
    1 + rnd(seed, 1, size.parts) AS l_partkey,
    rnd(seed, 2, 4) AS supplier_slot,
    size.suppliers,
    1 + rnd(seed, 3, 50) AS quantity,
    rnd(seed, 4, 11) / 100.0 AS discount,
    rnd(seed, 5, 9) / 100.0 AS tax,
    o.o_orderdate + 1 + rnd(seed, 6, 121) AS ship,
    o.o_orderdate + 30 + rnd(seed, 7, 61) AS commitdate,
    o.o_orderdate + 1 + rnd(seed, 6, 121) + 1 + rnd(seed, 8, 30) AS receipt
  FROM tpch_size AS size, orders AS o,
    LATERAL generate_series(1, 1 + rnd(o.o_orderkey, 6, 7)) AS j,
    LATERAL (SELECT o.o_orderkey::bigint * 8 + j AS seed) AS s
) AS line;

-- Estado y total de cada pedido, a partir de sus líneas
UPDATE orders AS o
SET o_totalprice = t.total, o_orderstatus = t.status
FROM (
  SELECT
    l_orderkey,
    sum(l_extendedprice * (1 + l_tax) * (1 - l_discount)) AS total,
    CASE WHEN bool_and(l_linestatus = 'F') THEN 'F' WHEN bool_and(l_linestatus = 'O') THEN 'O' ELSE 'P' END AS status
  FROM lineitem
  GROUP BY l_orderkey
) AS t
WHERE o.o_orderkey = t.l_orderkey;

DROP TABLE tpch_size;
