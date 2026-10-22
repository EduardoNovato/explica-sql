import { ID_LENGTH } from './config';

const ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
/** Bytes por encima de esto se descartan para que cada letra tenga la misma probabilidad (248 = 62 × 4) */
const UNBIASED_LIMIT = 248;

type RandomBytes = (count: number) => Uint8Array;
const cryptoBytes: RandomBytes = (count) => crypto.getRandomValues(new Uint8Array(count));

/** Id corto y difícil de adivinar para el link: `k7Pq2x` */
export function newId(random: RandomBytes = cryptoBytes): string {
  let id = '';
  while (id.length < ID_LENGTH) {
    for (const byte of random(ID_LENGTH * 2)) {
      if (byte >= UNBIASED_LIMIT) continue;
      id += ALPHABET[byte % ALPHABET.length];
      if (id.length === ID_LENGTH) break;
    }
  }
  return id;
}

export const isValidId = (id: string) => new RegExp(`^[0-9A-Za-z]{${ID_LENGTH}}$`).test(id);
