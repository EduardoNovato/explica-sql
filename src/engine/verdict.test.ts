import { describe, expect, it } from 'vitest';
import { verdictFor } from './verdict';

describe('veredicto global', () => {
  it.each([
    [0.032, 'fast'],
    [9.99, 'fast'],
    [10, 'acceptable'],
    [99.9, 'acceptable'],
    [100, 'slow'],
    [1000, 'slow'],
    [1000.1, 'very-slow'],
    [45_000, 'very-slow'],
  ] as const)('%s ms → %s', (ms, verdict) => {
    expect(verdictFor(ms)).toBe(verdict);
  });
});
