/// <reference types="vitest/config" />
import { getViteConfig } from 'astro/config';

// Mediciones (npm run bench) y caso TPC-H (npm run tpch): aparte de las pruebas normales
export default getViteConfig({
  test: {
    include: ['bench/**/*.bench.ts'],
    // Las corridas se miden una tras otra: nada de hilos compitiendo por la CPU
    fileParallelism: false,
    // Que se vea la tabla de resultados
    silent: false,
    testTimeout: 30 * 60 * 1000,
    hookTimeout: 30 * 60 * 1000,
  },
});
