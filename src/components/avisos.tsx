import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { CheckCircle2, AlertCircle } from 'lucide-react';

export interface AccionAviso {
  texto: string;
  fn: () => void | Promise<void>;
}

interface Aviso {
  id: number;
  texto: string;
  tipo: 'ok' | 'error';
  accion?: AccionAviso;
}

type Avisar = (texto: string, tipo?: Aviso['tipo'], accion?: AccionAviso) => void;
const Ctx = createContext<Avisar>(() => {});

/**
 * Avisos breves. Con `accion` (normalmente "Deshacer") el aviso dura más y se puede tocar:
 * preferimos deshacer a pedir confirmación, así no se frena a recepción.
 */
export function ProveedorAvisos({ children }: { children: ReactNode }) {
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const quitar = (id: number) => setAvisos((a) => a.filter((x) => x.id !== id));
  const avisar = useCallback<Avisar>((texto, tipo = 'ok', accion) => {
    const id = Date.now() + Math.random();
    setAvisos([{ id, texto, tipo, accion }]); // uno a la vez: no tapa la pantalla
    if (tipo === 'ok') navigator.vibrate?.(30);
    setTimeout(() => quitar(id), accion ? 6000 : 2800);
  }, []);
  return (
    <Ctx.Provider value={avisar}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-0 z-[60] flex flex-col items-center gap-2 p-3 pt-safe" role="status" aria-live="polite">
        {avisos.map((a) => (
          <div
            key={a.id}
            className={`mt-2 flex max-w-md items-center gap-2 rounded-2xl py-3 pl-4 text-[15px] font-semibold text-white shadow-lg animate-sube ${
              a.tipo === 'ok' ? 'bg-panel' : 'bg-[#c53030]'
            } ${a.accion ? 'pointer-events-auto pr-2' : 'pr-4'}`}
          >
            {a.tipo === 'ok' ? <CheckCircle2 size={20} className="shrink-0 text-[#7ee2a8]" /> : <AlertCircle size={20} className="shrink-0" />}
            <span className="min-w-0">{a.texto}</span>
            {a.accion && (
              <button
                onClick={async () => {
                  quitar(a.id);
                  await a.accion!.fn();
                }}
                className="ml-1 shrink-0 rounded-xl bg-white/15 px-3 py-1.5 text-sm font-bold text-[#ffd166] active:bg-white/25"
              >
                {a.accion.texto}
              </button>
            )}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export const useAvisos = () => useContext(Ctx);
