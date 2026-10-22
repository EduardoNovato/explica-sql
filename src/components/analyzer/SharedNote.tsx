import { useEffect, useState } from 'react';
import { InfoIcon } from './icons';
import type { AnalyzerStrings } from './strings';

export interface SharedPlan {
  plan: string;
  expiresAt: number;
  masked: boolean;
  rulesVersion: number;
  currentRulesVersion: number;
}

interface Props {
  shared: SharedPlan;
  locale: string;
  strings: AnalyzerStrings['share'];
}

/** Hora y tiempo restante en la zona horaria de quien mira (por eso se calcula en el navegador) */
function expiryText(expiresAt: number, locale: string, t: AnalyzerStrings['share']): string {
  const minutes = Math.round((expiresAt - Date.now()) / 60_000);
  if (minutes <= 0) return t.expired;
  const relative = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  return t.expires
    .replace('{time}', new Intl.DateTimeFormat(locale, { timeStyle: 'short' }).format(expiresAt))
    .replace('{relative}', minutes < 60 ? relative.format(minutes, 'minute') : relative.format(Math.round(minutes / 60), 'hour'));
}

export default function SharedNote({ shared, locale, strings: t }: Props) {
  const [expiry, setExpiry] = useState('');

  useEffect(() => {
    const update = () => setExpiry(expiryText(shared.expiresAt, locale, t));
    update();
    const timer = window.setInterval(update, 60_000);
    return () => window.clearInterval(timer);
  }, [shared.expiresAt, locale, t]);

  const otherVersion = shared.rulesVersion !== shared.currentRulesVersion;

  return (
    <div className="mb-4 flex min-h-11 items-start gap-2.5 rounded-lg bg-accent-soft px-3.5 py-2.5 text-sm leading-relaxed text-ink">
      <InfoIcon className="mt-0.5 size-4 shrink-0 text-accent" />
      <p className="space-x-1">
        {expiry && <time dateTime={new Date(shared.expiresAt).toISOString()}>{expiry}</time>}
        {shared.masked && <span>{t.masked}</span>}
        {otherVersion && (
          <span>{t.otherVersion.replace('{from}', String(shared.rulesVersion)).replace('{to}', String(shared.currentRulesVersion))}</span>
        )}
      </p>
    </div>
  );
}
