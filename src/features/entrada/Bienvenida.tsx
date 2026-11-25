import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { BookOpen, Check, ChevronDown, Hand, Wallet } from 'lucide-react';
import { useSesion } from '../../app/sesion';
import { getMeta, setMeta } from '../../db/db';

const PASOS = [
  { icono: Hand, texto: 'Toca a quien llegó. Si tiene plan, se registra su entrada.' },
  { icono: Wallet, texto: 'Si paga en efectivo, elige el billete que recibiste para ver el cambio.' },
  { icono: Check, texto: 'Toca «Listo» para cerrar la cuenta. Usa «Corregir» si hubo un error.' },
];

/**
 * El primer día de cada persona de recepción: cómo se cobra, en 3 pasos, y dónde está el manual.
 * Tarjeta en la pantalla (no ventana encima: taparía Entrada justo cuando hay que cobrar). Con "Entendido"
 * no vuelve a salir para esa persona. El dueño tiene "Deja lista tu academia".
 */
export function BienvenidaRecepcion() {
  const { usuario } = useSesion();
  const clave = `bienvenidaVista:${usuario.id}`;
  const vista = useLiveQuery(() => getMeta<boolean>(clave), [clave], true);
  if (usuario.rol !== 'recepcion' || vista) return null;
  return (
    <section className="mx-4 mt-3 rounded-2xl bg-superficie ring-1 ring-ink-100" aria-label="Bienvenida">
      <details className="group">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 rounded-2xl px-3 text-sm font-semibold text-brand-600 [&::-webkit-details-marker]:hidden">
          <span className="flex items-center gap-2"><BookOpen size={17} aria-hidden="true" /> Cómo cobrar en recepción</span>
          <ChevronDown size={16} className="shrink-0 group-open:rotate-180" aria-hidden="true" />
        </summary>
        <div className="border-t border-ink-100 px-4 pt-3 pb-4">
          <ol className="space-y-2.5">
            {PASOS.map(({ icono: Icono, texto }, i) => (
              <li key={i} className="flex items-start gap-3 text-sm">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600" aria-hidden="true">
                  <Icono size={16} />
                </span>
                <span className="pt-1.5">{texto}</span>
              </li>
            ))}
          </ol>
          <div className="mt-4 flex items-center justify-between gap-3">
            <Link to="/ayuda" className="flex min-h-11 items-center gap-1.5 text-sm font-semibold text-brand-600">
              <BookOpen size={16} aria-hidden="true" /> Ver el manual
            </Link>
            <button type="button" onClick={() => void setMeta(clave, true)} className="h-11 rounded-xl bg-brand-500 px-5 text-sm font-bold text-white active:scale-[0.98]">
              Entendido
            </button>
          </div>
        </div>
      </details>
    </section>
  );
}
