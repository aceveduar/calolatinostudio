/** Mensajes de WhatsApp: plantillas editables por la academia con datos del alumno. */
import type { Academia } from '../db/types';

export type ClaveMensaje = 'bienvenida' | 'credencial' | 'portal' | 'vence' | 'vencio' | 'adeudo' | 'extrañamos' | 'recibo' | 'interesado' | 'grupo';

export const MENSAJES: { clave: ClaveMensaje; titulo: string; cuando: string; base: string }[] = [
  {
    clave: 'bienvenida',
    titulo: 'Bienvenida',
    cuando: 'Al registrar a un alumno nuevo',
    base: '¡Hola {nombre}! Bienvenid@ a {academia} 💃🕺 Nos da mucho gusto que bailes con nosotros. Cualquier duda, escríbenos por aquí.',
  },
  {
    clave: 'credencial',
    titulo: 'Credencial',
    cuando: 'Al enviar su credencial con QR',
    base: 'Hola {nombre}, esta es tu credencial de {academia} 💃🕺 Muéstrala en recepción para entrar. Tu código: {codigo}',
  },
  {
    clave: 'portal',
    titulo: 'Su portal (QR y plan)',
    cuando: 'Enlace personal donde ve su QR, su plan y sus clases',
    base: 'Hola {nombre}, este es tu acceso personal a {academia} 💃🕺 Ahí tienes tu QR para entrar, tu plan y tus clases, y puedes poner tu foto: {enlace} (Es solo tuyo, no lo compartas.)',
  },
  {
    clave: 'vence',
    titulo: 'Plan por vencer',
    cuando: 'Recordatorio antes de que termine su plan',
    base: 'Hola {nombre}, tu {plan} en {academia} vence el {vence}. ¿La renovamos para que sigas bailando? 💃🕺',
  },
  {
    clave: 'vencio',
    titulo: 'Plan vencido',
    cuando: 'A quien ya se le terminó su plan y no ha renovado',
    base: 'Hola {nombre}, tu {plan} en {academia} venció el {vence}. ¿La renovamos para que sigas bailando? 💃🕺',
  },
  {
    clave: 'adeudo',
    titulo: 'Recordatorio de pago',
    cuando: 'A quien entró y quedó a deber (fiado)',
    base: 'Hola {nombre}, te recordamos que tienes pendiente {monto} de tus clases en {academia}. Puedes pagarlo en tu próxima clase. ¡Gracias! 💃🕺',
  },
  {
    clave: 'extrañamos',
    titulo: 'Te extrañamos',
    cuando: 'Para quien dejó de venir',
    base: '¡Hola {nombre}! Te extrañamos en {academia} 💃🕺 Esta semana tenemos clases para ti, ¡te esperamos!',
  },
  {
    clave: 'recibo',
    titulo: 'Recibo de pago',
    cuando: 'Después de cobrar un plan',
    base: 'Hola {nombre}, recibimos tu pago de {monto} por {plan} en {academia}. Vigencia: {vigencia}. ¡Gracias! 💃🕺',
  },
];

/** Mensajes para interesados (página pública): no salen en la ficha de alumno, sino en Alumnos → Interesados. */
export const MENSAJES_INTERESADOS: { clave: ClaveMensaje; titulo: string; cuando: string; base: string }[] = [
  {
    clave: 'interesado',
    titulo: 'Interesado: primer mensaje',
    cuando: 'A quien se inscribió en la página pública',
    base: '¡Hola {nombre}! Gracias por tu interés en las clases de {academia} 💃🕺 ¿Te gustaría venir a una clase de {clase}? Cualquier duda, aquí estamos.',
  },
  {
    clave: 'grupo',
    titulo: 'Abrimos grupo',
    cuando: 'Para avisar a los interesados que abrió un grupo',
    base: '¡Hola {nombre}! Abrimos grupo de {clase} en {academia}: {horario}. ¿Te apartamos lugar? 💃🕺',
  },
];

export const VARIABLES: { clave: string; texto: string }[] = [
  { clave: 'nombre', texto: 'Nombre del alumno' },
  { clave: 'academia', texto: 'Nombre de la academia' },
  { clave: 'plan', texto: 'Plan (Mensualidad…)' },
  { clave: 'vence', texto: 'Fecha en que vence' },
  { clave: 'vigencia', texto: 'Del … al …' },
  { clave: 'monto', texto: 'Importe' },
  { clave: 'codigo', texto: 'Código de credencial' },
  { clave: 'enlace', texto: 'Enlace a su portal' },
  { clave: 'clase', texto: 'Clase (interesados)' },
  { clave: 'horario', texto: 'Días y hora de la clase' },
];

const camposMensaje: Record<ClaveMensaje, readonly string[]> = {
  bienvenida: ['nombre', 'academia'],
  credencial: ['nombre', 'academia', 'codigo'],
  portal: ['nombre', 'academia', 'codigo', 'enlace'],
  vence: ['nombre', 'academia', 'plan', 'vence'],
  vencio: ['nombre', 'academia', 'plan', 'vence'],
  adeudo: ['nombre', 'academia', 'monto'],
  extrañamos: ['nombre', 'academia'],
  recibo: ['nombre', 'academia', 'monto', 'plan', 'vigencia', 'vence'],
  interesado: ['nombre', 'academia', 'clase'],
  grupo: ['nombre', 'academia', 'clase', 'horario'],
};

export function variablesMensaje(clave: ClaveMensaje) {
  return VARIABLES.filter((v) => camposMensaje[clave].includes(v.clave));
}

export function plantilla(academia: Pick<Academia, 'mensajes'>, clave: ClaveMensaje): string {
  return academia.mensajes?.[clave]?.trim() || [...MENSAJES, ...MENSAJES_INTERESADOS].find((m) => m.clave === clave)!.base;
}

/** Sustituye {variables}; las que no tengan valor se quitan sin dejar huecos raros. */
export function armarMensaje(texto: string, datos: Record<string, string | undefined>): string {
  return texto
    .replace(/\{(\w+)\}/g, (_, k: string) => datos[k] ?? '')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}
