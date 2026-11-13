/** QR del alumno: lleva su código interno (6 caracteres), nunca datos personales. */
const PREFIJO = 'COMPAS:';

export function contenidoQR(codigo: string): string {
  return `${PREFIJO}${codigo}`;
}

/** Acepta "COMPAS:ABC123" o el código suelto. Devuelve null si no es de Compás. */
export function leerQR(texto: string): string | null {
  const t = texto.trim().toUpperCase();
  if (t.startsWith(PREFIJO)) return t.slice(PREFIJO.length) || null;
  return /^[A-Z0-9]{6}$/.test(t) ? t : null;
}
