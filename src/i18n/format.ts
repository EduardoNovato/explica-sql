/** Duración legible: `0,03 ms`, `116,7 ms`, `1,52 s` (separador decimal según el idioma) */
export function formatMs(ms: number, locale: string): string {
  if (ms >= 1000) {
    const seconds = ms / 1000;
    return `${new Intl.NumberFormat(locale, { maximumFractionDigits: seconds >= 10 ? 1 : 2 }).format(seconds)} s`;
  }
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: ms < 10 ? 2 : 1 }).format(ms)} ms`;
}

/** Entero con separador de miles: `5.460.012` */
export const formatCount = (value: number, locale: string) =>
  new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(value);

/** Conteo corto para espacios estrechos: completo hasta 999.999 y `5,5 M` desde el millón */
export const formatCompact = (value: number, locale: string) =>
  value < 1_000_000 ? formatCount(value, locale) : new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 1 }).format(value);

/** Fracción como porcentaje con un decimal: `63,9 %` */
export const formatPercent = (share: number, locale: string) =>
  new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 1 }).format(share);

/** Tamaño desde kilobytes: `980 kB`, `2,4 MB`, `1,2 GB` */
export function formatKb(kb: number, locale: string): string {
  const number = (value: number) => new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(value);
  if (kb < 1024) return `${formatCount(kb, locale)} kB`;
  if (kb < 1024 * 1024) return `${number(kb / 1024)} MB`;
  return `${number(kb / 1024 / 1024)} GB`;
}

/** Cuántas veces: `3.870×` */
export const formatFactor = (factor: number, locale: string) => `${formatCount(Math.round(factor), locale)}×`;

/** `{n} líneas` → `12 líneas`, con singular y plural */
export const plural = ([one, other]: readonly [string, string], n: number, locale: string) =>
  (n === 1 ? one : other).replace('{n}', formatCount(n, locale));
