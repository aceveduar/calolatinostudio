import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, ChevronRight, MapPin, Plus, Tag } from 'lucide-react';
import { useClases, usePlanes } from '../../app/datos';
import { useSesion } from '../../app/sesion';
import { useAvisos } from '../../components/avisos';
import { Boton, Campo, Entrada, Interruptor, Tarjeta, cx } from '../../components/ui';
import { actualizar, crear } from '../../db/repo';
import { type ID, type Sede } from '../../db/types';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { Catalogo } from './Catalogo';
import { dinero } from '../../domain/dinero';
import { sueltaPara } from '../../domain/sedes';

// ---------- Sedes ----------
const COLORES_SEDE = ['#d6304a', '#7c4ddb', '#1f8fd6', '#15924b', '#d97706', '#0d9488', '#db2777', '#3d3a48'];

export function EditorSedes() {
  const { academia } = useSesion();
  const avisar = useAvisos();
  const sedes = useLiveQuery(async () => (await db.sedes.filter((x) => !x.deletedAt).toArray()).sort((a, b) => a.nombre.localeCompare(b.nombre)), [], [] as Sede[]);
  const clases = useClases();
  const planes = usePlanes();
  const [principal, setPrincipal] = useState(academia.sedePrincipal ?? '');
  const cuenta = (id: ID | null) => clases.filter((c) => (c.sedeId ?? null) === id && c.activo).length;
  const resumen = (id: ID | null) => {
    const n = cuenta(id);
    const tarifa = sueltaPara(planes, id);
    const sinDireccion = academia.slug && !academia.pagina?.ubicaciones?.[id ?? 'principal']?.direccion.trim();
    return `${n} ${n === 1 ? 'clase activa' : 'clases activas'} · ${tarifa ? `Tarifa base ${dinero(tarifa.precio)}` : 'Sin tarifa de clase suelta'}${sinDireccion ? ' · Sin dirección pública' : ''}`;
  };
  return (
    <>
      <Tarjeta className="mb-3 space-y-2 p-4">
        <p className="text-sm font-semibold">Sede principal</p>
        <div className="flex gap-2">
          <Entrada value={principal} onChange={(e) => setPrincipal(e.target.value)} placeholder={`Ej. ${academia.nombre} Centro`} aria-label="Nombre de la sede principal" />
          {principal.trim() !== (academia.sedePrincipal ?? '') && <Boton
            variante="secundario"
            onClick={async () => {
              await actualizar('academias', academia.id, { sedePrincipal: principal.trim() || null });
              avisar('Sede principal guardada');
            }}
          >
            Guardar
          </Boton>}
        </div>
        <p className="text-xs text-ink-500">{resumen(null)}</p>
      </Tarjeta>
      <Catalogo
        items={sedes}
        textoNuevo="Nueva sede"
        arriba={(nueva) => <Boton className="mb-3" onClick={nueva}><Plus size={18} aria-hidden="true" /> Nueva sede</Boton>}
        titulo={(x) => (x ? x.nombre : 'Nueva sede')}
        fila={(x) => (
          <>
            <span className="size-3 shrink-0 rounded-full" style={{ background: x.color }} />
            <span className="min-w-0 flex-1">
              <span className="block break-words font-semibold">{x.nombre}</span>
              <span className="block text-xs text-ink-500">{x.activo ? resumen(x.id) : 'Sede inactiva'}</span>
            </span>
          </>
        )}
        form={(x, cerrar) => <FormSede sede={x} onHecho={cerrar} />}
      />
      <h2 className="mt-5 mb-2 px-1 text-sm font-bold">Configurar las sedes</h2>
      <Tarjeta className="divide-y divide-ink-100">
        {[
          { ruta: '/ajustes/clases', texto: 'Clases y horarios', Icono: CalendarDays },
          { ruta: '/ajustes/planes', texto: 'Tarifas de clase suelta', Icono: Tag },
          { ruta: '/ajustes/pagina', texto: 'Direcciones en la página pública', Icono: MapPin },
        ].map(({ ruta, texto, Icono }) => (
          <Link key={ruta} to={ruta} state={{ desdeAjustes: true }} className="flex min-h-11 items-center gap-3 px-4 py-2 text-sm font-semibold">
            <Icono size={17} className="shrink-0 text-brand-600" aria-hidden="true" />
            <span className="flex-1">{texto}</span>
            <ChevronRight size={16} className="shrink-0 text-ink-500" aria-hidden="true" />
          </Link>
        ))}
      </Tarjeta>
    </>
  );
}

export function FormSede({ sede, onHecho }: { sede: Sede | null; onHecho: () => void }) {
  const avisar = useAvisos();
  const [nombre, setNombre] = useState(sede?.nombre ?? '');
  const [color, setColor] = useState(sede?.color ?? COLORES_SEDE[1]);
  const [activo, setActivo] = useState(sede?.activo ?? true);
  return (
    <div className="space-y-4">
      <Campo etiqueta="Nombre">
        <Entrada autoFocus={!sede} value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej. Casa de Cultura" />
      </Campo>
      <Campo etiqueta="Color" grupo>
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
          {COLORES_SEDE.map((c) => (
            <button key={c} type="button" onClick={() => setColor(c)} className={cx('h-10 w-10 rounded-full ring-offset-2', color === c && 'ring-2 ring-ink-900')} style={{ background: c }} aria-label={`Color ${c}`} aria-pressed={color === c} />
          ))}
        </div>
      </Campo>
      {sede && <Interruptor valor={activo} onChange={setActivo} texto="Sede activa" />}
      {!sede && <p className="text-sm text-ink-500">Después de guardar, usa los accesos de Sedes para configurar sus clases, tarifa y dirección.</p>}
      <Boton
        grande
        bloque
        disabled={!nombre.trim()}
        onClick={async () => {
          const datos = { nombre: nombre.trim(), color, activo };
          if (sede) await actualizar('sedes', sede.id, datos);
          else await crear('sedes', datos);
          avisar('Sede guardada');
          onHecho();
        }}
      >
        Guardar
      </Boton>
    </div>
  );
}
