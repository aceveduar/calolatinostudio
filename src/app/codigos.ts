/**
 * Lectura de códigos de barras de productos (EAN/UPC/Code 128) y QR.
 *  - Cámara: usa el lector del navegador si lo tiene (Chrome en Android); si no (iPhone),
 *    carga uno incluido en la app (zxing, ~1 MB) solo la primera vez que se escanea; luego sirve sin internet.
 *  - Lector USB / Bluetooth: escriben el código como teclado y terminan con Enter.
 */
import { useEffect, useRef } from 'react';

export interface Detector {
  detect(fuente: HTMLVideoElement): Promise<{ rawValue: string; format: string }[]>;
}

const FORMATOS = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'itf', 'qr_code'];
let detector: Promise<Detector> | null = null;

export function obtenerDetector(): Promise<Detector> {
  detector ??= (async () => {
    const Nativo = (globalThis as unknown as { BarcodeDetector?: { new (o: { formats: string[] }): Detector; getSupportedFormats(): Promise<string[]> } }).BarcodeDetector;
    if (Nativo) {
      try {
        const soportados = await Nativo.getSupportedFormats();
        if (soportados.includes('ean_13')) return new Nativo({ formats: FORMATOS.filter((f) => soportados.includes(f)) });
      } catch {
        /* sigue con el incluido */
      }
    }
    const [{ BarcodeDetector, prepareZXingModule }, { default: wasm }] = await Promise.all([
      import('barcode-detector/ponyfill'),
      import('zxing-wasm/reader/zxing_reader.wasm?url'),
    ]);
    // El motor se sirve desde la propia app (no de un CDN): funciona sin internet una vez guardado
    prepareZXingModule({ overrides: { locateFile: (ruta: string, prefijo: string) => (ruta.endsWith('.wasm') ? wasm : prefijo + ruta) } });
    return new BarcodeDetector({ formats: FORMATOS as never }) as unknown as Detector;
  })();
  detector.catch(() => (detector = null));
  return detector;
}

/** Normaliza lo que entrega el lector (espacios, saltos). */
export const limpiarCodigo = (c: string) => c.replace(/\s+/g, '').trim();

/**
 * Lector USB/Bluetooth (modo teclado): junta las teclas que llegan muy seguidas y termina con Enter.
 * Ignora lo que se escribe a mano en campos de texto (a menos que `enCampos`).
 */
export function useLectorUSB(onCodigo: (codigo: string) => void, activo = true, enCampos = false) {
  const cb = useRef(onCodigo);
  cb.current = onCodigo;
  useEffect(() => {
    if (!activo) return;
    let buffer = '';
    let ultimo = 0;
    const tecla = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const enInput = !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
      if (enInput && !enCampos) return;
      const ahora = performance.now();
      if (ahora - ultimo > 60) buffer = ''; // una persona escribe más lento que un lector
      ultimo = ahora;
      if (e.key === 'Enter') {
        const c = limpiarCodigo(buffer);
        buffer = '';
        if (c.length >= 6) {
          e.preventDefault();
          e.stopPropagation();
          cb.current(c);
        }
        return;
      }
      if (e.key.length === 1) buffer += e.key;
    };
    window.addEventListener('keydown', tecla, true);
    return () => window.removeEventListener('keydown', tecla, true);
  }, [activo, enCampos]);
}
