/**
 * Invitar a un amigo: el alumno comparte la página de la academia con su huella (?de=…). Quien se inscribe
 * desde ese enlace queda en Interesados con quién lo invitó. La huella no es su código del QR ni su enlace
 * del portal: solo sirve para saber de parte de quién viene. Funciones puras (sin base ni pantalla).
 */

/** La huella de invitación: 8 caracteres hexadecimales (la calcula la base a partir del alumno). */
export const huellaValida = (de: string | null | undefined): de is string => !!de && /^[0-9a-f]{8}$/.test(de);

export function enlaceInvitacion(origen: string, slug: string, de: string): string {
  return `${origen}/a/${slug}?de=${de}`;
}

/** La huella que trae la dirección de la página (?de=…), o null si no trae una válida. */
export function leerHuella(busqueda: string): string | null {
  const de = new URLSearchParams(busqueda).get('de')?.toLowerCase() ?? null;
  return huellaValida(de) ? de : null;
}

/** El mensaje que el alumno manda por WhatsApp a su amigo. */
export function mensajeInvitacion(academia: string, url: string): string {
  return `¡Vente a bailar conmigo a ${academia}! 💃🕺 Aquí ves horarios y precios, y apartas tu primera clase: ${url}`;
}

/** "Has invitado a 3 amigos · 1 ya se inscribió" */
export function textoInvitados(invitados: number, inscritos: number): string | null {
  if (!invitados) return null;
  const base = `Has invitado a ${invitados} ${invitados === 1 ? 'amigo' : 'amigos'}`;
  return inscritos ? `${base} · ${inscritos} ya ${inscritos === 1 ? 'se inscribió' : 'se inscribieron'} 🎉` : base;
}
