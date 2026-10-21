/** Duración legible: `0,03 ms`, `116,7 ms`, `1,52 s` (separador decimal según el idioma) */
export function formatMs(ms: number, locale: string): string {
  if (ms >= 1000) {
    const seconds = ms / 1000;
    return `${new Intl.NumberFormat(locale, { maximumFractionDigits: seconds >= 10 ? 1 : 2 }).format(seconds)} s`;
  }
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: ms < 10 ? 2 : 1 }).format(ms)} ms`;
}
