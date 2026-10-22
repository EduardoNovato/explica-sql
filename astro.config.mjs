// @ts-check
import { defineConfig, envField } from 'astro/config';
import react from '@astrojs/react';
import vercel from '@astrojs/vercel';
import tailwindcss from '@tailwindcss/vite';

const secret = () => envField.string({ context: 'server', access: 'secret', optional: true });

export default defineConfig({
  site: 'https://explica-sql.vercel.app',
  // Todo es estático salvo la API y los links compartidos (`prerender = false`), que corren en Vercel
  adapter: vercel(),
  i18n: {
    defaultLocale: 'es',
    locales: ['es', 'en'],
    routing: { prefixDefaultLocale: false },
  },
  env: {
    schema: {
      // Redis de Upstash para los links compartidos. La integración de Vercel crea los KV_*.
      UPSTASH_REDIS_REST_URL: secret(),
      UPSTASH_REDIS_REST_TOKEN: secret(),
      KV_REST_API_URL: secret(),
      KV_REST_API_TOKEN: secret(),
    },
  },
  integrations: [react()],
  vite: {
    plugins: [tailwindcss()],
  },
});
