import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { BookOpen, Check, Hand, Wallet } from 'lucide-react';
import { useSesion } from '../../app/sesion';
import { getMeta, setMeta } from '../../db/db';
import { nombreSaludo } from '../../domain/nombres';

const PASOS = [
  { icono: Hand, texto: 'Toca a quien llegó. Si tiene plan, entra solo y listo.' },
  { icono: Wallet, texto: 'Si paga en efectivo, toca el billete con que te paga: la app te dice el cambio.' },
  { icono: Check, texto: 'Toca "Listo". ¿Te equivocaste? El aviso de abajo tiene "Deshacer".' },
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
    <section className="mx-4 mt-3 rounded-3xl bg-superficie p-4 ring-1 ring-ink-100" aria-label="Bienvenida">
      <p className="text-lg font-extrabold">¡Hola, {nombreSaludo(usuario.nombre)}! 👋</p>
      <p className="text-sm text-ink-500">Así se cobra en Compás:</p>
      <ol className="mt-3 space-y-2.5">
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
    </section>
  );
}
