import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { ChevronRight, ClipboardList, Megaphone, Plus, Search, Users } from 'lucide-react';
import { useAlumnos, useEstadosPorAlumno, usePlanes } from '../../app/datos';
import { esBeca } from '../../domain/becas';
import { Avatar, Boton, Chips, Encabezado, Etiqueta, Hoja, Tarjeta, Vacio } from '../../components/ui';
import { semaforoAlumno, type Semaforo } from '../../domain/membresias';
import { FormAlumno } from './FormAlumno';

const normalizar = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
type Filtro = 'todos' | Semaforo | 'beca' | 'debe';

export function PantallaAlumnos() {
  const alumnos = useAlumnos();
  const estados = useEstadosPorAlumno();
  const planesBeca = new Set(usePlanes().filter(esBeca).map((p) => p.id));
  // Clases fiadas sin pagar, por alumno
  const interesadosNuevos = useLiveQuery(() => db.interesados.where('estado').equals('nuevo').filter((i) => !i.deletedAt).count(), [], 0);
  const deben = useLiveQuery(
    async () => {
      const m = new Map<string, number>();
      for (const a of await db.asistencias.where('deuda').equals(1).toArray()) if (a.alumnoId) m.set(a.alumnoId, (m.get(a.alumnoId) ?? 0) + 1);
      return m;
    },
    [],
    new Map<string, number>(),
  );
  const nav = useNavigate();
  const [q, setQ] = useState('');
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const [verBajas, setVerBajas] = useState(false);
  const bajas = alumnos.filter((a) => !a.activo).length;
  const [nuevo, setNuevo] = useState(false);

  const filas = useMemo(() => {
    const t = normalizar(q.trim());
    return alumnos
      .filter((a) => a.activo !== verBajas)
      .map((a) => {
        const est = estados.get(a.id) ?? [];
        return { a, s: semaforoAlumno(est), beca: est.some((e) => e.vigente && planesBeca.has(e.membresia.planId)) };
      })
      .filter(({ a }) => !t || normalizar(a.nombre).includes(t) || a.telefono.includes(t))
      .filter(({ a, s, beca }) => filtro === 'todos' || (filtro === 'beca' ? beca : filtro === 'debe' ? deben.has(a.id) : s.tono === filtro));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alumnos, estados, q, filtro, verBajas, planesBeca.size, deben]);

  return (
    <div className="px-4 pb-6 lg:mx-auto lg:max-w-3xl">
      <div className="-mx-4">
        <Encabezado
          titulo="Alumnos"
          sub={`${alumnos.filter((a) => a.activo).length} registrados`}
          accion={
            <div className="flex gap-2">
              <Link to="/alumnos/listas">
                <Boton variante="secundario">
                  <ClipboardList size={18} /> Listas
                </Boton>
              </Link>
              <Boton onClick={() => setNuevo(true)}>
                <Plus size={18} /> Nuevo
              </Boton>
            </div>
          }
        />
      </div>

      <div className="relative mb-3">
        <Search className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-ink-300" size={20} />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por nombre o teléfono"
          className="h-12 w-full rounded-xl bg-superficie pr-4 pl-11 ring-1 ring-ink-100 outline-none focus:ring-2 focus:ring-brand-500"
        />
      </div>
      {interesadosNuevos > 0 && (
        <Link to="/alumnos/interesados" className="mb-3 flex items-center gap-3 rounded-2xl bg-brand-50 px-4 py-3 text-sm font-semibold text-brand-600 ring-1 ring-brand-500/30">
          <Megaphone size={18} className="shrink-0" />
          <span className="flex-1">
            {interesadosNuevos} {interesadosNuevos === 1 ? 'interesado nuevo' : 'interesados nuevos'} por contactar
          </span>
          <ChevronRight size={18} />
        </Link>
      )}
      <Chips<Filtro>
        etiqueta="Filtrar alumnos"
        opciones={[
          { valor: 'todos', texto: 'Todos' },
          { valor: 'ok', texto: 'Al corriente' },
          { valor: 'pronto', texto: 'Por vencer' },
          { valor: 'sin', texto: 'Sin plan' },
          ...(deben.size ? [{ valor: 'debe' as const, texto: `Deben (${deben.size})` }] : []),
          ...(planesBeca.size ? [{ valor: 'beca' as const, texto: 'Becados' }] : []),
        ]}
        valor={filtro}
        onChange={setFiltro}
      />

      <div className="mt-3">
        {filas.length === 0 ? (
          <Vacio icono={<Users size={40} />} titulo={alumnos.length ? 'Nadie coincide' : 'Aún no hay alumnos'} texto={alumnos.length ? undefined : 'Se registran solos desde Entrada la primera vez que llegan.'} />
        ) : (
          <Tarjeta className="divide-y divide-ink-100">
            {filas.map(({ a, s, beca }) => (
              <button key={a.id} onClick={() => nav(`/alumnos/${a.id}`)} className="flex w-full items-center gap-3 px-3 py-3 text-left active:bg-ink-50">
                <Avatar nombre={a.nombre} foto={a.foto} tam={40} />
                <span className="min-w-0 flex-1 truncate font-semibold">{a.nombre}</span>
                {deben.has(a.id) && <Etiqueta tono="sin">Debe {deben.get(a.id)}</Etiqueta>}
                {beca && <Etiqueta tono="marca">Beca</Etiqueta>}
                <Etiqueta tono={s.tono}>{s.texto}</Etiqueta>
              </button>
            ))}
          </Tarjeta>
        )}
        {(bajas > 0 || verBajas) && (
          <button onClick={() => setVerBajas(!verBajas)} className="mt-4 w-full py-2 text-sm font-semibold text-ink-500">
            {verBajas ? '← Volver a alumnos activos' : `Ver dados de baja (${bajas})`}
          </button>
        )}
      </div>

      <Hoja abierta={nuevo} onCerrar={() => setNuevo(false)} titulo="Alumno nuevo">
        <FormAlumno onGuardado={(a) => { setNuevo(false); nav(`/alumnos/${a.id}`, { state: { recien: true } }); }} />
      </Hoja>
    </div>
  );
}
