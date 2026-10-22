import { useEffect, useRef, useState, type SubmitEvent } from 'react';
import { SHARE_HOURS, type ShareHours, type ShareLang } from '../../share/config';
import { maskLiterals } from '../../share/mask';
import CopyButton from './CopyButton';
import type { AnalyzerStrings } from './strings';

interface Props {
  plan: string;
  lang: ShareLang;
  locale: string;
  strings: AnalyzerStrings['share'];
}

type ErrorCode = keyof AnalyzerStrings['share']['errors'];

/** Crea el link temporal. Si se ocultan los valores, se hace aquí, antes de enviar nada */
export default function SharePanel({ plan, lang, locale, strings: t }: Props) {
  const [hours, setHours] = useState<ShareHours>(2);
  const [mask, setMask] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<ErrorCode | null>(null);
  const [link, setLink] = useState<{ url: string; expiresAt: number } | null>(null);
  const linkInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (link) linkInput.current?.focus();
  }, [link]);

  const submit = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSending(true);
    setError(null);
    try {
      const response = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: mask ? maskLiterals(plan) : plan, hours, masked: mask, lang }),
      });
      const data = (await response.json().catch(() => ({}))) as { path?: string; expiresAt?: number; error?: string };
      if (response.ok && data.path && data.expiresAt) {
        setLink({ url: new URL(data.path, window.location.origin).href, expiresAt: data.expiresAt });
      } else {
        setError(data.error && data.error in t.errors ? (data.error as ErrorCode) : 'unavailable');
      }
    } catch {
      setError('network');
    } finally {
      setSending(false);
    }
  };

  const time = link ? new Intl.DateTimeFormat(locale, { timeStyle: 'short' }).format(link.expiresAt) : '';

  return (
    <section
      id="share-panel"
      aria-labelledby="share-title"
      className="theme-fade mt-4 max-w-3xl rounded-xl border border-line-strong bg-surface p-4 sm:p-5"
    >
      <h3 id="share-title" className="text-base font-medium text-ink">
        {t.title}
      </h3>
      <p className="mt-1.5 text-sm leading-relaxed text-pretty text-muted">{t.privacy}</p>

      {link ? (
        <div className="mt-4">
          <p className="text-sm text-ink" role="status">
            {t.ready.replace('{time}', time)}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <label className="sr-only" htmlFor="share-link">
              {t.linkLabel}
            </label>
            <input
              ref={linkInput}
              id="share-link"
              readOnly
              value={link.url}
              onFocus={(event) => event.currentTarget.select()}
              className="min-w-0 flex-1 rounded-lg border border-line-strong bg-bg px-3 py-2 font-mono text-[12.5px] text-ink focus-visible:outline-accent"
            />
            <CopyButton text={link.url} label={t.copy} copied={t.copied} error={t.copyError} />
          </div>
        </div>
      ) : (
        <form onSubmit={submit} className="mt-4 space-y-4">
          <fieldset>
            <legend className="text-sm text-ink">{t.duration}</legend>
            <div className="mt-2 inline-flex rounded-lg border border-line p-0.5">
              {SHARE_HOURS.map((option) => (
                <label
                  key={option}
                  className="cursor-pointer rounded-md px-3 py-1.5 text-sm text-muted transition-colors has-checked:bg-surface-2 has-checked:text-ink has-focus-visible:outline-2 has-focus-visible:outline-accent"
                >
                  <input
                    type="radio"
                    name="share-hours"
                    value={option}
                    checked={hours === option}
                    onChange={() => setHours(option)}
                    className="sr-only"
                  />
                  {t.hours.replace('{n}', String(option))}
                </label>
              ))}
            </div>
          </fieldset>

          <div>
            <label className="flex cursor-pointer items-start gap-2.5 text-sm text-ink">
              <input
                type="checkbox"
                checked={mask}
                onChange={(event) => setMask(event.target.checked)}
                aria-describedby="share-mask-hint"
                className="mt-0.5 size-4 shrink-0 accent-accent"
              />
              {t.mask}
            </label>
            <p id="share-mask-hint" className="mt-1 pl-[26px] text-xs leading-relaxed text-muted">
              {t.maskHint}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={sending}
              className="rounded-lg bg-accent px-3.5 py-1.5 text-sm font-medium text-accent-ink transition-opacity hover:opacity-90 disabled:cursor-wait disabled:opacity-60"
            >
              {sending ? t.creating : t.create}
            </button>
            {error && (
              <p role="alert" className="text-sm text-danger">
                {t.errors[error]}
              </p>
            )}
          </div>
        </form>
      )}
    </section>
  );
}
