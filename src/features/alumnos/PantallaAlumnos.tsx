import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { ChevronRight, ClipboardList, FileSpreadsheet, Megaphone, Plus, Search, Users } from 'lucide-react';
import { useSesion } from '../../app/sesion';
import { useAlumnos, useAlumnosArchivados, useEstadosPorAlumno, usePlanes } from '../../app/datos';
import { esBeca } from '../../domain/becas';
import { NOMBRE_ANONIMO } from '../../domain/correcciones';
import { Avatar, Boton, Chips, Encabezado, Etiqueta, Hoja, Tarjeta, Vacio } from '../../components/ui';
import { semaforoAlumno, type Semaforo } from '../../domain/membresias';
import { FormAlumno } from './FormAlumno';
import { useAltasNuevas } from './seguimientoAlta';

const normalizar = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
type Filtro = 'todos' | Semaforo | 'beca' | 'debe';

const TANDA = 60;

export function PantallaAlumnos() {
  const { esDueno, academia, usuario } = useSesion();
  const altasNuevas = useAltasNuevas(academia.id, usuario.id);
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
  // qué se ve: los que vienen (por defecto), los archivados (no vienen hace ~6 meses) o los dados de baja
  const [vista, setVista] = useState<'activos' | 'archivados' | 'bajas'>('activos');
  const verBajas = vista === 'bajas';
  const bajas = alumnos.filter((a) => !a.activo).length;
  const archivados = useAlumnosArchivados(alumnos, estados);
  const [nuevo, setNuevo] = useState(false);

  const filas = useMemo(() => {
    const t = normalizar(q.trim());
    return alumnos
      .filter((a) => {
        if (verBajas) return !a.activo;
        if (vista === 'archivados') return archivados.has(a.id);
        return t ? a.nombre !== NOMBRE_ANONIMO : a.activo && !archivados.has(a.id);
      })
      .map((a) => {
        const est = estados.get(a.id) ?? [];
        return { a, s: semaforoAlumno(est), beca: est.some((e) => e.vigente && planesBeca.has(e.membresia.planId)) };
      })
      .filter(({ a }) => !t || normalizar(a.nombre).includes(t) || a.telefono.includes(t))
      .filter(({ a, s, beca }) => filtro === 'todos' || (filtro === 'beca' ? beca : filtro === 'debe' ? deben.has(a.id) : s.tono === filtro));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alumnos, estados, q, filtro, vista, verBajas, archivados, planesBeca.size, deben]);

  // Con miles de alumnos se dibujan por tandas: 60 y otros 60 al llegar al final (la búsqueda y los filtros
  // siguen siendo sobre todos). Dibujar 5,000 filas de golpe es lento en un celular y la lista no se acaba.
  const [cuantos, setCuantos] = useState(TANDA);
  useEffect(() => setCuantos(TANDA), [q, filtro, vista]);
  const final = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = final.current;
    if (!el || cuantos >= filas.length) return;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setCuantos((n) => n + TANDA), { rootMargin: '600px' });
    io.observe(el);
    return () => io.disconnect();
  }, [cuantos, filas.length]);

  return (
    <div className="px-4 pb-6 lg:mx-auto lg:max-w-3xl">
      <div className="-mx-4">
        <Encabezado
          titulo="Alumnos"
          sub={`${(alumnos.filter((a) => a.activo).length - archivados.size).toLocaleString('es-MX')} activos${archivados.size ? ` · ${archivados.size.toLocaleString('es-MX')} archivados` : ''}`}
          accion={
            <div className="flex gap-2">
              <Link to="/alumnos/listas">
                <Boton variante="secundario">
                  <ClipboardList size={18} aria-hidden="true" /> <span className="max-[359px]:sr-only">Listas</span>
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
      <Link to="/alumnos/registro" className="mb-3 flex min-h-12 items-center gap-3 rounded-2xl bg-brand-50 px-4 py-3 text-sm font-semibold text-brand-600">
        <Users size={18} aria-hidden="true" />
        <span className="flex-1">Registro por enlace</span>
        {altasNuevas > 0 && (
          <span className="rounded-full bg-brand-600 px-2.5 py-1 text-xs text-white">
            {altasNuevas.toLocaleString('es-MX')} {altasNuevas === 1 ? 'alta nueva' : 'altas nuevas'}
          </span>
        )}
        <ChevronRight size={18} aria-hidden="true" />
      </Link>
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
          <Vacio icono={<Users size={40} />} titulo={alumnos.length ? 'Nadie coincide' : 'Aún no hay alumnos'} texto={alumnos.length ? undefined : 'Se registran solos desde Entrada la primera vez que llegan.'}>
            {!alumnos.length && esDueno && (
              <Link to="/alumnos/importar">
                <Boton variante="secundario">
                  <FileSpreadsheet size={18} /> Importar mi lista de Excel
                </Boton>
              </Link>
            )}
          </Vacio>
        ) : (
          <Tarjeta className="divide-y divide-ink-100">
            {filas.slice(0, cuantos).map(({ a, s, beca }) => (
              <button key={a.id} onClick={() => nav(`/alumnos/${a.id}`)} className="flex w-full items-center gap-3 px-3 py-3 text-left active:bg-ink-50">
                <Avatar nombre={a.nombre} foto={a.foto} tam={40} />
                <span className="min-w-0 flex-1 truncate font-semibold">{a.nombre}</span>
                {deben.has(a.id) && <Etiqueta tono="sin">Debe {deben.get(a.id)}</Etiqueta>}
                {beca && <Etiqueta tono="marca">Beca</Etiqueta>}
                {!a.activo ? <Etiqueta tono="pronto">De baja</Etiqueta> : archivados.has(a.id) ? <Etiqueta tono="neutro">Archivado</Etiqueta> : <Etiqueta tono={s.color}>{s.texto}</Etiqueta>}
              </button>
            ))}
          </Tarjeta>
        )}
        {cuantos < filas.length && (
          <div ref={final} className="mt-3 text-center">
            <p className="text-xs text-ink-500">
              Mostrando {cuantos.toLocaleString('es-MX')} de {filas.length.toLocaleString('es-MX')} · busca por nombre para ir directo
            </p>
            <button onClick={() => setCuantos((n) => n + TANDA)} className="mt-1 min-h-10 rounded-lg px-3 text-sm font-semibold text-brand-600 active:bg-brand-50">
              Ver más
            </button>
          </div>
        )}
        {vista === 'archivados' && filas.length > 0 && (
          <p className="mt-3 px-1 text-xs text-ink-500">No han venido en 6 meses y no tienen plan. Siguen aquí con todo su historial; en cuanto vuelvan a entrar, regresan solos a la lista.</p>
        )}
        <div className="mt-4 flex flex-col">
          {vista !== 'activos' ? (
            <button onClick={() => setVista('activos')} className="min-h-11 py-2 text-sm font-semibold text-ink-500">
              ← Volver a los que vienen
            </button>
          ) : (
            <>
              {archivados.size > 0 && (
                <button onClick={() => setVista('archivados')} className="min-h-11 py-2 text-sm font-semibold text-ink-500">
                  Ver archivados ({archivados.size.toLocaleString('es-MX')}) · no vienen hace 6 meses
                </button>
              )}
              {bajas > 0 && (
                <button onClick={() => setVista('bajas')} className="min-h-11 py-2 text-sm font-semibold text-ink-500">
                  Ver dados de baja ({bajas})
                </button>
              )}
              {esDueno && alumnos.length > 0 && (
                <Link to="/alumnos/importar" className="flex min-h-11 items-center justify-center gap-1.5 py-2 text-sm font-semibold text-ink-500">
                  <FileSpreadsheet size={16} aria-hidden="true" /> Importar alumnos de Excel
                </Link>
              )}
            </>
          )}
        </div>
      </div>

      <Hoja abierta={nuevo} onCerrar={() => setNuevo(false)} titulo="Alumno nuevo">
        <FormAlumno archivados={archivados} onGuardado={(a, creado) => { setNuevo(false); nav(`/alumnos/${a.id}`, { state: { recien: creado } }); }} />
      </Hoja>
    </div>
  );
}
