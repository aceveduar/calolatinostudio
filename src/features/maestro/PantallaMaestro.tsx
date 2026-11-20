import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { BookOpen, CalendarDays, ChevronDown, RefreshCw, Sparkles, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { colorClase, nombreClase, useClases, useDisciplinas } from '../../app/datos';
import { useSesion } from '../../app/sesion';
import { Avatar, Encabezado, Etiqueta, Hoja, Seccion, Tarjeta, Vacio, cx } from '../../components/ui';
import { db } from '../../db/db';
import type { Clase, ID } from '../../db/types';
import { claseSugerida, clasesDelDia } from '../../domain/clases';
import { DIAS_CORTOS, aFecha, fechaLarga, horaDe, hoy } from '../../domain/fechas';
import { sincronizar, useEstadoSync } from '../../sync/engine';
import { TarjetaTestimonio } from '../testimonios/TarjetaTestimonio';

/**
 * Modo maestro: solo sus clases. Quién llegó (en vivo), quién viene por primera vez,
 * notas del alumno y sus números. Nunca muestra dinero.
 */
export function PantallaMaestro() {
  const { usuario } = useSesion();
  const clases = useClases();
  const disciplinas = useDisciplinas();
  const sync = useEstadoSync();
  const mias = useMemo(() => clases.filter((c) => c.maestroId && c.maestroId === usuario.maestroId && c.activo), [clases, usuario.maestroId]);
  const deHoy = useMemo(() => clasesDelDia(mias), [mias]);
  const [claseId, setClaseId] = useState<ID | null>(null);
  const [elegir, setElegir] = useState(false);
  const clase = mias.find((c) => c.id === claseId) ?? claseSugerida(deHoy);
  const nombre1 = usuario.nombre.replace(/^Prof[ae]\.?\s+/i, '').split(' ')[0];

  if (!usuario.maestroId || !mias.length)
    return (
      <div className="px-4">
        <Encabezado titulo={`Hola, ${nombre1}`} sub={fechaLarga(hoy())} />
        <Tarjeta>
          <Vacio icono={<CalendarDays size={36} />} titulo="Aún no tienes clases asignadas" texto="Pídele a la dirección que te asigne tus clases en Ajustes → Clases y horarios." />
        </Tarjeta>
      </div>
    );

  return (
    <div className="px-4 pb-8 lg:mx-auto lg:max-w-4xl">
      <div className="-mx-4 flex items-end justify-between lg:mx-0">
        <Encabezado titulo={`Hola, ${nombre1}`} sub={fechaLarga(hoy())} />
        <button
          onClick={() => void sincronizar()}
          className="mr-4 mb-4 flex items-center gap-1.5 rounded-full px-3 py-2.5 text-sm font-semibold text-ink-500 active:bg-ink-100 lg:mr-0"
          aria-label="Actualizar lista"
        >
          <RefreshCw size={16} className={sync.fase === 'sincronizando' ? 'animate-spin' : undefined} /> Actualizar
        </button>
      </div>

      {/* como en Entrada: la clase sale una vez (en su tarjeta) y desde ahí se cambia si hoy da varias */}
      {clase ? <MiClase clase={clase} onCambiar={deHoy.length > 1 ? () => setElegir(true) : undefined} /> : <ProximaClase mias={mias} />}
      <Hoja abierta={elegir} onCerrar={() => setElegir(false)} titulo="Tus clases de hoy">
        {elegir && (
          <div className="space-y-2">
            {deHoy.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  setClaseId(c.id);
                  setElegir(false);
                }}
                aria-current={clase?.id === c.id || undefined}
                className={cx('flex w-full items-center gap-3 rounded-2xl bg-superficie px-4 py-3 text-left ring-1', clase?.id === c.id ? 'ring-2 ring-brand-500' : 'ring-ink-100')}
              >
                <span className="h-10 w-1.5 shrink-0 rounded-full" style={{ background: colorClase(c, disciplinas) }} aria-hidden="true" />
                <span className="flex-1">
                  <span className="block font-bold">{nombreClase(c, disciplinas)}</span>
                  <span className="block text-sm text-ink-500">{c.horaInicio}</span>
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

function MiClase({ clase, onCambiar }: { clase: Clase; onCambiar?: () => void }) {
  const disciplinas = useDisciplinas();
  const dia = hoy();
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
            <p className="text-xs font-semibold tracking-wider text-white/75 uppercase">Hoy · {clase.horaInicio}</p>
            <p className="mt-0.5 flex items-center gap-1.5 text-2xl font-extrabold tracking-tight">
              <span className="truncate">{nombreClase(clase, disciplinas)}</span>
              {onCambiar && (
                <button type="button" onClick={onCambiar} className="flex min-h-8 shrink-0 items-center gap-0.5 rounded-full bg-white/20 py-0.5 pr-1.5 pl-2.5 text-xs font-bold tracking-normal active:bg-white/30" aria-label="Cambiar a otra de tus clases de hoy">
                  Otra clase <ChevronDown size={13} aria-hidden="true" />
                </button>
              )}
            </p>
            <p className="mt-1 text-sm font-semibold text-white/85">{nuevos ? `${nuevos} ${nuevos === 1 ? 'viene' : 'vienen'} por primera vez` : 'Lista en vivo'}</p>
          </div>
          <div className="text-right">
            <p key={lista.length} className="text-5xl leading-none font-extrabold tracking-tight animate-pop">
              {lista.length}
            </p>
            <p className="mt-1 text-xs font-semibold text-white/80">{lista.length === 1 ? 'alumno' : 'alumnos'}</p>
          </div>
        </div>
      </div>

      <Seccion titulo="Quién llegó · en orden de llegada">
        {lista.length === 0 ? (
          <Tarjeta>
            <Vacio icono={<Users size={36} />} titulo="Aún no llega nadie" texto="La lista se llena sola conforme recepción les da entrada." />
          </Tarjeta>
        ) : (
          <Tarjeta className="divide-y divide-ink-100 lg:grid lg:grid-cols-2 lg:divide-y-0">
            {lista.map(({ a, nombre, notas, primera, visitante }, i) => (
              <div key={a.id} className={cx('flex items-center gap-3 px-3 py-2.5', primera && 'bg-brand-50/60', 'lg:border-b lg:border-ink-100')}>
                <span className="w-5 text-right text-xs text-ink-300">{i + 1}</span>
                <Avatar nombre={nombre} tam={38} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{nombre}</span>
                  <span className="mt-0.5 flex min-w-0 items-center gap-2">
                    {primera ? (
                      <Etiqueta tono="marca">
                        <Sparkles size={12} className="mr-1" /> Primera clase
                      </Etiqueta>
                    ) : visitante ? (
                      <Etiqueta>Visitante</Etiqueta>
                    ) : (
                      <Etiqueta tono={a.membresiaId ? 'ok' : 'neutro'}>{a.membresiaId ? 'Plan' : 'Pagó clase'}</Etiqueta>
                    )}
                    {notas && <span className="truncate text-xs text-ink-500">{notas}</span>}
                  </span>
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

function ProximaClase({ mias }: { mias: Clase[] }) {
  const disciplinas = useDisciplinas();
  const dias = mias.flatMap((c) => c.dias.map((d) => ({ c, d })));
  const hoyDia = new Date().getDay();
  const prox = dias.sort((x, y) => ((x.d - hoyDia + 7) % 7 || 7) - ((y.d - hoyDia + 7) % 7 || 7) || x.c.horaInicio.localeCompare(y.c.horaInicio))[0];
  return (
    <Tarjeta>
      <Vacio
        icono={<CalendarDays size={36} />}
        titulo="Hoy no tienes clase"
        texto={prox ? `Tu próxima clase: ${nombreClase(prox.c, disciplinas)}, ${DIAS_CORTOS[prox.d]} a las ${prox.c.horaInicio}.` : undefined}
      />
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
