import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { Check, ChevronDown, ChevronRight, Rocket, X } from 'lucide-react';
import { useSesion } from '../../app/sesion';
import { cx } from '../../components/ui';
import { db, getMeta, setMeta } from '../../db/db';
import { primerosPasos } from '../../domain/primerosPasos';

const OCULTO = 'primerosPasosOculto';

/**
 * Tarjeta para Dirección mientras falta la configuración básica de Entrada: cuántos pasos lleva, cuál sigue (un toque lo lleva
 * ahí) y la lista completa al abrirla. Se va sola al terminar; también se puede ocultar.
 */
export function PrimerosPasos() {
  const { esDueno } = useSesion();
  const [abierta, setAbierta] = useState(false);
  const datos = useLiveQuery(async () => {
    if (!esDueno || (await getMeta<boolean>(OCULTO))) return null;
    const vivo = <T extends { deletedAt?: number | null }>(x: T) => !x.deletedAt;
    const [clases, planesConPrecio] = await Promise.all([
      db.clases.filter((c) => vivo(c) && c.activo).count(),
      db.planes.filter((p) => vivo(p) && p.activo && p.precio > 0).count(),
    ]);
    return primerosPasos({ clases, planesConPrecio });
  }, [esDueno]);

  if (!datos) return null;
  const hechos = datos.filter((p) => p.hecho).length;
  if (hechos === datos.length) return null;
  const siguiente = datos.find((p) => !p.hecho)!;

  return (
    <section className="mx-4 mt-3 overflow-hidden rounded-3xl bg-superficie ring-1 ring-ink-100" aria-label="Primeros pasos">
      <div className="flex items-center gap-3 px-4 pt-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-brand-600" aria-hidden="true">
          <Rocket size={20} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-bold">Configura Entrada</p>
          <p className="text-sm text-ink-500">
            {hechos} de {datos.length} pasos
          </p>
        </div>
        <button type="button" onClick={() => void setMeta(OCULTO, true)} className="flex h-10 w-10 items-center justify-center rounded-full text-ink-500 active:bg-ink-100" aria-label="Ocultar primeros pasos">
          <X size={18} />
        </button>
      </div>
      <div className="mx-4 mt-3 flex gap-1" aria-hidden="true">
        {datos.map((p) => (
          <span key={p.id} className={cx('h-1.5 flex-1 rounded-full transition-colors', p.hecho ? 'bg-ok-600' : 'bg-ink-100')} />
        ))}
      </div>
      <Link to={siguiente.ruta} className="mx-4 mt-3 flex items-center gap-3 rounded-2xl bg-brand-50 px-4 py-3 active:brightness-95">
        <span className="min-w-0 flex-1">
          <span className="block text-xs font-bold tracking-wider text-brand-600 uppercase">Sigue</span>
          <span className="block font-semibold">{siguiente.titulo}</span>
          <span className="block text-sm text-ink-700">{siguiente.porque}</span>
        </span>
        <ChevronRight size={20} className="shrink-0 text-brand-600" aria-hidden="true" />
      </Link>
      <button type="button" onClick={() => setAbierta(!abierta)} aria-expanded={abierta} className="flex min-h-11 w-full items-center justify-center gap-1 text-sm font-semibold text-ink-700 active:bg-ink-50">
        {abierta ? 'Ocultar la lista' : 'Ver todos los pasos'} <ChevronDown size={16} className={cx('transition', abierta && 'rotate-180')} aria-hidden="true" />
      </button>
      {abierta && (
        <ol className="divide-y divide-ink-100 border-t border-ink-100">
          {datos.map((p) => (
            <li key={p.id}>
              <Link to={p.ruta} className="flex items-center gap-3 px-4 py-3 active:bg-ink-50">
                <span className={cx('flex h-6 w-6 shrink-0 items-center justify-center rounded-full', p.hecho ? 'bg-ok-600 text-white' : 'ring-2 ring-ink-300')} aria-hidden="true">
                  {p.hecho && <Check size={14} strokeWidth={3} />}
                </span>
                <span className={cx('min-w-0 flex-1', p.hecho && 'text-ink-500 line-through decoration-ink-300')}>{p.titulo}</span>
                <span className="sr-only">{p.hecho ? 'listo' : 'pendiente'}</span>
                <ChevronRight size={16} className="shrink-0 text-ink-300" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
