import { verdictLimits } from './thresholds';
import type { Verdict } from './types';

/** < 10 ms rápida · 10–100 ms aceptable · 100 ms – 1 s lenta · > 1 s muy lenta */
export function verdictFor(ms: number): Verdict {
  if (ms < verdictLimits.fastBelowMs) return 'fast';
  if (ms < verdictLimits.acceptableBelowMs) return 'acceptable';
  if (ms <= verdictLimits.slowUpToMs) return 'slow';
  return 'very-slow';
}
