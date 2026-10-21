# Explica SQL

Pega el resultado de `EXPLAIN ANALYZE` de PostgreSQL y en milisegundos te dice si la consulta es lenta,
dónde se va el tiempo y qué hacer, con el SQL listo para copiar. En español e inglés.

> **Estado:** en construcción. Ya está la base (página bilingüe, temas claro y oscuro, pruebas);
> el motor de análisis es lo siguiente.

## Cómo se usa

1. Ejecuta tu consulta con `EXPLAIN (ANALYZE, BUFFERS) SELECT …` en psql, DBeaver o pgAdmin.
2. Pega el resultado (texto o JSON) en la página.

El análisis corre en tu navegador: el plan no sale de tu computadora.

## Desarrollo

Requiere Node 22.12 o superior.

```bash
npm install
npm run dev      # http://localhost:4321
npm test         # Vitest
npm run check    # astro check (tipos)
npm run build
```

## Estructura

```
src/
  engine/      motor de análisis: TypeScript puro, sin dependencias de interfaz
  components/  componentes Astro y la isla de React
  i18n/ui.ts   textos en español e inglés
  layouts/     plantilla base (fuentes, tema sin parpadeo)
  pages/       / (español) y /en/ (inglés)
```

Hecho con Astro, React, TypeScript y Tailwind CSS.

## Licencia

[MIT](LICENSE) © Eduardo Coronell
