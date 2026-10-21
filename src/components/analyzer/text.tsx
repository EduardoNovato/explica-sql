import type { ReactNode } from 'react';
import type { Finding, FindingData, Severity } from '../../engine';
import { formatCount, formatFactor, formatKb, formatMs, formatPercent } from '../../i18n/format';
import type { RuleStrings } from './strings';

/** Plantillas de un hallazgo según su caso: alerta de la regla 6, o sin SQL que sugerir */
export function findingTemplates(finding: Finding, rule: RuleStrings): { body: string; fix: string } {
  const serious = finding.data.costly === 1;
  return {
    body: serious && rule.bodyAlert ? rule.bodyAlert : rule.body,
    fix: serious && rule.fixAlert ? rule.fixAlert : finding.sql.length === 0 && rule.fixNoSql ? rule.fixNoSql : rule.fix,
  };
}

/** Datos que son nombres de SQL: van en monoespaciada */
const CODE_KEYS = new Set(['table', 'columns', 'expressions', 'sortKey', 'node', 'workMem']);

/** Formatea un dato según su nombre: `…Share` porcentaje, `…Ms` duración, `…Kb` tamaño */
export function formatValue(key: string, value: string | number, locale: string): string {
  if (typeof value === 'string') return value;
  if (key.endsWith('Share')) return formatPercent(value, locale);
  if (key.endsWith('Ms')) return formatMs(value, locale);
  if (key.endsWith('Kb')) return formatKb(value, locale);
  if (key === 'readMb') return formatKb(value * 1024, locale);
  if (key === 'factor') return formatFactor(value, locale);
  return formatCount(value, locale);
}

/** Reemplaza cada `{dato}` de la plantilla: nombres de SQL en <code>, cifras en <strong> */
export function fill(template: string, data: FindingData, locale: string): ReactNode[] {
  return template.split(/(\{\w+\})/).map((part, i) => {
    const key = /^\{(\w+)\}$/.exec(part)?.[1];
    const value = key === undefined ? undefined : data[key];
    if (key === undefined || value === undefined) return part;
    const text = formatValue(key, value, locale);
    return CODE_KEYS.has(key) ? (
      <code key={i} className="rounded bg-surface-2 px-[3px] py-px font-mono text-[0.9em] break-words text-ink">
        {text}
      </code>
    ) : (
      <strong key={i} className="font-semibold whitespace-nowrap text-ink">
        {text}
      </strong>
    );
  });
}

export const severityStyles: Record<Severity, { text: string; badge: string; dot: string }> = {
  alert: { text: 'text-danger', badge: 'bg-danger-soft text-danger', dot: 'bg-danger' },
  warning: { text: 'text-caution', badge: 'bg-caution-soft text-caution', dot: 'bg-caution' },
  note: { text: 'text-accent', badge: 'bg-accent-soft text-accent', dot: 'bg-accent' },
};

/** Desplaza hasta un elemento respetando "reducir movimiento" */
export function scrollToElement(id: string, block: ScrollLogicalPosition = 'center') {
  const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  document.getElementById(id)?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block });
}
