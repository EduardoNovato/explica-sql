import type { ReactNode } from 'react';
import type { Analysis, Severity, Verdict } from '../../engine';
import { formatCount, formatMs, formatPercent, plural } from '../../i18n/format';
import { InfoIcon, TargetIcon } from './icons';
import type { AnalyzerStrings } from './strings';
import { fill, severityStyles } from './text';

const verdictColor: Record<Verdict, string> = {
  fast: 'text-accent',
  acceptable: 'text-ink',
  slow: 'text-caution',
  'very-slow': 'text-danger',
};

interface Props {
  analysis: Analysis;
  strings: AnalyzerStrings;
  locale: string;
  onShowNode: (id: number) => void;
}

function Metric({ label, children, wide = false }: { label: string; children: ReactNode; wide?: boolean }) {
  return (
    <div className={`min-w-0 bg-surface px-4 py-3 ${wide ? 'col-span-2' : ''}`}>
      <dt className="text-xs text-faint">{label}</dt>
      <dd className="mt-1 font-mono text-[15px] text-ink tabular-nums">{children}</dd>
    </div>
  );
}

export default function Summary({ analysis, strings, locale, onShowNode }: Props) {
  const t = strings.analysis;
  const dash = <span className="text-faint">—</span>;
  const slowest = analysis.metrics.slowestNodeId === undefined ? undefined : analysis.nodes[analysis.metrics.slowestNodeId];
  const counts = (['alert', 'warning', 'note'] as Severity[])
    .map((severity) => ({ severity, n: analysis.findings.filter((finding) => finding.severity === severity).length }))
    .filter(({ n }) => n > 0);
  // A-Time de Oracle va de 10 en 10 ms: lo que no supera esa precisión se muestra como "≤ 10 ms"
  const duration = (ms: number) =>
    analysis.timeResolutionMs !== undefined && ms <= analysis.timeResolutionMs
      ? t.atMost.replace('{time}', formatMs(analysis.timeResolutionMs, locale))
      : formatMs(ms, locale);
  const { rowsRead, blocksRead } = analysis.metrics;

  return (
    <div>
      <p className="mb-3">
        <span className="inline-flex items-center rounded-md border border-line px-2 py-0.5 font-mono text-[11px] text-muted">
          {t.dialect[analysis.dialect]}
        </span>
      </p>
      <div className="flex flex-wrap items-baseline gap-x-5 gap-y-2">
        <p className={`font-serif text-[clamp(2.5rem,10vw,3.75rem)] leading-none ${analysis.verdict ? verdictColor[analysis.verdict] : 'text-muted'}`}>
          {analysis.verdict ? strings.verdict[analysis.verdict] : t.estimatesOnly}
        </p>
        {analysis.hasAnalyze && <p className="font-mono text-xl text-ink tabular-nums sm:text-2xl">{duration(analysis.totalMs)}</p>}
      </div>

      <dl className="theme-fade mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-4">
        <Metric label={t.execution}>{analysis.executionMs === undefined ? dash : duration(analysis.executionMs)}</Metric>
        <Metric label={t.planning}>{analysis.planningMs === undefined ? dash : formatMs(analysis.planningMs, locale)}</Metric>
        <Metric label={t.rowsReturned}>
          {analysis.metrics.rowsReturned === undefined ? dash : formatCount(analysis.metrics.rowsReturned, locale)}
        </Metric>
        {blocksRead !== undefined && rowsRead === undefined ? (
          <Metric label={t.blocksRead}>{formatCount(blocksRead, locale)}</Metric>
        ) : (
          <Metric label={t.rowsRead}>{rowsRead === undefined ? dash : formatCount(rowsRead, locale)}</Metric>
        )}
        <Metric label={t.slowest} wide>
          {slowest ? (
            <button
              type="button"
              onClick={() => onShowNode(slowest.id)}
              className="group flex max-w-full items-center gap-2 text-left text-[13px] hover:text-accent"
            >
              <TargetIcon className="size-3.5 shrink-0 text-accent" />
              <span className="truncate">{slowest.label}</span>
              <span className="shrink-0 text-faint group-hover:text-accent">{formatPercent(slowest.selfShare, locale)}</span>
            </button>
          ) : (
            dash
          )}
        </Metric>
        <Metric label={t.findings} wide>
          {counts.length === 0 ? (
            <span className="text-[13px] text-faint">{t.none}</span>
          ) : (
            <span className="flex flex-wrap gap-x-3 gap-y-1 text-[13px]">
              {counts.map(({ severity, n }) => (
                <span key={severity} className={`inline-flex items-center gap-1.5 ${severityStyles[severity].text}`}>
                  <span className={`size-1.5 rounded-full ${severityStyles[severity].dot}`} aria-hidden="true" />
                  {plural(t.severityCount[severity], n, locale)}
                </span>
              ))}
            </span>
          )}
        </Metric>
      </dl>

      {analysis.notices.length > 0 && (
        <ul className="mt-4 space-y-2">
          {analysis.notices.map((notice, i) => (
            <li key={i} className="flex items-start gap-2.5 rounded-lg bg-caution-soft px-3.5 py-2.5 text-sm leading-relaxed text-ink">
              <InfoIcon className="mt-0.5 size-4 shrink-0 text-caution" />
              <span>{fill(t.notices[notice.id], notice.data, locale)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
