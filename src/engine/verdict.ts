import { verdictLimits } from './thresholds';
import type { Verdict } from './types';

/**
 * < 10 ms rápida · 10–100 ms aceptable · 100 ms – 1 s lenta · > 1 s muy lenta.
 * Si el motor mide con poca precisión (A-Time de Oracle va de 10 en 10 ms), lo que no supera esa
 * precisión cuenta como rápido: 00:00:00.01 puede ser 6 ms.
 */
export function verdictFor(ms: number, resolutionMs = 0): Verdict {
  if (ms < verdictLimits.fastBelowMs || ms <= resolutionMs) return 'fast';
  if (ms < verdictLimits.acceptableBelowMs) return 'acceptable';
  if (ms <= verdictLimits.slowUpToMs) return 'slow';
  return 'very-slow';
}
