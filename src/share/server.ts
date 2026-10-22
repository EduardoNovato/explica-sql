import { KV_REST_API_TOKEN, KV_REST_API_URL, UPSTASH_REDIS_REST_TOKEN, UPSTASH_REDIS_REST_URL } from 'astro:env/server';
import type { StoredSession } from './config';
import { readSession } from './session';
import { memoryStore, upstashStore, type SessionStore } from './store';

const devStore = globalThis as typeof globalThis & { __explicaSqlStore?: SessionStore };

/**
 * Upstash si están sus variables; en desarrollo, memoria (se pierde al reiniciar el servidor).
 * En producción sin variables devuelve `null` y compartir queda desactivado.
 */
export function sessionStore(): SessionStore | null {
  const url = UPSTASH_REDIS_REST_URL ?? KV_REST_API_URL;
  const token = UPSTASH_REDIS_REST_TOKEN ?? KV_REST_API_TOKEN;
  if (url && token) return upstashStore({ url, token });
  if (import.meta.env.DEV) return (devStore.__explicaSqlStore ??= memoryStore());
  return null;
}

/**
 * Lee un link para su página y deja listas las cabeceras: un plan compartido es privado (ni caché
 * compartida ni buscadores). 404 si venció o no existe; 503 si no hay cómo leerlo.
 */
export async function loadSharedPage(id: string, response: ResponseInit & { headers: Headers }) {
  response.headers.set('Cache-Control', 'private, no-store');
  response.headers.set('X-Robots-Tag', 'noindex, nofollow');

  const store = sessionStore();
  let session: StoredSession | null = null;
  let failed = store === null;
  if (store) {
    try {
      session = await readSession(store, id);
    } catch (error) {
      console.error('No se pudo leer el link compartido', error);
      failed = true;
    }
  }
  if (!session) response.status = failed ? 503 : 404;
  return { session, failed };
}
