import { describe, expect, it } from 'vitest';
import { analysisOf, plans } from '../engine/fixtures';
import { formatMs } from './format';
import { languages, ui } from './ui';

describe('duraciones', () => {
  it.each([
    [0.032, '0,03 ms', '0.03 ms'],
    [7.456, '7,46 ms', '7.46 ms'],
    [143.512, '143,5 ms', '143.5 ms'],
    [1520.91, '1,52 s', '1.52 s'],
    [45_210, '45,2 s', '45.2 s'],
  ])('%s ms', (ms, es, en) => {
    expect(formatMs(ms, languages.es.locale)).toBe(es);
    expect(formatMs(ms, languages.en.locale)).toBe(en);
  });
});

it('el caso de control se muestra como "Rápida · 0,03 ms"', () => {
  const analysis = analysisOf(plans.control);
  const label = (lang: keyof typeof ui) =>
    `${analysis.verdict ? ui[lang].verdict[analysis.verdict] : ''} · ${formatMs(analysis.totalMs, languages[lang].locale)}`;
  expect(label('es')).toBe('Rápida · 0,03 ms');
  expect(label('en')).toBe('Fast · 0.03 ms');
});
