/**
 * Últimos errores de ESTE equipo (pantallas que fallaron, errores inesperados, sincronización).
 * Se guardan en el teléfono para verlos en Ajustes → Ayuda y errores y mandarlos a soporte.
 * Si el mismo error se repite seguido (p. ej. la sincronización reintentando), se cuenta en lugar de llenar la lista.
 */
const CLAVE = 'compas:errores';
const MAX = 15;
const ocultarEnlaces = (texto: string) => texto.replace(/(\/(?:p|alta)\/)[A-Za-z0-9-]{20,64}(?![A-Za-z0-9-])/g, '$1[privado]');

export interface ErrorAnotado {
  at: string;
  donde: string;
  mensaje: string;
  pila?: string;
  veces?: number;
}

export function erroresRecientes(): ErrorAnotado[] {
  try {
    const v = JSON.parse(localStorage.getItem(CLAVE) ?? '[]');
    return Array.isArray(v) ? v.map((e: ErrorAnotado) => ({
      ...e,
      donde: ocultarEnlaces(e.donde),
      mensaje: ocultarEnlaces(e.mensaje),
      pila: e.pila ? ocultarEnlaces(e.pila) : undefined,
    })) : [];
  } catch {
    return [];
  }
}

export function anotarError(e: unknown, donde: string) {
  try {
    const mensaje = ocultarEnlaces(e instanceof Error ? e.message : String(e)).slice(0, 300);
    donde = ocultarEnlaces(donde);
    if (/ResizeObserver loop/.test(mensaje)) return; // aviso inofensivo del navegador, no es un error de la app
    const previos = erroresRecientes();
    const ultimo = previos[0];
    if (ultimo && ultimo.mensaje === mensaje && ultimo.donde === donde) {
      previos[0] = { ...ultimo, at: new Date().toISOString(), veces: (ultimo.veces ?? 1) + 1 };
      localStorage.setItem(CLAVE, JSON.stringify(previos));
      return;
    }
    const pila = e instanceof Error && e.stack ? ocultarEnlaces(e.stack.split('\n').slice(0, 6).join('\n')) : undefined;
    const nuevo: ErrorAnotado = { at: new Date().toISOString(), donde: donde.slice(0, 200), mensaje, pila };
    localStorage.setItem(CLAVE, JSON.stringify([nuevo, ...previos].slice(0, MAX)));
  } catch {
    /* sin almacenamiento: no importa */
  }
}

export function borrarErrores() {
  try {
    localStorage.removeItem(CLAVE);
  } catch {
    /* nada */
  }
}

/** El texto para soporte: versión, equipo y los errores (sin datos de alumnos ni dinero). */
export function reporteErrores(errores: ErrorAnotado[], info: { version: string; academia: string; nube: string; equipo: string }): string {
  const lineas = errores.map((e) => `• ${e.at.slice(0, 16).replace('T', ' ')}${e.veces && e.veces > 1 ? ` (×${e.veces})` : ''} — ${ocultarEnlaces(e.donde)}: ${ocultarEnlaces(e.mensaje)}`);
  return [`Compás v${info.version} · ${info.academia}`, `Nube: ${info.nube} · ${info.equipo}`, '', errores.length ? `Errores recientes (${errores.length}):` : 'Sin errores anotados.', ...lineas].join('\n');
}
