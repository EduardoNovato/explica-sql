import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { analyze, type AnalyzeResult } from '../../engine';
import example from '../../engine/fixtures/hash-sort.txt?raw';
import { plural } from '../../i18n/format';
import Findings from './Findings';
import { LockIcon } from './icons';
import PlanTree from './PlanTree';
import type { AnalyzerStrings } from './strings';
import Summary from './Summary';
import { scrollToElement } from './text';

interface Props {
  strings: AnalyzerStrings;
  locale: string;
  labelledBy: string;
  describedBy?: string;
}

/** Al editar un plan ya analizado, se vuelve a analizar tras esta pausa */
const REANALYZE_DELAY_MS = 250;
/** Cuánto dura el resaltado al saltar a un nodo o a un hallazgo */
const FLASH_MS = 2200;

export default function Analyzer({ strings, locale, labelledBy, describedBy }: Props) {
  const t = strings.input;
  const [plan, setPlan] = useState('');
  const [result, setResult] = useState<AnalyzeResult | null>(null);
  const [hovered, setHovered] = useState<number[] | null>(null);
  const [flashedNode, setFlashedNode] = useState<number | null>(null);
  const [flashedFinding, setFlashedFinding] = useState<number | undefined>(undefined);
  const pasted = useRef(false);
  const lastAnalyzed = useRef<string | null>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);

  const lines = plan.trim() === '' ? 0 : plan.trimEnd().split(/\r?\n/).length;
  const analysis = result?.ok ? result.analysis : undefined;

  /** Analiza y, si se pide, lleva la vista (y el foco) al resultado */
  const run = (text: string, reveal: 'focus' | 'scroll' | 'none') => {
    const next = analyze(text);
    lastAnalyzed.current = text;
    setResult(next);
    setHovered(null);
    if (!next.ok || reveal === 'none') return;
    requestAnimationFrame(() => {
      if (reveal === 'focus') heading.current?.focus({ preventScroll: true });
      scrollToElement('analysis-result', 'start');
    });
  };

  // Si el plan cambia después de analizarlo, se vuelve a analizar solo
  useEffect(() => {
    if (!result || plan === lastAnalyzed.current) return;
    if (plan.trim() === '') {
      setResult(null);
      return;
    }
    const timer = window.setTimeout(() => run(plan, 'none'), REANALYZE_DELAY_MS);
    return () => window.clearTimeout(timer);
    // `result` no entra: solo importa el texto
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan]);

  // `#ejemplo` (o `#example`) en la URL abre la página con el ejemplo ya analizado: sirve como link de demo
  useEffect(() => {
    const loadFromHash = () => {
      if (!['#ejemplo', '#example'].includes(window.location.hash)) return;
      setPlan(example);
      run(example, 'none');
    };
    loadFromHash();
    window.addEventListener('hashchange', loadFromHash);
    return () => window.removeEventListener('hashchange', loadFromHash);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (flashedNode === null && flashedFinding === undefined) return;
    const timer = window.setTimeout(() => {
      setFlashedNode(null);
      setFlashedFinding(undefined);
    }, FLASH_MS);
    return () => window.clearTimeout(timer);
  }, [flashedNode, flashedFinding]);

  const onChange = (value: string) => {
    setPlan(value);
    if (pasted.current) {
      pasted.current = false;
      if (value.trim() !== '') run(value, 'scroll');
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      run(plan, 'focus');
    }
  };

  const loadExample = () => {
    setPlan(example);
    run(example, 'focus');
  };

  const clear = () => {
    setPlan('');
    setResult(null);
    textarea.current?.focus();
  };

  const showNode = (id: number) => {
    setFlashedNode(id);
    scrollToElement(`node-${id}`);
  };

  const showFinding = (index: number) => {
    setFlashedFinding(index);
    scrollToElement(`finding-${index}`);
  };

  const highlighted = new Set<number>([...(hovered ?? []), ...(flashedNode === null ? [] : [flashedNode])]);

  return (
    <div>
      <div className="max-w-3xl">
        <div className="theme-fade overflow-hidden rounded-xl border border-line-strong bg-surface transition-colors focus-within:border-accent">
          <textarea
            ref={textarea}
            value={plan}
            onChange={(event) => onChange(event.target.value)}
            onPaste={() => {
              pasted.current = true;
            }}
            onKeyDown={onKeyDown}
            aria-labelledby={labelledBy}
            aria-describedby={describedBy}
            placeholder={t.placeholder}
            rows={10}
            wrap="off"
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
            translate="no"
            className="block min-h-48 w-full resize-y bg-transparent px-4 py-3.5 font-mono text-[12.5px] leading-[1.7] text-ink [font-variant-ligatures:none] placeholder:text-faint placeholder-shown:overflow-hidden focus-visible:outline-none"
          />
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-line px-3.5 py-2.5">
            <span className="font-mono text-[11px] text-faint tabular-nums">
              {lines === 0 ? t.empty : plural([t.lineOne, t.lineOther], lines, locale)}
            </span>
            <div className="ml-auto flex flex-wrap items-center justify-end gap-1.5">
              <button
                type="button"
                onClick={loadExample}
                className="rounded-md px-2.5 py-1.5 text-xs text-muted transition-colors hover:bg-surface-2 hover:text-ink"
              >
                {t.example}
                <span className="sr-only"> · {t.exampleLong}</span>
              </button>
              {lines > 0 && (
                <button
                  type="button"
                  onClick={clear}
                  className="rounded-md px-2.5 py-1.5 text-xs text-muted transition-colors hover:bg-surface-2 hover:text-ink"
                >
                  {t.clear}
                </button>
              )}
              <button
                type="button"
                onClick={() => run(plan, 'focus')}
                disabled={lines === 0}
                aria-keyshortcuts="Control+Enter Meta+Enter"
                className="rounded-lg bg-accent px-3.5 py-1.5 text-sm font-medium text-accent-ink transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-faint disabled:hover:opacity-100"
              >
                {t.analyze}
              </button>
            </div>
          </div>
        </div>

        {result && !result.ok && (
          <p role="alert" className="mt-3 rounded-lg bg-danger-soft px-3.5 py-2.5 text-sm leading-relaxed text-danger">
            {strings.analysis.errors[result.error]}
          </p>
        )}

        <p className="mt-3 flex items-start gap-2 text-sm leading-relaxed text-muted">
          <LockIcon className="mt-[0.2em] size-4 shrink-0 text-accent" />
          {t.privacy}
        </p>
      </div>

      {analysis && (
        <div id="analysis-result" className="mt-14 scroll-mt-6 sm:mt-16">
          <h2 ref={heading} tabIndex={-1} className="flex items-baseline gap-3 text-lg font-medium text-ink outline-none sm:text-xl">
            <span className="font-mono text-xs text-accent" aria-hidden="true">
              03
            </span>
            {strings.analysis.title}
          </h2>
          <div className="mt-5">
            <Summary analysis={analysis} strings={strings} locale={locale} onShowNode={showNode} />
          </div>
          <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-8">
            <div className="lg:sticky lg:top-6 lg:order-2 lg:max-h-[calc(100dvh-3rem)] lg:self-start lg:overflow-y-auto lg:p-1">
              <Findings
                analysis={analysis}
                strings={strings}
                locale={locale}
                flashed={flashedFinding}
                onHighlight={setHovered}
                onShowNode={showNode}
              />
            </div>
            <div className="lg:order-1">
              <PlanTree analysis={analysis} strings={strings} locale={locale} highlighted={highlighted} onShowFinding={showFinding} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
