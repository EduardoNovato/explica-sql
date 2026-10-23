import { describe, expect, it } from 'vitest';
import { columnRefs, comparisons, functionCalls, sortKeyColumn } from './expression';

describe('columnas de una condición', () => {
  it('encuentra columnas sueltas y calificadas, sin literales ni parámetros', () => {
    expect(columnRefs("((p.cliente_id = c.id) AND (estado = 'pagado'::text) AND (total > $1))")).toEqual([
      { qualifier: 'p', name: 'cliente_id' },
      { qualifier: 'c', name: 'id' },
      { name: 'estado' },
      { name: 'total' },
    ]);
  });

  it('marca la conversión de tipo directa sobre una columna', () => {
    expect(columnRefs("((numero)::text ~~ '%'::text)")).toEqual([{ name: 'numero', cast: '(numero)::text' }]);
    expect(columnRefs("((f.creado_en)::timestamp without time zone >= '2026-01-01'::date)")).toEqual([
      { qualifier: 'f', name: 'creado_en', cast: '(f.creado_en)::timestamp without time zone' },
    ]);
  });

  it('marca la función más externa que envuelve la columna', () => {
    expect(columnRefs("(date(creado_en) = '2026-03-15'::date)")).toEqual([
      { name: 'creado_en', fn: 'date', fnExpression: 'date(creado_en)' },
    ]);
    expect(columnRefs("(upper(btrim((nombre)::text)) = 'ANA'::text)")).toEqual([
      { name: 'nombre', cast: '(nombre)::text', fn: 'upper', fnExpression: 'upper(btrim((nombre)::text))' },
    ]);
  });

  it('no confunde funciones sobre literales, ANY ni SubPlan con columnas', () => {
    expect(columnRefs("((tipo)::text ~~ opcional(NULL::text, '%'::text))")).toEqual([{ name: 'tipo', cast: '(tipo)::text' }]);
    expect(columnRefs("(id = ANY ('{1,2,3}'::integer[]))")).toEqual([{ name: 'id' }]);
    expect(columnRefs('(NOT (hashed SubPlan 1))')).toEqual([]);
    expect(columnRefs("((total)::numeric(12,2) > '10'::numeric)")).toEqual([{ name: 'total', cast: '(total)::numeric(12,2)' }]);
  });

  it('lista las funciones llamadas', () => {
    expect(functionCalls("((numero)::text ~~ opcional(NULL::text, '%'::text))")).toEqual(['opcional']);
    expect(functionCalls('(id = ANY ($1))')).toEqual([]);
  });
});

describe('comparaciones', () => {
  it('distingue igualdades, rangos y columna contra columna', () => {
    const found = comparisons(
      "((l_shipmode = ANY ('{MAIL,SHIP}'::bpchar[])) AND (l_commitdate < l_receiptdate) AND (l_receiptdate >= '1994-01-01'::date) AND (l_quantity <> 3))",
    );
    expect(found.map(({ column, kind, against }) => [column.name, kind, against?.name])).toEqual([
      ['l_shipmode', 'equality', undefined],
      ['l_commitdate', 'range', 'l_receiptdate'],
      ['l_receiptdate', 'range', 'l_commitdate'],
      ['l_receiptdate', 'range', undefined],
    ]);
  });

  it('salta conversiones de tipo y reconoce las funciones', () => {
    expect(comparisons("((f.creado_en)::timestamp without time zone >= '2026-01-01'::date)")[0]?.column).toMatchObject({ qualifier: 'f', name: 'creado_en' });
    expect(comparisons('(TO_NUMBER("NUMERO")=4521)')[0]?.column).toMatchObject({ name: '"NUMERO"', fn: 'TO_NUMBER' });
  });
});

describe('claves de ordenamiento', () => {
  it.each([
    ['numero', { qualifier: undefined, name: 'numero', order: '' }],
    ['l.l_shipdate DESC', { qualifier: 'l', name: 'l_shipdate', order: ' DESC' }],
    ['total DESC NULLS LAST', { qualifier: undefined, name: 'total', order: ' DESC NULLS LAST' }],
  ])('%s', (key, expected) => {
    expect(sortKeyColumn(key)).toEqual(expected);
  });

  it('no sirve para expresiones', () => {
    expect(sortKeyColumn('(lower(nombre))')).toBeUndefined();
  });
});
