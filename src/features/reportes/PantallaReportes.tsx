import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowDownRight, ArrowUpRight, CalendarClock, HeartCrack, MessageCircle } from 'lucide-react';
import { colorClase, nombreClase, useClases, useDisciplinas, useMaestros, usePlanes } from '../../app/datos';
import { useSesion } from '../../app/sesion';
import { Avatar, Encabezado, Etiqueta, Seccion, Segmentos, Tarjeta, Vacio, cx } from '../../components/ui';
import { db } from '../../db/db';
import { dinero } from '../../domain/dinero';
import { aFecha, fechaCorta, fechaLarga, hoy, sumarDias } from '../../domain/fechas';
import { textoDias } from '../../domain/membresias';
import { dejaronDeVenir, indicadores, ingresosPorDia, periodos, porClase, variacion, vencenPronto, waLink } from '../../domain/reportes';
import { GraficaBarras } from './GraficaBarras';
import { armarMensaje, plantilla } from '../../domain/mensajes';

type Rango = 7 | 30;

export function PantallaReportes() {
  const { academia } = useSesion();
  const clases = useClases();
  const disciplinas = useDisciplinas();
  const maestros = useMaestros();
  const planes = usePlanes();
  const [rango, setRango] = useState<Rango>(7);
  const dia = hoy();
  const { actual, anterior } = periodos(rango, dia);

  const datos = useLiveQuery(async () => {
    const desde = sumarDias(dia, -90);
    const [pagos, asis, mems, alumnos] = await Promise.all([
      db.pagos.where('fecha').aboveOrEqual(desde).toArray(),
      db.asistencias.where('fecha').aboveOrEqual(desde).toArray(),
      db.membresias.where('fin').aboveOrEqual(dia).toArray(),
      db.alumnos.toArray(),
    ]);
    return { pagos, asis, mems, alumnos };
  }, [dia]);

  const r = useMemo(() => {
    if (!datos) return null;
    const altas = datos.alumnos.filter((a) => !a.deletedAt).map((a) => aFecha(new Date(a.createdAt)));
    const porId = new Map(datos.alumnos.map((a) => [a.id, a]));
    const filas = porClase(actual, clases, datos.asis, datos.pagos);
    const maestro = new Map<string, { nombre: string; alumnos: number; sesiones: number; ingresos: number; clases: string[] }>();
    for (const f of filas) {
      const m = maestros.find((x) => x.id === f.clase.maestroId);
      const k = m?.id ?? 'sin';
      const v = maestro.get(k) ?? { nombre: m?.nombre ?? 'Sin maestro asignado', alumnos: 0, sesiones: 0, ingresos: 0, clases: [] };
      v.alumnos += Math.round(f.promedio * f.sesiones);
      v.sesiones += f.sesiones;
      v.ingresos += f.ingresos;
      if (!v.clases.includes(nombreClase(f.clase, disciplinas))) v.clases.push(nombreClase(f.clase, disciplinas));
      maestro.set(k, v);
    }
    return {
      ahora: indicadores(actual, datos.pagos, datos.asis, altas),
      antes: indicadores(anterior, datos.pagos, datos.asis, altas),
      dias: ingresosPorDia(actual, datos.pagos),
      clases: filas,
      maestros: [...maestro.values()].sort((a, b) => b.alumnos - a.alumnos),
      vencen: vencenPronto(datos.mems, porId, dia),
      perdidos: dejaronDeVenir(datos.asis, porId, dia),
    };
  }, [datos, actual, anterior, clases, maestros, disciplinas, dia]);

  if (!r) return null;
  const etiquetaAntes = rango === 7 ? 'vs 7 días previos' : 'vs 30 días previos';
  const maxProm = Math.max(1, ...r.clases.map((f) => f.promedio));

  return (
    <div className="px-4 pb-8">
      <div className="-mx-4 flex flex-wrap items-end justify-between gap-3 lg:mx-0">
        <Encabezado titulo="Reportes" sub={`${fechaCorta(actual.desde)} – ${fechaCorta(actual.hasta)}`} />
        <div className="w-full px-4 pb-3 sm:w-64 lg:px-0">
          <Segmentos<string>
            opciones={[
              { valor: '7', texto: 'Últimos 7 días' },
              { valor: '30', texto: '30 días' },
            ]}
            valor={String(rango)}
            onChange={(v) => setRango(Number(v) as Rango)}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4 lg:gap-3">
        <Cifra titulo="Ingresos" valor={dinero(r.ahora.ingresos)} cambio={variacion(r.ahora.ingresos, r.antes.ingresos)} pie={etiquetaAntes} destacada />
        <Cifra titulo="Asistencias" valor={r.ahora.asistencias.toLocaleString('es-MX')} cambio={variacion(r.ahora.asistencias, r.antes.asistencias)} pie={etiquetaAntes} />
        <Cifra titulo="Alumnos que vinieron" valor={r.ahora.activos.toLocaleString('es-MX')} cambio={variacion(r.ahora.activos, r.antes.activos)} pie={etiquetaAntes} />
        <Cifra titulo="Alumnos nuevos" valor={r.ahora.nuevos.toLocaleString('es-MX')} cambio={variacion(r.ahora.nuevos, r.antes.nuevos)} pie={etiquetaAntes} />
      </div>

      <Seccion titulo="Ingresos por día">
        <Tarjeta className="p-4">
          <GraficaBarras datos={r.dias} />
        </Tarjeta>
      </Seccion>

      <div className="lg:grid lg:grid-cols-2 lg:gap-6">
        <Seccion titulo="Por clase · alumnos por sesión">
          {r.clases.length === 0 ? (
            <Tarjeta className="p-4 text-sm text-ink-500">Sin clases en este periodo.</Tarjeta>
          ) : (
            <Tarjeta className="divide-y divide-ink-100">
              {r.clases.map((f) => (
                <div key={f.clase.id} className="px-4 py-3">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-semibold">
                      {nombreClase(f.clase, disciplinas)} <span className="text-xs font-normal text-ink-500">{f.clase.horaInicio}</span>
                    </span>
                    <span className="text-sm">
                      <b className="text-base">{f.promedio.toFixed(0)}</b> <span className="text-ink-500">prom · máx {f.maximo}</span>
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 rounded-full bg-ink-100">
                    <div className="h-full rounded-full" style={{ width: `${(f.promedio / maxProm) * 100}%`, background: colorClase(f.clase, disciplinas) }} />
                  </div>
                  <p className="mt-1 text-xs text-ink-500">
                    {f.sesiones} sesiones · {dinero(f.ingresos)} por clase suelta
                  </p>
                </div>
              ))}
            </Tarjeta>
          )}
        </Seccion>

        <Seccion titulo="Por maestro">
          {r.maestros.length === 0 ? (
            <Tarjeta className="p-4 text-sm text-ink-500">Sin datos en este periodo.</Tarjeta>
          ) : (
            <Tarjeta className="divide-y divide-ink-100">
              {r.maestros.map((m) => (
                <div key={m.nombre} className="flex items-center gap-3 px-4 py-3">
                  <Avatar nombre={m.nombre} tam={36} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{m.nombre}</span>
                    <span className="block truncate text-xs text-ink-500">
                      {m.sesiones} sesiones · {m.alumnos} asistencias · {m.clases.join(', ')}
                    </span>
                  </span>
                  <span className="text-right">
                    <span className="block font-bold">{dinero(m.ingresos)}</span>
                    <span className="block text-[11px] text-ink-500">por clase</span>
                  </span>
                </div>
              ))}
            </Tarjeta>
          )}
        </Seccion>
      </div>

      <div className="lg:grid lg:grid-cols-2 lg:gap-6">
        <Seccion titulo={`Vencen esta semana · ${r.vencen.length}`}>
          {r.vencen.length === 0 ? (
            <Tarjeta>
              <Vacio icono={<CalendarClock size={32} />} titulo="Nadie vence en los próximos 7 días" />
            </Tarjeta>
          ) : (
            <Tarjeta className="divide-y divide-ink-100">
              {r.vencen.map(({ alumno, membresia, enDias }) => (
                <FilaContacto
                  key={membresia.id}
                  alumnoId={alumno.id}
                  nombre={alumno.nombre}
                  detalle={`${planes.find((p) => p.id === membresia.planId)?.nombre ?? 'Plan'} · ${fechaCorta(membresia.fin)}`}
                  etiqueta={<Etiqueta tono="pronto">{textoDias(enDias)}</Etiqueta>}
                  wa={waLink(alumno.telefono, armarMensaje(plantilla(academia, 'vence'), { nombre: alumno.nombre.split(' ')[0], academia: academia.nombre, plan: (planes.find((p) => p.id === membresia.planId)?.nombre ?? 'plan').toLowerCase(), vence: fechaLarga(membresia.fin) }))}
                />
              ))}
            </Tarjeta>
          )}
        </Seccion>

        <Seccion titulo={`Dejaron de venir · ${r.perdidos.length}`}>
          {r.perdidos.length === 0 ? (
            <Tarjeta>
              <Vacio icono={<HeartCrack size={32} />} titulo="Nadie ha dejado de venir" texto="Aquí aparecen quienes venían seguido y llevan 2 semanas sin venir." />
            </Tarjeta>
          ) : (
            <Tarjeta className="divide-y divide-ink-100">
              {r.perdidos.slice(0, 30).map(({ alumno, ultima, veces }) => (
                <FilaContacto
                  key={alumno.id}
                  alumnoId={alumno.id}
                  nombre={alumno.nombre}
                  detalle={`Última vez ${fechaCorta(ultima)} · venía ${veces} veces`}
                  wa={waLink(alumno.telefono, armarMensaje(plantilla(academia, 'extrañamos'), { nombre: alumno.nombre.split(' ')[0], academia: academia.nombre }))}
                />
              ))}
            </Tarjeta>
          )}
        </Seccion>
      </div>
    </div>
  );
}

function Cifra({ titulo, valor, cambio, pie, destacada }: { titulo: string; valor: string; cambio: number | null; pie: string; destacada?: boolean }) {
  const sube = (cambio ?? 0) >= 0;
  const Flecha = sube ? ArrowUpRight : ArrowDownRight;
  return (
    <div className={cx('rounded-2xl p-4', destacada ? 'bg-panel text-white' : 'bg-superficie ring-1 ring-ink-100')}>
      <p className={cx('text-xs font-semibold', destacada ? 'text-white/60' : 'text-ink-500')}>{titulo}</p>
      <p className="mt-1 text-2xl font-extrabold tracking-tight lg:text-3xl">{valor}</p>
      <p className={cx('mt-1 flex items-center gap-0.5 text-xs', destacada ? 'text-white/70' : 'text-ink-500')}>
        {cambio === null ? (
          'Sin periodo previo'
        ) : (
          <>
            <Flecha size={14} className={sube ? (destacada ? 'text-[#7ee2a8]' : 'text-ok-600') : destacada ? 'text-[#ff9b9b]' : 'text-bad-600'} />
            <b className={destacada ? 'text-white' : 'text-ink-700'}>{Math.abs(cambio * 100).toFixed(0)}%</b>&nbsp;{pie}
          </>
        )}
      </p>
    </div>
  );
}

function FilaContacto({ alumnoId, nombre, detalle, etiqueta, wa }: { alumnoId: string; nombre: string; detalle: string; etiqueta?: React.ReactNode; wa: string | null }) {
  return (
    <div className="flex items-center gap-3 px-3 py-2.5">
      <Link to={`/alumnos/${alumnoId}`} className="flex min-w-0 flex-1 items-center gap-3">
        <Avatar nombre={nombre} tam={36} />
        <span className="min-w-0">
          <span className="block truncate font-semibold">{nombre}</span>
          <span className="block truncate text-xs text-ink-500">{detalle}</span>
        </span>
      </Link>
      {etiqueta}
      {wa ? (
        <a href={wa} target="_blank" rel="noreferrer" className="rounded-full bg-ok-50 p-2 text-ok-600" aria-label={`WhatsApp a ${nombre}`}>
          <MessageCircle size={18} />
        </a>
      ) : (
        <span className="w-[34px]" />
      )}
    </div>
  );
}
