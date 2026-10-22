import { describe, expect, it, vi } from 'vitest';
import { plans } from '../engine/fixtures';
import { RULES_VERSION } from '../engine';
import { MAX_PLAN_BYTES, RATE_LIMIT } from './config';
import { isValidId, newId } from './id';
import { createSession, readSession } from './session';
import { memoryStore, upstashStore } from './store';

const HOUR = 60 * 60 * 1000;

/** Reloj de mentiras para adelantar el tiempo sin esperar */
function clock(start = Date.UTC(2026, 9, 22, 15, 0)) {
  let now = start;
  return { now: () => now, advance: (ms: number) => (now += ms) };
}

const request = (overrides: Record<string, unknown> = {}) => ({ plan: plans.seqScan, hours: 2, masked: true, lang: 'es', ...overrides });

describe('links compartidos', () => {
  it('guarda el plan con la versión de las reglas y lo devuelve igual', async () => {
    const time = clock();
    const store = memoryStore(time.now);
    const created = await createSession(store, request(), { ip: '1.1.1.1', now: time.now() });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect(isValidId(created.id)).toBe(true);
    expect(await readSession(store, created.id, time.now())).toEqual({
      v: 1,
      plan: plans.seqScan,
      masked: true,
      rulesVersion: RULES_VERSION,
      lang: 'es',
      createdAt: time.now(),
      expiresAt: time.now() + 2 * HOUR,
    });
  });

  it.each([2, 4])('un link de %s horas vence solo', async (hours) => {
    const time = clock();
    const store = memoryStore(time.now);
    const created = await createSession(store, request({ hours }), { ip: '1.1.1.1', now: time.now() });
    if (!created.ok) throw new Error(created.error);

    time.advance(hours * HOUR - 1000);
    expect(await readSession(store, created.id, time.now())).not.toBeNull();
    time.advance(1000);
    expect(await readSession(store, created.id, time.now())).toBeNull();
  });

  it('solo acepta 2 o 4 horas, un idioma conocido y planes que el motor puede leer', async () => {
    const store = memoryStore();
    const create = (overrides: Record<string, unknown>) => createSession(store, request(overrides), { ip: '1.1.1.1' });
    expect(await create({ hours: 24 })).toEqual({ ok: false, error: 'invalid' });
    expect(await create({ lang: 'fr' })).toEqual({ ok: false, error: 'invalid' });
    expect(await create({ masked: 'sí' })).toEqual({ ok: false, error: 'invalid' });
    expect(await createSession(store, 'hola', { ip: '1.1.1.1' })).toEqual({ ok: false, error: 'invalid' });
    expect(await create({ plan: 'mi lista de compras' })).toEqual({ ok: false, error: 'not-a-plan' });
  });

  it(`rechaza planes de más de ${MAX_PLAN_BYTES / 1024} kB`, async () => {
    const big = `${plans.seqScan}\n${'x'.repeat(MAX_PLAN_BYTES)}`;
    expect(await createSession(memoryStore(), request({ plan: big }), { ip: '1.1.1.1' })).toEqual({ ok: false, error: 'too-large' });
  });

  it(`limita a ${RATE_LIMIT.maxPerWindow} links por hora y por IP`, async () => {
    const time = clock();
    const store = memoryStore(time.now);
    const create = (ip: string) => createSession(store, request(), { ip, now: time.now() });
    for (let i = 0; i < RATE_LIMIT.maxPerWindow; i++) expect((await create('2.2.2.2')).ok).toBe(true);
    expect(await create('2.2.2.2')).toEqual({ ok: false, error: 'rate-limited' });
    expect((await create('3.3.3.3')).ok).toBe(true);
    time.advance(RATE_LIMIT.windowSeconds * 1000);
    expect((await create('2.2.2.2')).ok).toBe(true);
  });

  it('no encuentra ids inválidos ni datos dañados', async () => {
    const store = memoryStore();
    await store.put('abc123', '{ roto', 60);
    expect(await readSession(store, 'abc123')).toBeNull();
    expect(await readSession(store, '../etc')).toBeNull();
    expect(await readSession(store, 'zzzzzz')).toBeNull();
  });

  it('genera ids de 6 letras y números', () => {
    const ids = new Set(Array.from({ length: 500 }, () => newId()));
    expect(ids.size).toBe(500);
    for (const id of ids) expect(id).toMatch(/^[0-9A-Za-z]{6}$/);
  });
});

describe('Upstash', () => {
  it('guarda con TTL en segundos y sin pisar un id existente (SET … EX … NX)', async () => {
    const calls: unknown[] = [];
    const fetch = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      calls.push(JSON.parse(String(init?.body)));
      return Response.json({ result: calls.length === 1 ? 1 : 'OK' });
    });
    const store = upstashStore({ url: 'https://ejemplo.upstash.io', token: 'secreto', fetch });
    const created = await createSession(store, request({ hours: 4 }), { ip: '1.1.1.1' });
    if (!created.ok) throw new Error(created.error);

    expect(calls[0]).toEqual(['INCR', 'rl:create:1.1.1.1']);
    expect(calls[1]).toEqual(['EXPIRE', 'rl:create:1.1.1.1', RATE_LIMIT.windowSeconds]);
    expect(calls[2]).toEqual(['SET', `s:${created.id}`, expect.any(String), 'EX', 4 * 60 * 60, 'NX']);
    expect(fetch.mock.calls[0]?.[1]?.headers).toMatchObject({ Authorization: 'Bearer secreto' });
  });

  it('un link vencido en Redis se lee como inexistente', async () => {
    const fetch = vi.fn(async () => Response.json({ result: null }));
    const store = upstashStore({ url: 'https://ejemplo.upstash.io', token: 'secreto', fetch });
    expect(await readSession(store, 'k7Pq2x')).toBeNull();
  });

  it('avisa si Upstash responde con error', async () => {
    const fetch = vi.fn(async () => Response.json({ error: 'WRONGPASS' }, { status: 401 }));
    const store = upstashStore({ url: 'https://ejemplo.upstash.io', token: 'malo', fetch });
    await expect(store.get('k7Pq2x')).rejects.toThrow('401');
  });
});
