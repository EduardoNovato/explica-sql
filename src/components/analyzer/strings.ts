import type { RuleId } from '../../engine';
import { ruleHints, ruleOrder, rulePath, ruleTexts, type RuleText } from '../../i18n/rules';
import { useTranslations, type Lang } from '../../i18n/ui';

export type RuleStrings = Pick<RuleText, 'title' | 'body' | 'bodyAlert' | 'fix' | 'fixAlert' | 'fixNoSql' | 'oracle'> & { path: string };

/** Textos que necesita la isla; se arman en el servidor y viajan como props */
export interface AnalyzerStrings {
  input: ReturnType<typeof useTranslations>['input'];
  verdict: ReturnType<typeof useTranslations>['verdict'];
  analysis: ReturnType<typeof useTranslations>['analysis'];
  share: ReturnType<typeof useTranslations>['share'];
  rules: Record<RuleId, RuleStrings>;
  hints: Record<string, string>;
}

export function analyzerStrings(lang: Lang): AnalyzerStrings {
  const t = useTranslations(lang);
  const rules = {} as Record<RuleId, RuleStrings>;
  for (const id of ruleOrder) {
    const { title, body, bodyAlert, fix, fixAlert, fixNoSql, oracle } = ruleTexts[lang][id];
    rules[id] = { title, body, bodyAlert, fix, fixAlert, fixNoSql, oracle, path: rulePath(lang, id) };
  }
  return { input: t.input, verdict: t.verdict, analysis: t.analysis, share: t.share, rules, hints: ruleHints[lang] };
}
