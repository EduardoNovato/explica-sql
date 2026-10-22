/** Reglas de las sesiones compartidas: cuánto duran, cuánto pueden pesar y cuántas se pueden crear */

/** Horas que puede durar un link */
export const SHARE_HOURS = [2, 4] as const;
export type ShareHours = (typeof SHARE_HOURS)[number];

/** Tamaño máximo del plan que se guarda (texto UTF-8) */
export const MAX_PLAN_BYTES = 512 * 1024;

/** Largo del id del link: 62^6 ≈ 56 mil millones de combinaciones */
export const ID_LENGTH = 6;

/** Links que una misma IP puede crear por ventana de tiempo */
export const RATE_LIMIT = { maxPerWindow: 20, windowSeconds: 60 * 60 };

export type ShareLang = 'es' | 'en';

/** Lo que se guarda en Redis por cada link */
export interface StoredSession {
  v: 1;
  plan: string;
  /** Si los valores literales se ocultaron antes de compartir */
  masked: boolean;
  rulesVersion: number;
  lang: ShareLang;
  createdAt: number;
  expiresAt: number;
}

export type CreateError = 'invalid' | 'too-large' | 'not-a-plan' | 'rate-limited' | 'unavailable';

export const sharePath = (lang: ShareLang, id: string) => `${lang === 'es' ? '' : '/en'}/s/${id}`;
