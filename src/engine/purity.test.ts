import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// Prueba de humo de la fase 0: confirma que Vitest corre y deja vigilada una regla de arquitectura.
// El motor solo puede importar archivos de su propia carpeta y no puede tocar APIs del navegador.
// Lee el disco en cada corrida (no import.meta.glob) para que la caché de Vitest no oculte archivos nuevos.
const engineDir = new URL('.', import.meta.url);
const files = readdirSync(engineDir, { recursive: true, encoding: 'utf8' })
  .map((file) => file.replaceAll('\\', '/'))
  .filter((file) => file.endsWith('.ts') && !file.endsWith('.test.ts'))
  .map((file) => [file, readFileSync(new URL(file, engineDir), 'utf8')] as const);

const root = 'file:///engine/';
const importPattern = /(?:\bfrom\s*|\bimport\s*\(?\s*)['"]([^'"]+)['"]/g;
const browserPattern = /\b(?:window|document|navigator|localStorage|sessionStorage)\s*\./;

function importsOutsideEngine(file: string, source: string) {
  const here = new URL(file, root);
  return [...source.matchAll(importPattern)]
    .map((match) => match[1] ?? '')
    .filter((specifier) => !specifier.startsWith('.') || !new URL(specifier, here).href.startsWith(root));
}

describe('motor', () => {
  it('tiene archivos fuente', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it.each(files)('%s solo importa archivos del motor', (file, source) => {
    expect(importsOutsideEngine(file, source)).toEqual([]);
  });

  it.each(files)('%s no usa APIs del navegador', (_file, source) => {
    expect(source).not.toMatch(browserPattern);
  });
});
