import { useEffect, useState } from 'react';
import { CheckIcon, CopyIcon } from './icons';

interface Props {
  text: string;
  label: string;
  copied: string;
  error: string;
}

export default function CopyButton({ text, label, copied, error }: Props) {
  const [state, setState] = useState<'idle' | 'copied' | 'error'>('idle');

  useEffect(() => {
    if (state === 'idle') return;
    const timer = window.setTimeout(() => setState('idle'), 2400);
    return () => window.clearTimeout(timer);
  }, [state]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setState('copied');
    } catch {
      setState('error');
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={copy}
        className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 font-mono text-[11px] text-muted transition-colors hover:bg-surface-2 hover:text-accent"
      >
        {state === 'copied' ? <CheckIcon className="size-3.5 text-accent" /> : <CopyIcon />}
        {state === 'copied' ? copied : label}
      </button>
      <span className="sr-only" role="status" aria-live="polite">
        {state === 'copied' ? copied : state === 'error' ? error : ''}
      </span>
      {state === 'error' && <span className="text-[11px] text-danger">{error}</span>}
    </>
  );
}
