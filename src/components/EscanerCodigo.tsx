import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Barcode, X } from 'lucide-react';
import { limpiarCodigo, obtenerDetector } from '../app/codigos';
import { cx } from './ui';

/**
 * Cámara para leer códigos de barras.
 *  - `continuo`: sigue leyendo (cobrar varios productos); el mismo código se ignora 2 s para no duplicar.
 *  - si no: se cierra con el primer código (dar de alta un producto).
 * Siempre se puede escribir el número a mano.
 */
export function EscanerCodigo({ titulo, continuo, aviso, onCodigo, onCerrar }: { titulo: string; continuo?: boolean; aviso?: string | null; onCodigo: (c: string) => void; onCerrar: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [estado, setEstado] = useState<'cargando' | 'leyendo' | 'sin-camara'>('cargando');
  const [manual, setManual] = useState('');
  const ultimo = useRef<{ c: string; t: number }>({ c: '', t: 0 });
  const cb = useRef(onCodigo);
  cb.current = onCodigo;

  useEffect(() => {
    let vivo = true;
    let stream: MediaStream | null = null;
    let timer = 0;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1280 } }, audio: false });
        if (!vivo || !video.current) return;
        video.current.srcObject = stream;
        await video.current.play();
        const detector = await obtenerDetector();
        if (!vivo) return;
        setEstado('leyendo');
        const leer = async () => {
          if (!vivo || !video.current) return;
          try {
            const r = await detector.detect(video.current);
            const c = r[0] ? limpiarCodigo(r[0].rawValue) : '';
            const ahora = Date.now();
            if (c && !(c === ultimo.current.c && ahora - ultimo.current.t < 2000)) {
              ultimo.current = { c, t: ahora };
              navigator.vibrate?.(40);
              cb.current(c);
              if (!continuo) return;
            }
          } catch {
            /* cuadro sin código: seguir */
          }
          timer = window.setTimeout(leer, 220);
        };
        void leer();
      } catch {
        if (vivo) setEstado('sin-camara');
      }
    })();
    return () => {
      vivo = false;
      clearTimeout(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [continuo]);

  return createPortal(
    <div className="fixed inset-0 z-[60] flex flex-col bg-black text-white" role="dialog" aria-modal="true" aria-label={titulo}>
      <div className="flex items-center gap-2 px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-3">
        <Barcode size={20} />
        <p className="flex-1 text-lg font-bold">{titulo}</p>
        <button onClick={onCerrar} className="rounded-full p-2 active:bg-white/10" aria-label="Cerrar">
          <X />
        </button>
      </div>
      <div className="relative flex-1 overflow-hidden">
        <video ref={video} playsInline muted className="h-full w-full object-cover" />
        {/* guía: franja horizontal para códigos de barras */}
        <div className="pointer-events-none absolute inset-x-8 top-1/2 h-32 -translate-y-1/2 rounded-2xl shadow-[0_0_0_9999px_rgba(0,0,0,0.45)] ring-4 ring-white/90" />
        <p className="absolute inset-x-0 top-6 mx-auto w-fit max-w-[90%] rounded-full bg-black/70 px-4 py-1.5 text-center text-sm font-semibold">
          {estado === 'cargando' ? 'Abriendo cámara…' : estado === 'sin-camara' ? 'No se pudo abrir la cámara: escribe el número abajo' : 'Apunta al código de barras'}
        </p>
        {aviso && <p className={cx('absolute inset-x-4 bottom-4 rounded-2xl bg-black/70 px-4 py-3 text-center text-base font-bold', 'animate-pop')}>{aviso}</p>}
      </div>
      <form
        className="flex gap-2 bg-black px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]"
        onSubmit={(e) => {
          e.preventDefault();
          const c = limpiarCodigo(manual);
          if (c) {
            cb.current(c);
            setManual('');
          }
        }}
      >
        <input
          value={manual}
          onChange={(e) => setManual(e.target.value)}
          inputMode="numeric"
          placeholder="O escribe el número"
          aria-label="Número del código de barras"
          className="h-12 min-w-0 flex-1 rounded-xl bg-white/10 px-4 text-white placeholder:text-white/50 outline-none focus:ring-2 focus:ring-white"
        />
        <button type="submit" className="h-12 rounded-xl bg-white px-5 font-bold text-black disabled:opacity-40" disabled={!manual.trim()}>
          Usar
        </button>
      </form>
    </div>,
    document.body,
  );
}
