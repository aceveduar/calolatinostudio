import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { BookOpen, CalendarDays, ChevronDown, RefreshCw, Sparkles, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { colorClase, nombreClase, useClases, useDisciplinas } from '../../app/datos';
import { useSesion } from '../../app/sesion';
import { useHoy } from '../../app/reloj';
import { nombreSede, useSedes } from '../../app/sedes';
import { Avatar, Encabezado, Etiqueta, Hoja, Seccion, Tarjeta, Vacio, cx } from '../../components/ui';
import { db } from '../../db/db';
import type { Clase, ID } from '../../db/types';
import { claseSugerida, clasesDelDia } from '../../domain/clases';
import { aFecha, deFecha, fechaLarga, horaDe, sumarDias } from '../../domain/fechas';
import { sincronizar, useEstadoSync } from '../../sync/engine';
import { TarjetaTestimonio } from '../testimonios/TarjetaTestimonio';

/**
 * Modo maestro: solo sus clases. Quién llegó (en vivo), quién viene por primera vez,
 * notas del alumno y sus números. Nunca muestra dinero.
 */
export function PantallaMaestro() {
  const { usuario, academia } = useSesion();
  const clases = useClases();
  const disciplinas = useDisciplinas();
  const sync = useEstadoSync();
  const mias = useMemo(() => clases.filter((c) => c.maestroId && c.maestroId === usuario.maestroId && c.activo), [clases, usuario.maestroId]);
  const dia = useHoy();
  const sedes = useSedes();
  const deHoy = useMemo(() => clasesDelDia(mias, deFecha(dia)), [mias, dia]);
  const [seleccion, setSeleccion] = useState<{ id: ID; dia: string } | null>(null);
  const [elegir, setElegir] = useState(false);
  const clase = (seleccion?.dia === dia ? deHoy.find((c) => c.id === seleccion.id) : null) ?? claseSugerida(deHoy);
  const nombre1 = usuario.nombre.replace(/^Prof[ae]\.?\s+/i, '').split(' ')[0];

  if (!usuario.maestroId || !mias.length)
    return (
      <div className="px-4">
        <Encabezado titulo={`Hola, ${nombre1}`} sub={fechaLarga(dia)} />
        <Tarjeta>
          <Vacio icono={<CalendarDays size={36} />} titulo="Aún no tienes clases asignadas" texto="Pídele a la dirección que te asigne tus clases en Ajustes → Clases y horarios." />
        </Tarjeta>
      </div>
    );

  return (
    <div className="px-4 pb-8 lg:mx-auto lg:max-w-4xl">
      <div className="-mx-4 flex items-end justify-between lg:mx-0">
        <Encabezado titulo={`Hola, ${nombre1}`} sub={fechaLarga(dia)} />
        <button
          onClick={() => void sincronizar()}
          disabled={sync.fase === 'sincronizando'}
          className="mr-4 mb-4 flex items-center gap-1.5 rounded-full px-3 py-2.5 text-sm font-semibold text-ink-500 active:bg-ink-100 lg:mr-0"
          aria-label="Actualizar lista"
        >
          <RefreshCw size={16} className={sync.fase === 'sincronizando' ? 'animate-spin' : undefined} /> Actualizar
        </button>
      </div>

      {/* como en Entrada: la clase sale una vez (en su tarjeta) y desde ahí se cambia si hoy da varias */}
      {clase ? <MiClase clase={clase} dia={dia} sede={nombreSede(clase.sedeId, sedes, academia)} onCambiar={deHoy.length > 1 ? () => setElegir(true) : undefined} /> : <ProximaClase mias={mias} dia={dia} />}
      <Hoja abierta={elegir} onCerrar={() => setElegir(false)} titulo="Tus clases de hoy">
        {elegir && (
          <div className="space-y-2">
            {deHoy.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  setSeleccion({ id: c.id, dia });
                  setElegir(false);
                }}
                aria-current={clase?.id === c.id || undefined}
                className={cx('flex w-full items-center gap-3 rounded-2xl bg-superficie px-4 py-3 text-left ring-1', clase?.id === c.id ? 'ring-2 ring-brand-500' : 'ring-ink-100')}
              >
                <span className="h-10 w-1.5 shrink-0 rounded-full" style={{ background: colorClase(c, disciplinas) }} aria-hidden="true" />
                <span className="flex-1">
                  <span className="block font-bold">{nombreClase(c, disciplinas)}</span>
                  <span className="block text-sm text-ink-500">{c.horaInicio} · {nombreSede(c.sedeId, sedes, academia)}</span>
                </span>
              </button>
            ))}
          </div>
        )}
      </Hoja>

      <MisNumeros mias={mias} />
      <TestimoniosDeMisAlumnos mias={mias} />
      <Link to="/ayuda" className="mt-6 flex min-h-11 items-center justify-center gap-2 rounded-xl text-sm font-semibold text-ink-700 active:bg-ink-100">
        <BookOpen size={17} aria-hidden="true" /> Cómo se usa
      </Link>
    </div>
  );
}

/** Testimonios por revisar de alumnos que vinieron a sus clases en los últimos 60 días (puede publicarlos). */
function TestimoniosDeMisAlumnos({ mias }: { mias: Clase[] }) {
  const datos = useLiveQuery(async () => {
    const pendientes = (await db.testimonios.where('estado').equals('pendiente').toArray()).filter((t) => !t.deletedAt);
    if (!pendientes.length) return [];
    const ids = new Set(mias.map((c) => c.id));
    const suyos = new Set((await db.asistencias.where('fecha').aboveOrEqual(aFecha(new Date(Date.now() - 60 * 86_400_000))).toArray()).filter((a) => ids.has(a.claseId) && a.alumnoId).map((a) => a.alumnoId!));
    const mios = pendientes.filter((t) => suyos.has(t.alumnoId));
    const alumnos = await db.alumnos.bulkGet(mios.map((t) => t.alumnoId));
    return mios.map((t, i) => ({ t, alumno: alumnos[i] }));
  }, [mias]);
  if (!datos?.length) return null;
  return (
    <Seccion titulo={`Testimonios de tus alumnos · ${datos.length}`}>
      <div className="space-y-3">
        {datos.map(({ t, alumno }) => (
          <TarjetaTestimonio key={t.id} t={t} alumno={alumno} conFicha={false} />
        ))}
      </div>
    </Seccion>
  );
}

function MiClase({ clase, dia, sede, onCambiar }: { clase: Clase; dia: string; sede: string; onCambiar?: () => void }) {
  const disciplinas = useDisciplinas();
  const lista = useLiveQuery(
    async () => {
      const asis = (await db.asistencias.where('[claseId+fecha]').equals([clase.id, dia]).toArray())
        .filter((a) => !a.anuladaAt && !a.deletedAt)
        .sort((a, b) => a.createdAt - b.createdAt);
      return Promise.all(
        asis.map(async (a) => {
          const alumno = a.alumnoId ? await db.alumnos.get(a.alumnoId) : undefined;
          const antes = a.alumnoId
            ? await db.asistencias
                .where('alumnoId')
                .equals(a.alumnoId)
                .filter((x) => x.fecha < dia && !x.anuladaAt && !x.deletedAt)
                .count()
            : 0;
          return { a, nombre: alumno?.nombre ?? a.nombreVisitante ?? 'Visitante', notas: alumno?.notas ?? '', primera: !!a.alumnoId && antes === 0, visitante: !a.alumnoId };
        }),
      );
    },
    [clase.id, dia],
    [],
  );
  const nuevos = lista.filter((x) => x.primera || x.visitante).length;
  const color = colorClase(clase, disciplinas);

  return (
    <>
      <div
        className="relative overflow-hidden rounded-3xl px-5 py-4 text-white shadow-lg"
        style={{ background: `linear-gradient(135deg in oklab, ${color}, color-mix(in oklab, ${color} 55%, #1c1a24))` }}
      >
        <div className="flex items-end justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-white/90">{clase.horaInicio} · {sede}</p>
            <p className="mt-0.5 break-words text-xl font-extrabold tracking-tight">{nombreClase(clase, disciplinas)}</p>
              {onCambiar && (
                <button type="button" onClick={onCambiar} className="mt-1 flex min-h-11 items-center gap-1 rounded-xl px-2 text-sm font-bold active:bg-white/30" aria-label="Cambiar a otra de tus clases de hoy">
                  Otra clase <ChevronDown size={13} aria-hidden="true" />
                </button>
              )}
            {nuevos > 0 && <p className="mt-1 text-sm font-semibold text-white/90">{nuevos} {nuevos === 1 ? 'viene' : 'vienen'} por primera vez</p>}
          </div>
          <div className="text-right">
            <p key={lista.length} className="text-5xl leading-none font-extrabold tracking-tight animate-pop">
              {lista.length}
            </p>
            <p className="mt-1 text-xs font-semibold text-white/80">{lista.length === 1 ? 'alumno' : 'alumnos'}</p>
          </div>
        </div>
      </div>

      <Seccion titulo="Quién llegó">
        {lista.length === 0 ? (
          <Tarjeta>
            <Vacio icono={<Users size={36} />} titulo="Aún no llega nadie" texto="La lista se llena sola conforme recepción les da entrada." />
          </Tarjeta>
        ) : (
          <Tarjeta className="divide-y divide-ink-100 lg:grid lg:grid-cols-2 lg:divide-y-0">
            {lista.map(({ a, nombre, notas, primera, visitante }) => (
              <div key={a.id} className={cx('flex items-center gap-3 px-3 py-2.5', primera && 'bg-brand-50/60', 'lg:border-b lg:border-ink-100')}>
                <Avatar nombre={nombre} tam={38} />
                <span className="min-w-0 flex-1">
                  <span className="block break-words font-semibold">{nombre}</span>
                  {(primera || visitante || notas) && <span className="mt-0.5 flex min-w-0 flex-wrap items-center gap-1.5">
                    {primera ? (
                      <Etiqueta tono="marca">
                        <Sparkles size={12} className="mr-1" /> Primera clase
                      </Etiqueta>
                    ) : visitante ? (
                      <Etiqueta>Visitante</Etiqueta>
                    ) : null}
                    {notas && <span className="break-words text-xs text-ink-500">{notas}</span>}
                  </span>}
                </span>
                <span className="w-11 text-right text-xs text-ink-500">{horaDe(a.createdAt)}</span>
              </div>
            ))}
          </Tarjeta>
        )}
        <p className="mt-2 px-1 text-xs text-ink-500">Se actualiza sola cada minuto, o al tocar “Actualizar”.</p>
      </Seccion>
    </>
  );
}

function ProximaClase({ mias, dia }: { mias: Clase[]; dia: string }) {
  const disciplinas = useDisciplinas();
  const { academia } = useSesion();
  const sedes = useSedes();
  let prox: { fecha: string; clase: Clase } | undefined;
  for (let n = 1; n <= 28 && !prox; n++) {
    const fecha = sumarDias(dia, n);
    const [clase] = clasesDelDia(mias, deFecha(fecha));
    if (clase) prox = { fecha, clase };
  }
  return (
    <Tarjeta className="flex items-start gap-3 p-4">
      <CalendarDays size={20} className="mt-0.5 shrink-0 text-brand-600" aria-hidden="true" />
      <div className="min-w-0">
        <p className="text-sm text-ink-500">Hoy no tienes clase</p>
        {prox && <>
          <p className="mt-2 text-xs font-semibold text-ink-500">Próxima clase</p>
          <h2 className="mt-1 font-extrabold">{nombreClase(prox.clase, disciplinas)}</h2>
          <p className="text-sm text-ink-600">{fechaLarga(prox.fecha)} · {prox.clase.horaInicio}</p>
          <p className="text-sm text-ink-600">{nombreSede(prox.clase.sedeId, sedes, academia)}</p>
        </>}
      </div>
    </Tarjeta>
  );
}

/** Sus números del mes, sin dinero: sesiones dadas y alumnos por sesión. */
function MisNumeros({ mias }: { mias: Clase[] }) {
  const disciplinas = useDisciplinas();
  const inicioMes = aFecha(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const filas = useLiveQuery(
    async () => {
      const ids = new Set(mias.map((c) => c.id));
      const asis = (await db.asistencias.where('fecha').aboveOrEqual(inicioMes).toArray()).filter((a) => ids.has(a.claseId) && !a.anuladaAt && !a.deletedAt);
      return mias
        .map((c) => {
          const a = asis.filter((x) => x.claseId === c.id);
          const sesiones = new Set(a.map((x) => x.fecha)).size;
          return { c, sesiones, total: a.length, promedio: sesiones ? Math.round(a.length / sesiones) : 0 };
        })
        .filter((f) => f.sesiones > 0);
    },
    [mias, inicioMes],
    [],
  );
  const totalSesiones = filas.reduce((s, f) => s + f.sesiones, 0);
  const totalAlumnos = filas.reduce((s, f) => s + f.total, 0);
  const mes = new Date().toLocaleDateString('es-MX', { month: 'long' });

  return (
    <Seccion titulo={`Tus números de ${mes}`}>
      <div className="mb-2 grid grid-cols-2 gap-2">
        <Tarjeta className="p-4">
          <p className="text-xs font-semibold text-ink-500">Clases dadas</p>
          <p className="text-3xl font-extrabold">{totalSesiones}</p>
        </Tarjeta>
        <Tarjeta className="p-4">
          <p className="text-xs font-semibold text-ink-500">Asistencias</p>
          <p className="text-3xl font-extrabold">{totalAlumnos.toLocaleString('es-MX')}</p>
        </Tarjeta>
      </div>
      {filas.length > 0 && (
        <Tarjeta className="divide-y divide-ink-100">
          {filas.map(({ c, sesiones, promedio }) => (
            <div key={c.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
              <span className="font-medium">
                {nombreClase(c, disciplinas)} <span className="text-ink-500">{c.horaInicio}</span>
              </span>
              <span className="text-ink-700">
                {sesiones} clases · <b>{promedio}</b> por clase
              </span>
            </div>
          ))}
        </Tarjeta>
      )}
    </Seccion>
  );
}
