import type { Analysis, Finding } from '../../engine';
import CopyButton from './CopyButton';
import { ArrowIcon, TargetIcon } from './icons';
import type { AnalyzerStrings } from './strings';
import { fill, findingTemplates, severityStyles } from './text';

interface Props {
  analysis: Analysis;
  strings: AnalyzerStrings;
  locale: string;
  flashed?: number;
  onHighlight: (ids: number[] | null) => void;
  onShowNode: (id: number) => void;
}

export default function Findings({ analysis, strings, locale, flashed, onHighlight, onShowNode }: Props) {
  const t = strings.analysis;
  const empty = !analysis.hasAnalyze ? t.noFindingsNoAnalyze : analysis.verdict === 'fast' ? t.noFindingsFast : t.noFindings;

  return (
    <section aria-labelledby="findings-title" className="min-w-0">
      <h3 id="findings-title" className="text-base font-medium text-ink">
        {t.findingsTitle}
      </h3>
      {analysis.findings.length === 0 ? (
        <p className="mt-3 rounded-xl border border-line bg-surface px-4 py-3 text-sm text-muted">{empty}</p>
      ) : (
        <ol className="mt-4 space-y-3">
          {analysis.findings.map((finding, index) => (
            <FindingCard
              key={index}
              index={index}
              finding={finding}
              strings={strings}
              locale={locale}
              flashed={flashed === index}
              onHighlight={onHighlight}
              onShowNode={onShowNode}
            />
          ))}
        </ol>
      )}
    </section>
  );
}

interface CardProps {
  index: number;
  finding: Finding;
  strings: AnalyzerStrings;
  locale: string;
  flashed: boolean;
  onHighlight: (ids: number[] | null) => void;
  onShowNode: (id: number) => void;
}

function FindingCard({ index, finding, strings, locale, flashed, onHighlight, onShowNode }: CardProps) {
  const t = strings.analysis;
  const rule = strings.rules[finding.rule];
  const { body, fix } = findingTemplates(finding, rule);
  const hint = typeof finding.data.hint === 'string' ? strings.hints[finding.data.hint] : undefined;
  const ids = [finding.nodeId, ...(finding.relatedNodeIds ?? [])];
  const style = severityStyles[finding.severity];

  return (
    <li
      id={`finding-${index}`}
      onMouseEnter={() => onHighlight(ids)}
      onMouseLeave={() => onHighlight(null)}
      onFocus={() => onHighlight(ids)}
      onBlur={() => onHighlight(null)}
      className={`theme-fade scroll-mt-24 rounded-xl border bg-surface p-4 transition-[border-color,box-shadow] duration-200 ${
        flashed ? 'border-accent shadow-[0_0_0_3px_var(--accent-soft)]' : 'border-line hover:border-line-strong'
      }`}
    >
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium ${style.badge}`}>
          <span className={`size-1.5 rounded-full ${style.dot}`} aria-hidden="true" />
          {t.severity[finding.severity]}
        </span>
        <h4 className="text-[15px] leading-snug font-medium text-ink">{rule.title}</h4>
      </div>

      <p className="mt-2.5 text-sm leading-relaxed text-muted">{fill(body, finding.data, locale)}</p>
      {hint && <p className="mt-2 text-sm leading-relaxed text-muted">{hint}</p>}
      <p className="mt-2 text-sm leading-relaxed text-muted">
        <span className="font-medium text-ink">{t.fix}</span> {fill(fix, finding.data, locale)}
      </p>

      {finding.sql.length > 0 && (
        <div className="mt-3 overflow-hidden rounded-lg border border-line bg-bg">
          <pre className="overflow-x-auto px-3 py-2.5 font-mono text-[12px] leading-relaxed text-ink [font-variant-ligatures:none]" translate="no">
            {finding.sql.join('\n')}
          </pre>
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line px-1.5 py-1">
            <CopyButton text={finding.sql.join('\n')} label={t.copySql} copied={t.copied} error={t.copyError} />
          </div>
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs">
        <button type="button" onClick={() => onShowNode(finding.nodeId)} className="inline-flex items-center gap-1.5 py-1 text-muted hover:text-accent">
          <TargetIcon />
          {t.showInTree}
        </button>
        <a href={rule.path} className="inline-flex items-center gap-1.5 py-1 text-muted hover:text-accent">
          {t.moreAbout}
          <ArrowIcon />
        </a>
      </div>
    </li>
  );
}
