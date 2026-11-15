import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { ChevronRight, LockKeyhole } from 'lucide-react';
import { GRUPOS, modulosDe, type Contador, type Modulo } from '../../app/modulos';
import { useSesion } from '../../app/sesion';
import { Avatar, Encabezado, Tarjeta, cx } from '../../components/ui';
import { db } from '../../db/db';
import { NOMBRE_ROL } from '../../db/types';

/** Cuántos pendientes tiene cada módulo (se muestran como globo en "Más" y en la pestaña). */
export function useContadores(): Record<Contador, number> {
  return useLiveQuery(
    async () => {
      const [interesados, encargos] = await Promise.all([
        db.interesados.where('estado').equals('nuevo').filter((i) => !i.deletedAt).count(),
        // encargos sobre pedido que aún hay que pedir al proveedor
        (async () => {
          const pend = await db.pedidos.where('estado').equals('pendiente').filter((p) => !p.deletedAt).toArray();
          const prods = await db.productos.bulkGet(pend.map((p) => p.productoId));
          return pend.filter((_, i) => prods[i]?.sobrePedido).length;
        })(),
      ]);
      return { interesados, encargos };
    },
    [],
    { interesados: 0, encargos: 0 },
  );
}

/**
 * "Más": todo lo que no cabe en la barra de abajo, en grupos claros.
 * Se arma solo desde el registro de módulos (app/modulos.ts) según el rol.
 */
export function PantallaMas() {
  const { usuario, bloquear } = useSesion();
  const contadores = useContadores();
  // lo que ya es pestaña no se repite aquí
  const modulos = modulosDe(usuario.rol).filter((m) => m.grupo && m.pestana?.[usuario.rol] === undefined);

  return (
    <div className="px-4 pb-8 lg:mx-auto lg:max-w-3xl">
      <div className="-mx-4">
        <Encabezado titulo="Más" sub={`${usuario.nombre} · ${NOMBRE_ROL[usuario.rol]}`} />
      </div>
      {GRUPOS.map((g) => {
        const lista = modulos.filter((m) => m.grupo === g.id);
        if (!lista.length) return null;
        const compacto = g.id === 'config' || g.id === 'cuenta';
        return (
          <section key={g.id} className="mb-5">
            <h2 className="mb-2 px-1 text-xs font-bold tracking-wider text-ink-500 uppercase">{g.titulo}</h2>
            {compacto ? (
              <Tarjeta className="divide-y divide-ink-100">
                {lista.map((m) => (
                  <Fila key={m.id} m={m} n={m.contador ? contadores[m.contador] : 0} />
                ))}
              </Tarjeta>
            ) : (
              <div className="grid grid-cols-2 gap-2 lg:grid-cols-3">
                {lista.map((m) => (
                  <Mosaico key={m.id} m={m} n={m.contador ? contadores[m.contador] : 0} />
                ))}
              </div>
            )}
          </section>
        );
      })}
      <button onClick={bloquear} className="flex w-full items-center gap-3 rounded-2xl bg-superficie px-4 py-3 text-left ring-1 ring-ink-100 active:bg-ink-50">
        <Avatar nombre={usuario.nombre} tam={36} />
        <span className="flex-1">
          <span className="block font-semibold">Bloquear / cambiar usuario</span>
          <span className="block text-xs text-ink-500">Para que otra persona entre con su PIN</span>
        </span>
        <LockKeyhole size={18} className="text-ink-300" />
      </button>
      <p className="mt-4 text-center text-xs text-ink-300">Compás v{__APP_VERSION__}</p>
    </div>
  );
}

function Globo({ n }: { n: number }) {
  if (!n) return null;
  return <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-brand-500 px-1.5 text-xs font-extrabold text-white">{n}</span>;
}

function Mosaico({ m, n }: { m: Modulo; n: number }) {
  const Icono = m.icono;
  return (
    <Link to={m.ruta} className={cx('relative flex flex-col gap-2 rounded-2xl bg-superficie p-4 ring-1 ring-ink-100 active:bg-ink-50', n > 0 && 'ring-2 ring-brand-500/40')}>
      <span className="flex items-center justify-between">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
          <Icono size={22} />
        </span>
        <Globo n={n} />
      </span>
      <span>
        <span className="block font-bold leading-tight">{m.titulo}</span>
        {m.ayuda && <span className="mt-0.5 block text-xs leading-snug text-ink-500">{m.ayuda}</span>}
      </span>
    </Link>
  );
}

function Fila({ m, n }: { m: Modulo; n: number }) {
  const Icono = m.icono;
  return (
    <Link to={m.ruta} className="flex items-center gap-3 px-4 py-3 active:bg-ink-50">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-ink-50 text-ink-700">
        <Icono size={19} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">{m.titulo}</span>
        {m.ayuda && <span className="block truncate text-xs text-ink-500">{m.ayuda}</span>}
      </span>
      <Globo n={n} />
      <ChevronRight size={18} className="text-ink-300" />
    </Link>
  );
}
