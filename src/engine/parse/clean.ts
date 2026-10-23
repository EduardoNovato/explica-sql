/**
 * Deja solo las líneas del plan, sin lo que agregan los clientes SQL: el encabezado `QUERY PLAN`
 * (o `PLAN_TABLE_OUTPUT` de Oracle), los separadores y el conteo de filas de psql, el `+` de
 * continuación de psql, los bordes `|` de la vista de texto de DBeaver y las comillas de pgAdmin.
 * Conserva la sangría: de ella sale el árbol.
 *
 * Ojo: nada de expresiones como `\s+$` sobre la línea completa. Con sangrías largas (planes
 * profundos) se vuelven cuadráticas; se usa trimEnd y comparaciones directas.
 */
export function cleanLines(input: string): string[] {
  let lines = input
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.trimEnd())
    .filter((line) => line.trim() !== '');

  // Vista de texto de DBeaver: cada fila termina en "|"
  if (lines.length > 0 && lines.every((line) => line.endsWith('|') || isSeparator(line.trim()))) {
    lines = lines.map((line) => (line.endsWith('|') ? line.slice(0, -1).trimEnd() : line));
  }

  // psql: los valores de varias líneas (como FORMAT JSON) terminan en " +"
  const continues = (line: string) => line.endsWith('+') && /\s/.test(line.charAt(line.length - 2));
  const continued = lines.filter(continues).length;
  if (continued > 0 && continued >= lines.length / 2) {
    lines = lines.map((line) => (continues(line) ? line.slice(0, -1).trimEnd() : line));
  }

  return lines
    .map((line) => unquote(line).trimEnd())
    .filter((line) => {
      const text = line.trim();
      return text !== '' && !isHeader(text) && !isSeparator(text) && !isRowCount(text);
    });
}

/** pgAdmin copia cada fila entre comillas dobles y duplica las comillas internas */
function unquote(line: string): string {
  return line.length >= 2 && line.startsWith('"') && line.endsWith('"') ? line.slice(1, -1).replace(/""/g, '"') : line;
}

// Reciben la línea ya recortada
const isHeader = (text: string) => /^"?(QUERY PLAN|PLAN_TABLE_OUTPUT)"?$/i.test(text);
const isSeparator = (text: string) => /^-{3,}[-+]*$/.test(text);
const isRowCount = (text: string) => /^\(\d+ rows?\)$/.test(text);
