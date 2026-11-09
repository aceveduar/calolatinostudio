import { useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Search, UserPlus, X, Users, Footprints, CalendarDays } from 'lucide-react';
import { colorClase, nombreClase, useAlumnos, useClases, useDisciplinas, useEstadosPorAlumno, usePlanes } from '../../app/datos';
import { useSesion } from '../../app/sesion';
import { useAvisos } from '../../components/avisos';
import { Avatar, Boton, Campo, Encabezado, Entrada, Etiqueta, Hoja, Segmentos, Tarjeta, Vacio, cx } from '../../components/ui';
import { db } from '../../db/db';
import type { Alumno, Clase, ID, MetodoPago } from '../../db/types';
import { claseSugerida, clasesDelDia } from '../../domain/clases';
import { dinero } from '../../domain/dinero';
import { DIAS_CORTOS, fechaLarga, horaDe, hoy } from '../../domain/fechas';
import { semaforoAlumno } from '../../domain/membresias';
import { anularAsistencia, cobrarClaseSuelta } from '../../domain/operaciones';
import { FormAlumno } from '../alumnos/FormAlumno';
import { METODOS } from '../alumnos/VenderPlan';
import { HojaEntrada } from './HojaEntrada';

const normalizar = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function PantallaEntrada() {
  const clases = useClases();
  const disciplinas = useDisciplinas();
  const alumnos = useAlumnos();
  const estados = useEstadosPorAlumno();
  const deHoy = useMemo(() => clasesDelDia(clases), [clases]);

  const [claseId, setClaseId] = useState<ID | null>(null);
  const [verTodas, setVerTodas] = useState(false);
  const clase: Clase | null = clases.find((c) => c.id === claseId) ?? claseSugerida(deHoy);

  const [q, setQ] = useState('');
  const [alumnoSel, setAlumnoSel] = useState<Alumno | null>(null);
  const [nuevo, setNuevo] = useState(false);
  const [visitante, setVisitante] = useState(false);
  const busca = useRef<HTMLInputElement>(null);

  const conteo = useLiveQuery(async () => {
    const asis = await db.asistencias.where('fecha').equals(hoy()).filter((a) => !a.anuladaAt && !a.deletedAt).toArray();
    const m = new Map<ID, number>();
    for (const a of asis) m.set(a.claseId, (m.get(a.claseId) ?? 0) + 1);
    return m;
  }, [], new Map<ID, number>());

  const resultados = useMemo(() => {
    const t = normalizar(q.trim());
    if (!t) return [];
    const dig = t.replace(/\D/g, '');
    return alumnos
      .filter((a) => a.activo)
      .filter((a) => normalizar(a.nombre).includes(t) || a.codigo.toLowerCase() === t || (dig.length >= 3 && a.telefono.includes(dig)))
      .slice(0, 8);
  }, [q, alumnos]);

  const cerrarYLimpiar = () => {
    setAlumnoSel(null);
    setQ('');
  };

  return (
    <div>
      <Encabezado titulo="Entrada" sub={fechaLarga(hoy())} />

      {/* Clases del día */}
      <div className="no-scrollbar flex gap-2 overflow-x-auto px-4 pb-1">
        {(verTodas ? clases.filter((c) => c.activo) : deHoy).map((c) => {
          const activa = clase?.id === c.id;
          const color = colorClase(c, disciplinas);
          return (
            <button
              key={c.id}
              onClick={() => setClaseId(c.id)}
              className={cx('flex shrink-0 items-center gap-2 rounded-2xl px-4 py-2.5 text-left ring-1 transition', activa ? 'text-white ring-transparent' : 'bg-white ring-ink-100')}
              style={activa ? { background: color } : undefined}
            >
              {!activa && <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />}
              <span>
                <span className="block text-[15px] leading-tight font-bold">{nombreClase(c, disciplinas)}</span>
                <span className={cx('block text-xs', activa ? 'text-white/80' : 'text-ink-500')}>
                  {verTodas ? c.dias.map((d) => DIAS_CORTOS[d]).join(' ') + ' · ' : ''}
                  {c.horaInicio}
                  {!verTodas && ` · ${conteo.get(c.id) ?? 0}`}
                </span>
              </span>
            </button>
          );
        })}
        <button onClick={() => setVerTodas(!verTodas)} className="flex shrink-0 items-center gap-1.5 rounded-2xl border border-dashed border-ink-300 px-4 text-sm font-semibold text-ink-500">
          <CalendarDays size={16} /> {verTodas ? 'Solo hoy' : deHoy.length ? 'Otra' : 'Elegir clase'}
        </button>
      </div>

      {/* Buscador */}
      <div className="sticky top-0 z-20 bg-ink-50/95 px-4 pt-3 pb-2 backdrop-blur">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-ink-300" size={22} />
          <input
            ref={busca}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="¿Quién llegó?"
            className="h-14 w-full rounded-2xl bg-white pr-12 pl-12 text-lg shadow-sm ring-1 ring-ink-100 outline-none placeholder:text-ink-300 focus:ring-2 focus:ring-brand-500"
            autoComplete="off"
            enterKeyHint="search"
          />
          {q && (
            <button onClick={() => { setQ(''); busca.current?.focus(); }} className="absolute top-1/2 right-3 -translate-y-1/2 rounded-full p-1.5 text-ink-500 active:bg-ink-100" aria-label="Limpiar">
              <X size={20} />
            </button>
          )}
        </div>
      </div>

      <div className="px-4 pb-6">
        {q.trim() ? (
          <div className="space-y-2 pt-1">
            {resultados.map((a) => {
              const s = semaforoAlumno(estados.get(a.id) ?? []);
              return (
                <Tarjeta key={a.id} onClick={() => setAlumnoSel(a)} className="flex items-center gap-3 p-3">
                  <Avatar nombre={a.nombre} />
                  <span className="min-w-0 flex-1 truncate text-[17px] font-semibold">{a.nombre}</span>
                  <Etiqueta tono={s.tono}>{s.texto}</Etiqueta>
                </Tarjeta>
              );
            })}
            <Tarjeta onClick={() => setNuevo(true)} className="flex items-center gap-3 p-3 text-brand-600">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-50">
                <UserPlus size={20} />
              </span>
              <span className="font-semibold">Registrar “{q.trim()}” como alumno nuevo</span>
            </Tarjeta>
          </div>
        ) : (
          <EnClase clase={clase} onVisitante={() => setVisitante(true)} />
        )}
      </div>

      <HojaEntrada alumno={alumnoSel} clase={clase} onCerrar={cerrarYLimpiar} />

      <Hoja abierta={nuevo} onCerrar={() => setNuevo(false)} titulo="Alumno nuevo">
        <FormAlumno
          nombreInicial={q.trim().split(/\s+/).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
          onGuardado={(a) => {
            setNuevo(false);
            setAlumnoSel(a);
          }}
        />
      </Hoja>

      <Hoja abierta={visitante} onCerrar={() => setVisitante(false)} titulo="Visitante sin registro">
        {visitante && <FormVisitante clase={clase} onHecho={() => setVisitante(false)} />}
      </Hoja>
    </div>
  );
}

function EnClase({ clase, onVisitante }: { clase: Clase | null; onVisitante: () => void }) {
  const disciplinas = useDisciplinas();
  const avisar = useAvisos();
  const [quitar, setQuitar] = useState<ID | null>(null);
  const lista = useLiveQuery(async () => {
    if (!clase) return [];
    const asis = await db.asistencias
      .where('[claseId+fecha]')
      .equals([clase.id, hoy()])
      .filter((a) => !a.anuladaAt && !a.deletedAt)
      .toArray();
    const alumnos = await db.alumnos.bulkGet(asis.map((a) => a.alumnoId ?? ''));
    const pagos = await db.pagos.bulkGet(asis.map((a) => a.pagoId ?? ''));
    return asis
      .map((a, i) => ({ a, nombre: alumnos[i]?.nombre ?? a.nombreVisitante ?? 'Visitante', pago: pagos[i] }))
      .sort((x, y) => y.a.createdAt - x.a.createdAt);
  }, [clase?.id], []);

  if (!clase)
    return <Vacio icono={<CalendarDays size={40} />} titulo="Hoy no hay clases programadas" texto="Toca “Elegir clase” para registrar entradas en otra clase." />;

  const sel = lista.find((x) => x.a.id === quitar);

  return (
    <div className="pt-2">
      <div className="mb-2 flex items-center justify-between px-1">
        <h2 className="text-xs font-bold tracking-wider text-ink-500 uppercase">
          En {nombreClase(clase, disciplinas)} · {lista.length}
        </h2>
        <button onClick={onVisitante} className="flex items-center gap-1 text-sm font-semibold text-brand-600">
          <Footprints size={16} /> Visitante
        </button>
      </div>
      {lista.length === 0 ? (
        <Tarjeta>
          <Vacio icono={<Users size={36} />} titulo="Aún no llega nadie" texto="Busca al alumno por su nombre arriba." />
        </Tarjeta>
      ) : (
        <Tarjeta className="divide-y divide-ink-100">
          {lista.map(({ a, nombre, pago }) => (
            <button key={a.id} onClick={() => setQuitar(a.id)} className="flex w-full items-center gap-3 px-3 py-2.5 text-left active:bg-ink-50">
              <Avatar nombre={nombre} tam={36} />
              <span className="min-w-0 flex-1 truncate font-medium">{nombre}</span>
              {pago ? <Etiqueta tono="marca">{dinero(pago.monto)}</Etiqueta> : <Etiqueta tono="ok">Plan</Etiqueta>}
              <span className="w-12 text-right text-xs text-ink-500">{horaDe(a.createdAt)}</span>
            </button>
          ))}
        </Tarjeta>
      )}

      <Hoja abierta={!!sel} onCerrar={() => setQuitar(null)} titulo={sel?.nombre}>
        {sel &&
          (sel.pago ? (
            <p className="text-ink-700">
              Esta entrada se cobró ({dinero(sel.pago.monto)}, {sel.pago.metodo}). Para quitarla, anula el cobro en <b>Caja</b> y así el dinero
              también cuadra.
            </p>
          ) : (
            <div className="space-y-3">
              <p className="text-ink-700">¿Quitar esta entrada? La clase se le devuelve a su plan.</p>
              <Boton
                bloque
                variante="peligro"
                onClick={async () => {
                  await anularAsistencia(sel.a.id);
                  setQuitar(null);
                  avisar('Entrada quitada');
                }}
              >
                Quitar entrada
              </Boton>
            </div>
          ))}
      </Hoja>
    </div>
  );
}

function FormVisitante({ clase, onHecho }: { clase: Clase | null; onHecho: () => void }) {
  const { usuario } = useSesion();
  const avisar = useAvisos();
  const suelta = usePlanes().find((p) => p.activo && p.tipo === 'suelta');
  const [nombre, setNombre] = useState('');
  const [metodo, setMetodo] = useState<MetodoPago>('efectivo');
  const [ocupado, setOcupado] = useState(false);

  if (!clase) return <p className="text-ink-500">Elige primero una clase.</p>;
  if (!suelta) return <p className="text-ink-500">Crea un plan de tipo “clase suelta” en Ajustes.</p>;

  return (
    <div className="space-y-4">
      <p className="text-sm text-ink-500">Para quien viene a probar o no quiere registrarse. Cuenta en caja igual que la tarjeta.</p>
      <Campo etiqueta="Nombre (opcional)">
        <Entrada value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Visitante" />
      </Campo>
      <Segmentos opciones={METODOS} valor={metodo} onChange={setMetodo} />
      <Boton
        grande
        bloque
        disabled={ocupado}
        onClick={async () => {
          setOcupado(true);
          await cobrarClaseSuelta({ alumnoId: null, nombreVisitante: nombre, claseId: clase.id, plan: suelta, metodo, usuarioId: usuario.id });
          avisar(`${dinero(suelta.precio)} cobrados`);
          onHecho();
        }}
      >
        Cobrar {dinero(suelta.precio)}
      </Boton>
    </div>
  );
}
