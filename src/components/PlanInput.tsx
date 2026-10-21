import { useState } from 'react';
import type { UiStrings } from '../i18n/ui';

interface Props {
  strings: UiStrings['input'];
  locale: string;
  labelledBy: string;
  describedBy?: string;
}

// Área donde se pega el plan. Por ahora solo cuenta líneas: el análisis llega con el motor (fase 1).
export default function PlanInput({ strings, locale, labelledBy, describedBy }: Props) {
  const [plan, setPlan] = useState('');
  const lines = plan.trim() === '' ? 0 : plan.trimEnd().split(/\r?\n/).length;
  const count =
    lines === 0
      ? strings.empty
      : (lines === 1 ? strings.lineOne : strings.lineOther).replace('{n}', new Intl.NumberFormat(locale).format(lines));

  return (
    <div className="theme-fade overflow-hidden rounded-xl border border-line-strong bg-surface transition-colors focus-within:border-accent">
      <textarea
        value={plan}
        onChange={(event) => setPlan(event.target.value)}
        aria-labelledby={labelledBy}
        aria-describedby={describedBy}
        placeholder={strings.placeholder}
        rows={10}
        wrap="off"
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        translate="no"
        className="block min-h-48 w-full resize-y bg-transparent px-4 py-3.5 font-mono text-[12.5px] leading-[1.7] text-ink [font-variant-ligatures:none] placeholder:text-faint placeholder-shown:overflow-hidden focus-visible:outline-none"
      />
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-line px-3.5 py-2.5">
        <span className="font-mono text-[11px] text-faint tabular-nums">{count}</span>
        <div className="ml-auto flex items-center gap-2">
          {lines > 0 && (
            <button
              type="button"
              onClick={() => setPlan('')}
              className="rounded-md px-2.5 py-1.5 text-xs text-muted transition-colors hover:bg-surface-2 hover:text-ink"
            >
              {strings.clear}
            </button>
          )}
          <span className="font-mono text-[10.5px] text-faint">{strings.soon}</span>
          <button
            type="button"
            disabled
            className="rounded-lg bg-accent px-3.5 py-1.5 text-sm font-medium text-accent-ink disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-faint"
          >
            {strings.analyze}
          </button>
        </div>
      </div>
    </div>
  );
}
