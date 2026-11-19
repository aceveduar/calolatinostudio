import { useRef } from 'react';
import { X } from 'lucide-react';

/** Enlace "Aviso de privacidad" que abre el aviso en una ventana (Esc o la X la cierran). */
export function AvisoPrivacidad({ texto, academia, className, children = 'Aviso de privacidad' }: { texto: string; academia: string; className?: string; children?: React.ReactNode }) {
  const ventana = useRef<HTMLDialogElement>(null);
  return (
    <>
      <button type="button" onClick={() => ventana.current?.showModal()} className={className ?? 'font-semibold underline underline-offset-2'}>
        {children}
      </button>
      <dialog
        ref={ventana}
        aria-label="Aviso de privacidad"
        onClick={(e) => e.target === ventana.current && ventana.current?.close()}
        className="m-auto max-h-[85dvh] w-[min(94vw,40rem)] overflow-y-auto rounded-3xl bg-superficie p-0 text-ink-900 shadow-2xl backdrop:bg-black/60"
      >
        <div className="sticky top-0 flex items-center justify-between gap-3 border-b border-ink-100 bg-superficie px-6 py-4 text-left">
          <div>
            <p className="text-xs font-bold tracking-wider text-ink-500 uppercase">{academia}</p>
            <h2 className="text-xl font-extrabold">Aviso de privacidad</h2>
          </div>
          <button type="button" onClick={() => ventana.current?.close()} className="flex h-11 w-11 items-center justify-center rounded-full active:bg-ink-100" aria-label="Cerrar">
            <X size={22} />
          </button>
        </div>
        <div className="space-y-3 px-6 py-5 text-left text-[15px] leading-relaxed text-ink-700">
          {texto.split(/\n{2,}/).map((p, i) => (
            <p key={i} className="whitespace-pre-line">
              {p}
            </p>
          ))}
        </div>
      </dialog>
    </>
  );
}
