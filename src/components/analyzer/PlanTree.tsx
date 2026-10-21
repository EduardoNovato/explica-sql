import type { Analysis, Finding, PlanNode } from '../../engine';
import { formatCompact, formatFactor, formatMs, formatPercent } from '../../i18n/format';
import type { AnalyzerStrings } from './strings';
import { severityStyles } from './text';

interface Props {
  analysis: Analysis;
  strings: AnalyzerStrings;
  locale: string;
  highlighted: ReadonlySet<number>;
  onShowFinding: (index: number) => void;
}

/** Sangría máxima: en planes muy profundos el árbol no se sale de la pantalla */
const MAX_INDENT = 10;

export default function PlanTree({ analysis, strings, locale, highlighted, onShowFinding }: Props) {
  const t = strings.analysis;
  const findingsByNode = new Map<number, { finding: Finding; index: number }[]>();
  analysis.findings.forEach((finding, index) => {
    const list = findingsByNode.get(finding.nodeId) ?? [];
    list.push({ finding, index });
    findingsByNode.set(finding.nodeId, list);
  });

  return (
    <section aria-labelledby="tree-title" className="min-w-0">
      <h3 id="tree-title" className="text-base font-medium text-ink">
        {t.treeTitle}
      </h3>
      <p className="mt-1 text-sm leading-relaxed text-muted">{t.treeHint}</p>
      <ol className="mt-4 space-y-1.5">
        {analysis.nodes.map((node) => (
          <TreeRow
            key={node.id}
            node={node}
            hasAnalyze={analysis.hasAnalyze}
            strings={strings}
            locale={locale}
            highlighted={highlighted.has(node.id)}
            findings={findingsByNode.get(node.id) ?? []}
            onShowFinding={onShowFinding}
          />
        ))}
      </ol>
    </section>
  );
}

interface RowProps {
  node: PlanNode;
  hasAnalyze: boolean;
  strings: AnalyzerStrings;
  locale: string;
  highlighted: boolean;
  findings: { finding: Finding; index: number }[];
  onShowFinding: (index: number) => void;
}

function TreeRow({ node, hasAnalyze, strings, locale, highlighted, findings, onShowFinding }: RowProps) {
  const t = strings.analysis;
  const loops = node.actual?.loops ?? 1;
  const facts: { text: string; tone?: string }[] = [];

  if (node.neverExecuted) {
    facts.push({ text: t.neverExecuted });
  } else if (node.actual) {
    facts.push({ text: t.rows.replace('{n}', formatCompact(node.actual.rows * loops, locale)) });
    if (node.estimate) {
      const estimated = node.estimate.rows * loops;
      const actual = node.actual.rows * loops;
      const factor = Math.max(estimated, actual) / Math.max(Math.min(estimated, actual), 1);
      facts.push({
        text: `${t.estimated.replace('{n}', formatCompact(estimated, locale))}${factor >= 10 ? ` (${formatFactor(factor, locale)})` : ''}`,
        tone: factor >= 10 ? 'text-caution' : undefined,
      });
    }
    if (node.rowsRemovedByFilter) facts.push({ text: t.removed.replace('{n}', formatCompact(node.rowsRemovedByFilter * loops, locale)) });
    if (loops > 1) facts.push({ text: t.loops.replace('{n}', formatCompact(loops, locale)) });
  } else if (node.estimate) {
    facts.push({ text: t.estimated.replace('{n}', formatCompact(node.estimate.rows, locale)) });
  }

  return (
    <li id={`node-${node.id}`} className="scroll-mt-24" style={{ paddingLeft: `${Math.min(node.depth, MAX_INDENT) * 14}px` }}>
      <div
        className={`theme-fade relative overflow-hidden rounded-lg border bg-surface transition-[border-color,box-shadow] duration-200 ${
          highlighted ? 'border-accent shadow-[0_0_0_3px_var(--accent-soft)]' : 'border-line'
        }`}
      >
        {hasAnalyze && (
          <span
            aria-hidden="true"
            className="absolute inset-y-0 left-0 bg-accent-soft"
            style={{ width: `${Math.max(node.selfShare * 100, node.selfShare > 0 ? 0.5 : 0)}%` }}
          />
        )}
        <div className="relative px-3 py-2">
          <div className="flex items-start gap-3">
            <p className="min-w-0 flex-1 font-mono text-[12.5px] leading-relaxed break-words text-ink">
              {node.depth > 0 && (
                <span className="text-faint" aria-hidden="true">
                  ↳{' '}
                </span>
              )}
              {node.subplan && <span className="text-faint">{node.subplan} · </span>}
              {node.label}
            </p>
            {hasAnalyze && (
              <p className="shrink-0 pt-px text-right font-mono text-[11.5px] leading-relaxed tabular-nums">
                <span className={node.selfShare >= 0.5 ? 'font-semibold text-ink' : 'text-ink'}>{formatPercent(node.selfShare, locale)}</span>
                <span className="block text-faint">{formatMs(node.selfMs, locale)}</span>
              </p>
            )}
          </div>

          {facts.length > 0 && (
            <p className="mt-0.5 flex flex-wrap gap-x-3 font-mono text-[11px] text-faint">
              {facts.map((fact, i) => (
                <span key={i} className={fact.tone}>
                  {fact.text}
                </span>
              ))}
            </p>
          )}

          {findings.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {findings.map(({ finding, index }) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => onShowFinding(index)}
                  className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium transition-opacity hover:opacity-80 ${severityStyles[finding.severity].badge}`}
                >
                  <span className={`size-1.5 rounded-full ${severityStyles[finding.severity].dot}`} aria-hidden="true" />
                  <span className="sr-only">{t.findingOnNode}: </span>
                  {strings.rules[finding.rule].title}
                </button>
              ))}
            </div>
          )}

          {node.details.length > 0 && (
            <details className="group mt-1.5">
              <summary className="inline-flex cursor-pointer list-none items-center gap-1 rounded text-[11px] text-muted select-none hover:text-ink [&::-webkit-details-marker]:hidden">
                <span className="inline-block transition-transform group-open:rotate-90" aria-hidden="true">
                  ›
                </span>
                {t.details}
              </summary>
              <pre className="mt-1.5 overflow-x-auto rounded-md bg-bg px-2.5 py-2 font-mono text-[11px] leading-relaxed text-muted [font-variant-ligatures:none]">
                {node.details.join('\n')}
              </pre>
            </details>
          )}
        </div>
      </div>
    </li>
  );
}
