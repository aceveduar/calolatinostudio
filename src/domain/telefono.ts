export const digitosTelefono = (telefono: string) => telefono.replace(/\D/g, '');

/** Búsqueda por celular. También acepta números parciales y la lada de México. */
export function consultaTelefono(consulta: string): string {
  return /^[+\d ().-]+$/.test(consulta) ? digitosTelefono(consulta).replace(/^521?(?=\d{10}$)/, '') : '';
}
