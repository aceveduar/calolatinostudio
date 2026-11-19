/** Cómo se muestran los nombres. */

/** Nombre corto para la cuadrícula: "Ana López" → "Ana L." */
export function nombreCorto(n: string): string {
  const [a, b] = n.trim().split(/\s+/);
  return b ? `${a} ${b[0]}.` : a;
}

/** Como aparece un alumno en público (página): "Ana López Pérez" → "Ana L." Nunca el nombre completo. */
export function nombrePublico(nombre: string): string {
  const [a, b] = nombre.trim().split(/\s+/);
  return b ? `${a} ${b[0].toUpperCase()}.` : a;
}

