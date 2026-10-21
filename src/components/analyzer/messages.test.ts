import { describe, expect, it } from 'vitest';
import { analysisOf, plans } from '../../engine/fixtures';
import { ruleOrder, ruleTexts, ruleThresholds } from '../../i18n/rules';
import { languages, type Lang } from '../../i18n/ui';
import { analyzerStrings } from './strings';
import { findingTemplates, formatValue } from './text';

const langs = Object.keys(languages) as Lang[];
const placeholders = (template: string) => [...template.matchAll(/\{(\w+)\}/g)].map((match) => match[1] ?? '');

describe('textos de los hallazgos', () => {
  const analyses = Object.entries(plans).map(([name, plan]) => [name, analysisOf(plan)] as const);

  it.each(langs)('cada {dato} de los mensajes (%s) llega con valor desde el motor', (lang) => {
    const strings = analyzerStrings(lang);
    const missing: string[] = [];
    for (const [name, analysis] of analyses) {
      for (const finding of analysis.findings) {
        const { body, fix } = findingTemplates(finding, strings.rules[finding.rule]);
        for (const key of [...placeholders(body), ...placeholders(fix)]) {
          if (finding.data[key] === undefined || finding.data[key] === '') missing.push(`${name} · ${finding.rule} · {${key}}`);
        }
        const hint = finding.data.hint;
        if (typeof hint === 'string' && hint !== '' && !strings.hints[hint]) missing.push(`${name} · pista ${hint}`);
      }
      for (const notice of analysis.notices) {
        for (const key of placeholders(strings.analysis.notices[notice.id])) {
          if (notice.data[key] === undefined) missing.push(`${name} · aviso ${notice.id} · {${key}}`);
        }
      }
    }
    expect(missing).toEqual([]);
  });

  it('cubre todas las reglas en los planes de prueba', () => {
    const seen = new Set(analyses.flatMap(([, analysis]) => analysis.findings.map((finding) => finding.rule)));
    expect([...seen].sort()).toEqual([...ruleOrder].sort());
  });

  it('elige el mensaje de alerta de la regla 6 y el de "sin SQL" cuando corresponde', () => {
    const strings = analyzerStrings('es');
    const [cast] = analysisOf(plans.dateFilter).findings.filter((finding) => finding.rule === 'cast-in-filter');
    const [scan] = analysisOf(plans.dateFilter).findings.filter((finding) => finding.rule === 'seq-scan');
    if (!cast || !scan) throw new Error('faltan hallazgos');
    expect(findingTemplates(cast, strings.rules['cast-in-filter']).body).toBe(ruleTexts.es['cast-in-filter'].bodyAlert);
    expect(findingTemplates(scan, strings.rules['seq-scan']).fix).toBe(ruleTexts.es['seq-scan'].fixNoSql);
  });

  it('formatea cada dato según su nombre', () => {
    const locale = languages.es.locale;
    expect(formatValue('removedShare', 0.9098, locale)).toBe('91%');
    expect(formatValue('selfMs', 2120.334, locale)).toBe('2,12 s');
    expect(formatValue('diskKb', 22016, locale)).toBe('21,5 MB');
    expect(formatValue('readMb', 848.83, locale)).toBe('848,8 MB');
    expect(formatValue('factor', 3870, locale)).toBe('3.870×');
    expect(formatValue('removedRows', 5_460_012, locale)).toBe('5.460.012');
    expect(formatValue('table', 'lineitem', locale)).toBe('lineitem');
  });
});

describe('páginas de reglas', () => {
  it.each(langs)('las 8 reglas tienen textos, slugs únicos y umbrales para "Cuándo salta" (%s)', (lang) => {
    const slugs = ruleOrder.map((rule) => ruleTexts[lang][rule].slug);
    expect(new Set(slugs).size).toBe(ruleOrder.length);
    for (const rule of ruleOrder) {
      for (const key of placeholders(ruleTexts[lang][rule].page.when)) expect(ruleThresholds[rule][key], `${rule} {${key}}`).toBeDefined();
    }
  });
});
