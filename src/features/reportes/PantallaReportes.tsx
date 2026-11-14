import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowDownRight, ArrowUpRight, CalendarClock, GraduationCap, HeartCrack, MessageCircle } from 'lucide-react';
import { colorClase, nombreClase, useClases, useDisciplinas, useMaestros, usePlanes } from '../../app/datos';
import { useSesion } from '../../app/sesion';
import { nombreSede, useSedes } from '../../app/sedes';
import { PRINCIPAL, claveSede, sirveEn } from '../../domain/sedes';
import { Avatar, Encabezado, Etiqueta, Seccion, Segmentos, Tarjeta, Vacio, cx } from '../../components/ui';
import { db } from '../../db/db';
import { dinero } from '../../domain/dinero';
import { aFecha, diasEntre, fechaCorta, fechaLarga, hoy, sumarDias } from '../../domain/fechas';
import { textoDias } from '../../domain/membresias';
import { dejaronDeVenir, indicadores, ingresosPorDia, periodos, porClase, variacion, vencenPronto, waLink } from '../../domain/reportes';
import { GraficaBarras } from './GraficaBarras';
import { armarMensaje, plantilla } from '../../domain/mensajes';
import { esBeca, resumenBecas } from '../../domain/becas';

type Rango = 7 | 30;

export function PantallaReportes() {
  const { academia } = useSesion();
  const clases = useClases();
  const disciplinas = useDisciplinas();
  const maestros = useMaestros();
  const planes = usePlanes();
  const [rango, setRango] = useState<Rango>(7);
  const sedes = useSedes();
  // 'todas' | PRINCIPAL | id
  const [verSede, setVerSede] = useState<string>('todas');
  const dia = hoy();
  const { actual, anterior } = periodos(rango, dia);

  const datos = useLiveQuery(async () => {
    const desde = sumarDias(dia, -90);
    const [pagos, asis, mems, alumnos] = await Promise.all([
      db.pagos.where('fecha').aboveOrEqual(desde).toArray(),
      db.asistencias.where('fecha').aboveOrEqual(desde).toArray(),
      db.membresias.where('fin').aboveOrEqual(desde).toArray(),
      db.alumnos.toArray(),
    ]);
    return { pagos, asis, mems, alumnos };
  }, [dia]);

  const r = useMemo(() => {
    if (!datos) return null;
    const enSede = (sedeId: string | null | undefined) => verSede === 'todas' || claveSede(sedeId) === verSede;
    const sedeDeClase = new Map(clases.map((c) => [c.id, c.sedeId]));
    const pagosS = datos.pagos.filter((p) => enSede(p.sedeId));
    const asisS = datos.asis.filter((a) => enSede(sedeDeClase.get(a.claseId)));
    const clasesS = clases.filter((c) => enSede(c.sedeId));
    const altas = datos.alumnos.filter((a) => !a.deletedAt).map((a) => aFecha(new Date(a.createdAt)));
    const porId = new Map(datos.alumnos.map((a) => [a.id, a]));
    const filas = porClase(actual, clasesS, asisS, pagosS);
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
      ahora: indicadores(actual, pagosS, asisS, altas),
      antes: indicadores(anterior, pagosS, asisS, altas),
      dias: ingresosPorDia(actual, pagosS),
      porSede: [PRINCIPAL, ...sedes.map((x) => x.id)].map((id) => {
        const ps = datos.pagos.filter((p) => claveSede(p.sedeId) === id && !p.anuladoAt && !p.deletedAt && p.fecha >= actual.desde && p.fecha <= actual.hasta);
        return { id, ingresos: ps.reduce((t, p) => t + p.monto, 0), tienda: ps.filter((p) => p.productoId).reduce((t, p) => t + p.monto, 0) };
      }),
      clases: filas,
      maestros: [...maestro.values()].sort((a, b) => b.alumnos - a.alumnos),
      // las becas no se cobran: no van en "vencen" (el mensaje pide renovar pagando)
      vencen: vencenPronto(datos.mems.filter((m) => !esBeca(planes.find((p) => p.id === m.planId))), porId, dia),
      becas: planes.some(esBeca) ? resumenBecas({ desde: actual.desde, hasta: actual.hasta, hoy: dia, planes, mems: datos.mems.filter((m) => verSede === 'todas' || sirveEn(m.sedeId, verSede === PRINCIPAL ? null : verSede)), asis: asisS, clases }) : null,
      porId,
      perdidos: dejaronDeVenir(asisS, porId, dia),
    };
  }, [datos, actual, anterior, clases, maestros, disciplinas, dia, verSede, sedes, planes]);

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

      {sedes.length > 0 && (
        <div className="no-scrollbar -mx-4 mb-3 flex gap-2 overflow-x-auto px-4 lg:mx-0 lg:px-0">
          {['todas', PRINCIPAL, ...sedes.map((x) => x.id)].map((id) => (
            <button
              key={id}
              onClick={() => setVerSede(id)}
              className={cx('shrink-0 rounded-full px-4 py-2 text-sm font-semibold ring-1', verSede === id ? 'bg-brand-500 text-white ring-brand-500' : 'bg-superficie ring-ink-100')}
            >
              {id === 'todas' ? 'Todas las sedes' : nombreSede(id === PRINCIPAL ? null : id, sedes, academia)}
            </button>
          ))}
        </div>
      )}
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4 lg:gap-3">
        <Cifra titulo="Ingresos" valor={dinero(r.ahora.ingresos)} cambio={variacion(r.ahora.ingresos, r.antes.ingresos)} pie={etiquetaAntes} destacada />
        <Cifra titulo="Asistencias" valor={r.ahora.asistencias.toLocaleString('es-MX')} cambio={variacion(r.ahora.asistencias, r.antes.asistencias)} pie={etiquetaAntes} />
        <Cifra titulo="Alumnos que vinieron" valor={r.ahora.activos.toLocaleString('es-MX')} cambio={variacion(r.ahora.activos, r.antes.activos)} pie={etiquetaAntes} />
        <Cifra titulo="Alumnos nuevos" valor={r.ahora.nuevos.toLocaleString('es-MX')} cambio={variacion(r.ahora.nuevos, r.antes.nuevos)} pie={etiquetaAntes} />
      </div>

      {sedes.length > 0 && verSede === 'todas' && (
        <Seccion titulo="Por sede">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {r.porSede.map((x) => {
              const total = r.porSede.reduce((t, y) => t + y.ingresos, 0) || 1;
              const sede = sedes.find((y) => y.id === x.id);
              return (
                <Tarjeta key={x.id} className="p-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex min-w-0 items-center gap-2 font-semibold">
                      <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: sede?.color ?? 'var(--marca)' }} />
                      <span className="truncate">{nombreSede(x.id === PRINCIPAL ? null : x.id, sedes, academia)}</span>
                    </span>
                    <span className="text-lg font-extrabold">{dinero(x.ingresos)}</span>
                  </div>
                  <div className="mt-2 h-1.5 rounded-full bg-ink-100">
                    <div className="h-full rounded-full" style={{ width: `${(x.ingresos / total) * 100}%`, background: sede?.color ?? 'var(--marca)' }} />
                  </div>
                  <p className="mt-1 text-xs text-ink-500">
                    {Math.round((x.ingresos / total) * 100)}% del total{x.tienda ? ` · tienda ${dinero(x.tienda)}` : ''}
                  </p>
                </Tarjeta>
              );
            })}
          </div>
        </Seccion>
      )}

      {r.becas && (
        <Seccion titulo={`Becas · ${r.becas.activas.length} activas`}>
          <Tarjeta className="p-4">
            <div className="flex items-start gap-3">
              <span className="rounded-xl bg-ok-50 p-2 text-ok-600">
                <GraduationCap size={22} />
              </span>
              <p className="text-sm">
                <b className="text-base">{r.becas.asistencias.toLocaleString('es-MX')}</b> asistencias de becados en el periodo
                {r.becas.valor > 0 && (
                  <>
                    {' '}· equivalen a <b>{dinero(r.becas.valor)}</b> en clases sueltas
                  </>
                )}
                .
              </p>
            </div>
          </Tarjeta>
          {r.becas.activas.length > 0 && (
            <Tarjeta className="mt-2 divide-y divide-ink-100">
              {r.becas.activas.map(({ membresia, asistencias }) => {
                const alumno = r.porId.get(membresia.alumnoId);
                if (!alumno) return null;
                const dias = diasEntre(dia, membresia.fin);
                return (
                  <FilaContacto
                    key={membresia.id}
                    alumnoId={alumno.id}
                    nombre={alumno.nombre}
                    detalle={`${planes.find((p) => p.id === membresia.planId)?.nombre ?? 'Beca'} · hasta ${fechaCorta(membresia.fin)} · ${asistencias} ${asistencias === 1 ? 'clase' : 'clases'}`}
                    etiqueta={dias <= 14 ? <Etiqueta tono="pronto">{textoDias(dias)}</Etiqueta> : undefined}
                    wa={null}
                  />
                );
              })}
            </Tarjeta>
          )}
        </Seccion>
      )}

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
