/**
 * Mandar una imagen (credencial, ticket) por WhatsApp desde la app.
 * Celular: el menú de compartir con la imagen adjunta (ahí se elige WhatsApp y el chat).
 * PC: no se puede adjuntar a un chat desde el navegador; se descarga la imagen y se abre el chat del alumno
 * para que la arrastren.
 */
import { waLink } from '../domain/reportes';

export function puedeCompartirImagen(): boolean {
  const tactil = matchMedia('(pointer: coarse)').matches;
  try {
    return tactil && typeof navigator.canShare === 'function' && navigator.canShare({ files: [new File([''], 'x.png', { type: 'image/png' })] });
  } catch {
    return false;
  }
}

export function descargarArchivo(f: File) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(f);
  a.download = f.name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/** Devuelve qué pasó, para que la pantalla avise ("descargada: adjúntala en el chat"). */
export async function enviarImagen(f: File, texto: string, telefono: string): Promise<'compartida' | 'cancelada' | 'descargada-y-chat' | 'descargada'> {
  if (puedeCompartirImagen()) {
    try {
      await navigator.share({ files: [f], text: texto });
      return 'compartida';
    } catch {
      return 'cancelada';
    }
  }
  descargarArchivo(f);
  const wa = waLink(telefono, texto);
  if (wa) {
    window.open(wa, '_blank', 'noopener');
    return 'descargada-y-chat';
  }
  return 'descargada';
}

export function cargarImagen(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = rej;
    i.src = src;
  });
}
