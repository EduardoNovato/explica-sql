import { parsePlan, RULES_VERSION } from '../engine';
import { MAX_PLAN_BYTES, RATE_LIMIT, SHARE_HOURS, type CreateError, type ShareHours, type ShareLang, type StoredSession } from './config';
import { isValidId, newId } from './id';
import type { SessionStore } from './store';

/** Intentos de id antes de rendirse si justo existe (casi imposible con 62^6) */
const ID_ATTEMPTS = 5;

interface CreateInput {
  plan: string;
  hours: ShareHours;
  masked: boolean;
  lang: ShareLang;
}

function readInput(body: unknown): CreateInput | undefined {
  if (typeof body !== 'object' || body === null) return undefined;
  const { plan, hours, masked, lang } = body as Record<string, unknown>;
  if (typeof plan !== 'string' || typeof masked !== 'boolean') return undefined;
  if (!SHARE_HOURS.includes(hours as ShareHours)) return undefined;
  if (lang !== 'es' && lang !== 'en') return undefined;
  return { plan, hours: hours as ShareHours, masked, lang };
}

export const planBytes = (plan: string) => new TextEncoder().encode(plan).length;

/**
 * Crea un link que vence solo a las 2 o 4 horas. Solo se aceptan planes que el motor puede leer,
 * para que esto no sirva de bloc de notas público.
 */
export async function createSession(
  store: SessionStore,
  body: unknown,
  { ip, now = Date.now() }: { ip: string; now?: number },
): Promise<{ ok: true; id: string; session: StoredSession } | { ok: false; error: CreateError }> {
  const input = readInput(body);
  if (!input) return { ok: false, error: 'invalid' };
  if (planBytes(input.plan) > MAX_PLAN_BYTES) return { ok: false, error: 'too-large' };
  if (!parsePlan(input.plan).ok) return { ok: false, error: 'not-a-plan' };

  const uses = await store.hit(`create:${ip}`, RATE_LIMIT.windowSeconds);
  if (uses > RATE_LIMIT.maxPerWindow) return { ok: false, error: 'rate-limited' };

  const ttlSeconds = input.hours * 60 * 60;
  const session: StoredSession = {
    v: 1,
    plan: input.plan,
    masked: input.masked,
    rulesVersion: RULES_VERSION,
    lang: input.lang,
    createdAt: now,
    expiresAt: now + ttlSeconds * 1000,
  };
  for (let attempt = 0; attempt < ID_ATTEMPTS; attempt++) {
    const id = newId();
    if (await store.put(id, JSON.stringify(session), ttlSeconds)) return { ok: true, id, session };
  }
  return { ok: false, error: 'unavailable' };
}

/**
 * El link guardado, o `null` si venció, no existe o el id no es válido. Redis ya lo borra al vencer;
 * la fecha se revisa de todas formas por si el almacén no aplicara el TTL.
 */
export async function readSession(store: SessionStore, id: string, now = Date.now()): Promise<StoredSession | null> {
  if (!isValidId(id)) return null;
  const raw = await store.get(id);
  if (raw === null) return null;
  try {
    const session = JSON.parse(raw) as StoredSession;
    const valid = session.v === 1 && typeof session.plan === 'string' && typeof session.expiresAt === 'number';
    return valid && session.expiresAt > now ? session : null;
  } catch {
    return null;
  }
}
