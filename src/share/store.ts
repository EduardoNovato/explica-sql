/**
 * Dónde viven los links compartidos. En producción, Redis de Upstash por su API REST (sin
 * dependencias); en desarrollo y en las pruebas, un mapa en memoria que respeta el mismo vencimiento.
 * Redis borra cada link solo cuando vence su TTL: no hay que limpiar nada a mano.
 */
export interface SessionStore {
  /** Guarda el valor con vencimiento si el id está libre; `false` si ya existía */
  put(id: string, value: string, ttlSeconds: number): Promise<boolean>;
  get(id: string): Promise<string | null>;
  /** Suma un uso a la clave en la ventana actual y devuelve cuántos van */
  hit(key: string, windowSeconds: number): Promise<number>;
}

const sessionKey = (id: string) => `s:${id}`;
const limitKey = (key: string) => `rl:${key}`;

export function upstashStore({ url, token, fetch = globalThis.fetch }: { url: string; token: string; fetch?: typeof globalThis.fetch }): SessionStore {
  async function command(args: (string | number)[]): Promise<unknown> {
    const response = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(args),
    });
    if (!response.ok) throw new Error(`Upstash respondió ${response.status}`);
    const data = (await response.json()) as { result?: unknown; error?: string };
    if (data.error) throw new Error(`Upstash: ${data.error}`);
    return data.result;
  }

  return {
    async put(id, value, ttlSeconds) {
      return (await command(['SET', sessionKey(id), value, 'EX', ttlSeconds, 'NX'])) === 'OK';
    },
    async get(id) {
      const result = await command(['GET', sessionKey(id)]);
      return typeof result === 'string' ? result : null;
    },
    async hit(key, windowSeconds) {
      const count = Number(await command(['INCR', limitKey(key)]));
      if (count === 1) await command(['EXPIRE', limitKey(key), windowSeconds]);
      return count;
    },
  };
}

export function memoryStore(now: () => number = Date.now): SessionStore {
  const entries = new Map<string, { value: string; expiresAt: number }>();
  const alive = (key: string) => {
    const entry = entries.get(key);
    if (entry && entry.expiresAt <= now()) {
      entries.delete(key);
      return undefined;
    }
    return entry;
  };

  return {
    async put(id, value, ttlSeconds) {
      if (alive(sessionKey(id))) return false;
      entries.set(sessionKey(id), { value, expiresAt: now() + ttlSeconds * 1000 });
      return true;
    },
    async get(id) {
      return alive(sessionKey(id))?.value ?? null;
    },
    async hit(key, windowSeconds) {
      const entry = alive(limitKey(key));
      const count = (entry ? Number(entry.value) : 0) + 1;
      entries.set(limitKey(key), { value: String(count), expiresAt: entry?.expiresAt ?? now() + windowSeconds * 1000 });
      return count;
    },
  };
}
