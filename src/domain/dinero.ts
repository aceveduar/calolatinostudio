const fmt = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 2, minimumFractionDigits: 0 });

/** centavos -> "$40" */
export function dinero(centavos: number): string {
  return fmt.format(centavos / 100);
}

/** "40.50" -> 4050 */
export function aCentavos(texto: string): number {
  const n = Number(texto.replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

export function aPesosTexto(centavos: number): string {
  return String(centavos / 100);
}
