import type { APIRoute } from 'astro';
import { MAX_PLAN_BYTES, sharePath, type CreateError } from '../../share/config';
import { sessionStore } from '../../share/server';
import { createSession } from '../../share/session';

export const prerender = false;

const STATUS: Record<CreateError, number> = {
  invalid: 400,
  'too-large': 413,
  'not-a-plan': 422,
  'rate-limited': 429,
  unavailable: 503,
};

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

/** Crea un link compartido: `{ plan, hours: 2 | 4, masked, lang }` → `{ id, path, expiresAt }` */
export const POST: APIRoute = async ({ request, clientAddress }) => {
  const store = sessionStore();
  if (!store) return json({ error: 'unavailable' }, STATUS.unavailable);
  if (!request.headers.get('content-type')?.includes('application/json')) return json({ error: 'invalid' }, STATUS.invalid);
  // El JSON agrega algo de peso al plan; más del doble del máximo ni se lee
  if (Number(request.headers.get('content-length') ?? 0) > MAX_PLAN_BYTES * 2) return json({ error: 'too-large' }, STATUS['too-large']);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'invalid' }, STATUS.invalid);
  }

  let ip = 'desconocida';
  try {
    ip = clientAddress;
  } catch {
    ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || ip;
  }

  try {
    const result = await createSession(store, body, { ip });
    if (!result.ok) return json({ error: result.error }, STATUS[result.error]);
    return json({ id: result.id, path: sharePath(result.session.lang, result.id), expiresAt: result.session.expiresAt }, 201);
  } catch (error) {
    console.error('No se pudo crear el link compartido', error);
    return json({ error: 'unavailable' }, STATUS.unavailable);
  }
};
