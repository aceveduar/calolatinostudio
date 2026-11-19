import { useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Quote, X } from 'lucide-react';
import { Carrusel } from './Carrusel';

/** Fotos (se abren en grande) y lo que dicen los alumnos; todo en carruseles para no alargar la página. */
export function Comunidad({ galeria, testimonios, creditos }: { galeria: string[]; testimonios: { texto: string; nombre: string; detalle?: string }[]; creditos?: string }) {
  const visor = useRef<HTMLDialogElement>(null);
  const [i, setI] = useState(0);
  const abrir = (k: number) => {
    setI(k);
    visor.current?.showModal();
  };
  const mover = (d: number) => setI((x) => (x + d + galeria.length) % galeria.length);
  return (
    <div className="space-y-6">
      {galeria.length > 0 && (
        <Carrusel etiqueta="Fotos">
          {galeria.map((f, k) => (
            <li key={k} className="shrink-0 snap-start">
              <button onClick={() => abrir(k)} className="block h-56 overflow-hidden rounded-3xl ring-1 ring-ink-100 sm:h-64" aria-label={`Ver foto ${k + 1} de ${galeria.length}`}>
                <img src={f} alt="" loading="lazy" className="h-full w-auto max-w-[80vw] object-cover transition duration-300 hover:scale-105" />
              </button>
            </li>
          ))}
        </Carrusel>
      )}
      {galeria.length > 0 && creditos && <p className="-mt-4 text-[11px] text-ink-500">{creditos}</p>}
      {testimonios.length > 0 && (
        <Carrusel etiqueta="Lo que dicen nuestros alumnos">
          {testimonios.map((t, k) => (
            <li key={k} className="pp-revela flex w-[82vw] max-w-sm shrink-0 snap-start flex-col rounded-3xl bg-ink-50 p-5 ring-1 ring-ink-100">
              <Quote size={26} className="text-brand-500" aria-hidden="true" />
              <p className="mt-2 flex-1 text-lg leading-snug font-semibold text-pretty">{t.texto}</p>
              <p className="mt-4 font-extrabold">{t.nombre}</p>
              {t.detalle && <p className="text-sm text-ink-500">{t.detalle}</p>}
            </li>
          ))}
        </Carrusel>
      )}

      {/* visor de fotos: <dialog> nativo (Esc lo cierra, el foco queda adentro) */}
      <dialog
        ref={visor}
        className="m-auto max-h-[92dvh] w-[min(96vw,64rem)] overflow-visible bg-transparent p-0 backdrop:bg-black/85"
        onClick={(e) => e.target === visor.current && visor.current?.close()}
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight') mover(1);
          if (e.key === 'ArrowLeft') mover(-1);
        }}
        aria-label="Fotos"
      >
        {galeria.length > 0 && (
          <div className="relative">
            <img src={galeria[i]} alt={`Foto ${i + 1} de ${galeria.length}`} className="mx-auto max-h-[86dvh] w-auto rounded-2xl object-contain" />
            <p className="mt-2 text-center text-sm font-semibold text-white/80" aria-live="polite">
              {i + 1} / {galeria.length}
            </p>
            <button onClick={() => visor.current?.close()} className="absolute -top-2 right-0 flex h-11 w-11 items-center justify-center rounded-full bg-white/15 text-white" aria-label="Cerrar">
              <X size={22} />
            </button>
            {galeria.length > 1 && (
              <>
                <button onClick={() => mover(-1)} className="absolute top-1/2 left-1 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-white" aria-label="Foto anterior">
                  <ChevronLeft size={24} />
                </button>
                <button onClick={() => mover(1)} className="absolute top-1/2 right-1 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-white" aria-label="Foto siguiente">
                  <ChevronRight size={24} />
                </button>
              </>
            )}
          </div>
        )}
      </dialog>
    </div>
  );
}
