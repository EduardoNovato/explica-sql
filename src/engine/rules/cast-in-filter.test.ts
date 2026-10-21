import { describe, expect, it } from 'vitest';
import { analysisOf, findingsOf, plans } from '../fixtures';

describe('regla 6 · conversión o función sobre la columna', () => {
  it('es solo una nota si el escaneo no es costoso (caso de control)', () => {
    expect(findingsOf(analysisOf(plans.control), 'cast-in-filter')).toEqual([
      expect.objectContaining({ severity: 'note', data: { table: 'pedidos', expressions: '(estado)::text', costly: 0 }, sql: [] }),
    ]);
  });

  it('junta todas las expresiones del Filter en un hallazgo', () => {
    expect(findingsOf(analysisOf(plans.resultDominant), 'cast-in-filter')).toMatchObject([
      { severity: 'note', nodeId: 2, data: { expressions: '(numero)::text, (tipo)::text' } },
    ]);
  });

  it('es alerta, con índice de expresión, si además es un escaneo completo costoso', () => {
    expect(findingsOf(analysisOf(plans.dateFilter), 'cast-in-filter')).toMatchObject([
      {
        severity: 'alert',
        data: { expressions: 'date(creado_en)', costly: 1 },
        sql: ['CREATE INDEX ON pedidos ((date(creado_en)));'],
      },
    ]);
  });

  it('no mira las conversiones de los literales ni el Index Cond', () => {
    expect(findingsOf(analysisOf(plans.customerStats), 'cast-in-filter')).toEqual([]);
    const plan = [
      "Index Scan using pedidos_estado_idx on pedidos  (cost=0.29..8.30 rows=1 width=8) (actual time=0.010..0.012 rows=1 loops=1)",
      "  Index Cond: ((estado)::text = 'pagado'::text)",
    ].join('\n');
    expect(findingsOf(analysisOf(plan), 'cast-in-filter')).toEqual([]);
  });
});
