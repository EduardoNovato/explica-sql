import type { Verdict } from '../engine';

export const languages = {
  es: { label: 'ES', name: 'Español', locale: 'es-CO', path: '/' },
  en: { label: 'EN', name: 'English', locale: 'en-US', path: '/en/' },
} as const;

export type Lang = keyof typeof languages;
export const defaultLang: Lang = 'es';

export const author = {
  name: 'Eduardo Coronell',
  portfolio: 'https://eduardocoronell.vercel.app',
};

const es = {
  meta: {
    title: 'Explica SQL · Entiende el EXPLAIN ANALYZE de PostgreSQL',
    description:
      'Pega el resultado de EXPLAIN ANALYZE de PostgreSQL y descubre en milisegundos si tu consulta es lenta, dónde se va el tiempo y qué hacer. El análisis corre en tu navegador.',
  },
  skip: 'Saltar al contenido',
  header: {
    home: 'Explica SQL, inicio',
    langLabel: 'Idioma',
    darkMode: 'Modo oscuro',
  },
  hero: {
    eyebrow: 'PostgreSQL · EXPLAIN ANALYZE',
    tagline:
      'Pega el plan de ejecución de tu consulta y descubre en milisegundos si es lenta, dónde se va el tiempo y qué hacer, con el SQL listo para copiar.',
  },
  command: {
    title: 'Ejecuta tu consulta así',
    copy: 'Copiar',
    copyLong: 'Copiar el comando EXPLAIN',
    copied: 'Comando copiado',
    copyError: 'No se pudo copiar. Selecciónalo y cópialo a mano.',
    hint: 'ANALYZE ejecuta la consulta de verdad para medir los tiempos: si es un INSERT, UPDATE o DELETE, envuélvela en BEGIN … ROLLBACK. BUFFERS agrega cuánto se leyó de memoria y de disco.',
  },
  input: {
    title: 'Pega el resultado',
    hint: 'Sirve el texto que copias de DBeaver, pgAdmin o psql, o el formato JSON.',
    placeholder: [
      'QUERY PLAN',
      'Seq Scan on pedidos  (cost=0.00..1.08 rows=8 width=44) (actual time=0.011..0.014 rows=8 loops=1)',
      '  Buffers: shared hit=1',
      'Planning Time: 0.062 ms',
      'Execution Time: 0.032 ms',
    ].join('\n'),
    lineOne: '{n} línea',
    lineOther: '{n} líneas',
    empty: 'Sin plan todavía',
    clear: 'Limpiar',
    analyze: 'Analizar',
    soon: 'Muy pronto',
    privacy: 'El análisis corre en tu navegador: el plan no sale de tu computadora.',
  },
  verdict: {
    fast: 'Rápida',
    acceptable: 'Aceptable',
    slow: 'Lenta',
    'very-slow': 'Muy lenta',
  } satisfies Record<Verdict, string>,
  footer: {
    madeBy: 'Hecho por',
    place: 'en Barranquilla',
    license: 'Código abierto · MIT',
  },
};

export type UiStrings = typeof es;

const en: UiStrings = {
  meta: {
    title: 'Explica SQL · Understand PostgreSQL’s EXPLAIN ANALYZE',
    description:
      'Paste the output of PostgreSQL’s EXPLAIN ANALYZE and find out in milliseconds whether your query is slow, where the time goes and what to do. The analysis runs in your browser.',
  },
  skip: 'Skip to Content',
  header: {
    home: 'Explica SQL, home',
    langLabel: 'Language',
    darkMode: 'Dark Mode',
  },
  hero: {
    eyebrow: 'PostgreSQL · EXPLAIN ANALYZE',
    tagline:
      'Paste your query’s execution plan and find out in milliseconds whether it is slow, where the time goes and what to do, with the SQL ready to copy.',
  },
  command: {
    title: 'Run Your Query Like This',
    copy: 'Copy',
    copyLong: 'Copy the EXPLAIN command',
    copied: 'Command copied',
    copyError: 'Couldn’t copy it. Select it and copy it by hand.',
    hint: 'ANALYZE really runs the query to measure it: for an INSERT, UPDATE or DELETE, wrap it in BEGIN … ROLLBACK. BUFFERS adds how much was read from memory and from disk.',
  },
  input: {
    title: 'Paste the Output',
    hint: 'Text copied from DBeaver, pgAdmin or psql works, and so does the JSON format.',
    placeholder: [
      'QUERY PLAN',
      'Seq Scan on orders  (cost=0.00..1.08 rows=8 width=44) (actual time=0.011..0.014 rows=8 loops=1)',
      '  Buffers: shared hit=1',
      'Planning Time: 0.062 ms',
      'Execution Time: 0.032 ms',
    ].join('\n'),
    lineOne: '{n} line',
    lineOther: '{n} lines',
    empty: 'No plan yet',
    clear: 'Clear',
    analyze: 'Analyze',
    soon: 'Coming soon',
    privacy: 'The analysis runs in your browser: your plan never leaves your computer.',
  },
  verdict: {
    fast: 'Fast',
    acceptable: 'Acceptable',
    slow: 'Slow',
    'very-slow': 'Very Slow',
  },
  footer: {
    madeBy: 'Made by',
    place: 'in Barranquilla',
    license: 'Open source · MIT',
  },
};

export const ui: Record<Lang, UiStrings> = { es, en };

export function useTranslations(lang: Lang) {
  return ui[lang];
}
