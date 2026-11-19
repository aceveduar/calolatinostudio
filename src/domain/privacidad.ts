/**
 * Aviso de privacidad de la página pública (en México es obligatorio si se piden datos personales, como
 * nombre y teléfono en "Agenda tu primera clase"). Si la academia no escribe el suyo, se usa esta base
 * general, que dice qué se pide, para qué y cómo ejercer los derechos ARCO. Es una base: la academia
 * debe revisarla (idealmente con quien lleve sus asuntos legales) y ajustarla a lo que realmente hace.
 */
export function avisoPrivacidadBase(p: { academia: string; direccion?: string | null; whatsapp?: string | null }): string {
  const contacto = p.whatsapp ? `por WhatsApp al ${p.whatsapp}` : 'en recepción';
  return [
    `${p.academia}${p.direccion ? `, con domicilio en ${p.direccion},` : ''} es responsable de los datos personales que nos compartes en esta página.`,
    'Datos que pedimos: tu nombre, tu número de WhatsApp, la clase que te interesa y, si quieres, un mensaje. No pedimos datos sensibles ni de pago.',
    'Para qué los usamos: para escribirte por WhatsApp, darte información de clases, horarios y precios, y apartarte tu lugar. Si te inscribes, también para tu registro como alumno, tus pagos y tus avisos de la academia.',
    'No vendemos ni compartimos tus datos con nadie fuera de la academia, salvo que una autoridad lo pida conforme a la ley.',
    `Tus derechos: puedes pedir ver, corregir o borrar tus datos, u oponerte a que los usemos (derechos ARCO), escribiéndonos ${contacto}. Te respondemos en un máximo de 20 días hábiles.`,
    'Si cambiamos este aviso, lo publicaremos en esta misma página.',
  ].join('\n\n');
}

export function textoAvisoPrivacidad(propio: string | null | undefined, base: Parameters<typeof avisoPrivacidadBase>[0]): string {
  return propio?.trim() || avisoPrivacidadBase(base);
}
