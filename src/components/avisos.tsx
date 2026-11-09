import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { CheckCircle2, AlertCircle } from 'lucide-react';

interface Aviso {
  id: number;
  texto: string;
  tipo: 'ok' | 'error';
}
const Ctx = createContext<(texto: string, tipo?: Aviso['tipo']) => void>(() => {});

export function ProveedorAvisos({ children }: { children: ReactNode }) {
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const avisar = useCallback((texto: string, tipo: Aviso['tipo'] = 'ok') => {
    const id = Date.now() + Math.random();
    setAvisos([{ id, texto, tipo }]); // uno a la vez: no tapa la pantalla
    if (tipo === 'ok') navigator.vibrate?.(30);
    setTimeout(() => setAvisos((a) => a.filter((x) => x.id !== id)), 2800);
  }, []);
  return (
    <Ctx.Provider value={avisar}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-0 z-[60] flex flex-col items-center gap-2 p-3 pt-safe">
        {avisos.map((a) => (
          <div
            key={a.id}
            className={`mt-2 flex max-w-md items-center gap-2 rounded-2xl px-4 py-3 text-[15px] font-semibold text-white shadow-lg animate-sube ${
              a.tipo === 'ok' ? 'bg-ink-900' : 'bg-bad-600'
            }`}
          >
            {a.tipo === 'ok' ? <CheckCircle2 size={20} className="text-ok-50" /> : <AlertCircle size={20} />}
            {a.texto}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export const useAvisos = () => useContext(Ctx);
