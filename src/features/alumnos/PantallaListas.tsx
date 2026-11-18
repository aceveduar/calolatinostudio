import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowLeft, ChevronLeft, ChevronRight, MessageCircle } from 'lucide-react';
import { colorClase, nombreClase, useClases, useDisciplinas, usePlanes } from '../../app/datos';
import { mismaSede, useSedeActual } from '../../app/sedes';
import { useSesion } from '../../app/sesion';
import { Tarjeta, Vacio, cx } from '../../components/ui';
import { db } from '../../db/db';
import type { Fecha, ID } from '../../db/types';
import { listaDelMes, sesionesDelMes, type Marca } from '../../domain/adeudos';
import { dinero } from '../../domain/dinero';
import { DIAS_CORTOS, deFecha, fechaCorta, hoy } from '../../domain/fechas';
import { mesDe, nombreMes, rangoMes, sumarMes } from '../../domain/gastos';
import { armarMensaje, plantilla } from '../../domain/mensajes';
import { waLink } from '../../domain/reportes';

const MARCA: Record<Marca, { txt: string; cls: string; titulo: string }> = {
  plan: { txt: '✓', cls: 'bg-ok-50 text-ok-600', titulo: 'Vino con su plan' },
  pagada: { txt: '$', cls: 'bg-ink-100 text-ink-700', titulo: 'Vino y pagó la clase' },
  beca: { txt: '★', cls: 'bg-brand-50 text-brand-600', titulo: 'Vino con beca' },
  debe: { txt: '!', cls: 'bg-bad-50 text-bad-600', titulo: 'Vino y debe la clase' },
};

/**
 * La libreta de Monse: por grupo y por mes, quién vino cada día, cómo pagó y quién debe.
 * Toca un nombre para ir a su ficha (cobrar, vender plan); el botón de WhatsApp le recuerda lo que debe.
 */
export function PantallaListas() {
  const { academia, esDueno } = useSesion();
  const [sedeActual] = useSedeActual();
  const disciplinas = useDisciplinas();
  const planes = usePlanes();
  const todas = useClases();
  // Recepción ve las clases de su sede; la dirección, todas
  const clases = useMemo(
    () => todas.filter((c) => c.activo && (esDueno || mismaSede(c.sedeId, sedeActual))).sort((a, b) => nombreClase(a, disciplinas).localeCompare(nombreClase(b, disciplinas)) || a.horaInicio.localeCompare(b.horaInicio)),
    [todas, esDueno, sedeActual, disciplinas],
  );
  const [claseId, setClaseId] = useState<ID | null>(null);
  const clase = clases.find((c) => c.id === claseId) ?? clases.find((c) => c.dias.includes(deFecha(hoy()).getDay())) ?? clases[0];
  const [mes, setMes] = useState(mesDe(hoy()));
  const { desde, hasta } = rangoMes(mes);
  const dia = hoy();

  const datos = useLiveQuery(async () => {
    if (!clase) return null;
    const [asistencias, membresias] = await Promise.all([
      db.asistencias.where('fecha').between(desde, hasta, true, true).filter((a) => a.claseId === clase.id).toArray(),
      db.membresias.where('fin').aboveOrEqual(desde).toArray(),
    ]);
    const filas = listaDelMes({ clase, mes, asistencias, membresias, planes });
    const alumnos = await db.alumnos.bulkGet(filas.map((f) => f.alumnoId));
    return filas
      .map((f, i) => ({ ...f, alumno: alumnos[i] }))
      .filter((f) => f.alumno && !f.alumno.deletedAt)
      .sort((a, b) => a.alumno!.nombre.localeCompare(b.alumno!.nombre));
  }, [clase?.id, mes, desde, hasta, planes]);

  const sesiones = clase ? sesionesDelMes(clase, mes) : [];
  const deben = (datos ?? []).filter((f) => f.debe > 0);
  const totalDebe = deben.reduce((s, f) => s + f.debe, 0);
  const esMesActual = mes === mesDe(dia);

  return (
    <div className="px-4 pb-8">
      <div className="flex items-center gap-2 pt-4 pb-3">
        <Link to="/alumnos" className="-ml-2.5 rounded-full p-2.5 active:bg-ink-100" aria-label="Volver a alumnos">
          <ArrowLeft size={22} />
        </Link>
        <h1 className="flex-1 text-2xl font-extrabold tracking-tight">Listas del mes</h1>
      </div>

      {clases.length === 0 ? (
        <Vacio titulo="Aún no hay clases" texto="Agrégalas en Ajustes → Clases." />
      ) : (
        <>
          <div className="no-scrollbar -mx-4 mb-3 flex gap-2 overflow-x-auto px-4 lg:mx-0 lg:flex-wrap lg:px-0">
            {clases.map((c) => (
              <button
                key={c.id}
                onClick={() => setClaseId(c.id)}
                className={cx('flex shrink-0 items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold ring-1', clase?.id === c.id ? 'bg-panel text-white ring-panel' : 'bg-superficie ring-ink-100')}
              >
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: colorClase(c, disciplinas) }} />
                {nombreClase(c, disciplinas)}
                <span className={cx('text-xs font-normal', clase?.id === c.id ? 'text-white/70' : 'text-ink-500')}>{c.horaInicio}</span>
              </button>
            ))}
          </div>

          <div className="mb-3 flex items-center justify-between rounded-2xl bg-superficie p-1 ring-1 ring-ink-100">
            <button className="rounded-xl p-2.5 active:bg-ink-100" onClick={() => setMes(sumarMes(mes, -1))} aria-label="Mes anterior">
              <ChevronLeft />
            </button>
            <button className="rounded-xl px-4 py-2.5 font-semibold disabled:text-ink-900" disabled={esMesActual} onClick={() => setMes(mesDe(dia))}>
              {nombreMes(mes)}
              {!esMesActual && <span className="ml-2 text-sm text-brand-600">Este mes</span>}
            </button>
            <button className="rounded-xl p-2.5 active:bg-ink-100 disabled:opacity-30" disabled={esMesActual} onClick={() => setMes(sumarMes(mes, 1))} aria-label="Mes siguiente">
              <ChevronRight />
            </button>
          </div>

          {datos && (
            <p className="mb-2 px-1 text-sm text-ink-500">
              <b className="text-ink-900">{datos.length}</b> alumnos
              {deben.length > 0 && (
                <>
                  {' '}· <b className="text-bad-600">{deben.length}</b> {deben.length === 1 ? 'debe' : 'deben'} <b className="text-bad-600">{dinero(totalDebe)}</b>
                </>
              )}
            </p>
          )}

          {!datos || datos.length === 0 ? (
            <Tarjeta>
              <Vacio titulo="Nadie en esta lista este mes" texto="Aquí aparece quien viene a la clase o pagó un plan para ella." />
            </Tarjeta>
          ) : (
            <Tarjeta className="overflow-x-auto">
              <table className="w-full border-separate border-spacing-0 text-sm">
                <thead>
                  <tr>
                    <th className="sticky left-0 z-10 min-w-36 bg-superficie px-3 py-2 text-left text-xs font-bold text-ink-500">Alumno</th>
                    {sesiones.map((f) => (
                      <th key={f} className={cx('px-1 py-2 text-center text-xs font-semibold', f === dia ? 'text-brand-600' : 'text-ink-500', f > dia && 'opacity-40')}>
                        <span className="block text-[10px] font-normal">{DIAS_CORTOS[deFecha(f).getDay()][0]}</span>
                        {deFecha(f).getDate()}
                      </th>
                    ))}
                    <th className="px-3 py-2 text-right text-xs font-bold text-ink-500">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {datos.map((f) => {
                    const a = f.alumno!;
                    const wa = f.debe > 0 ? waLink(a.telefono, armarMensaje(plantilla(academia, 'adeudo'), { nombre: a.nombre.split(' ')[0], academia: academia.nombre, monto: dinero(f.debe) })) : null;
                    return (
                      <tr key={f.alumnoId} className="group">
                        <td className="sticky left-0 z-10 border-t border-ink-100 bg-superficie px-3 py-2">
                          <Link to={`/alumnos/${a.id}`} className="-my-2 block max-w-40 truncate py-2.5 font-semibold">
                            {a.nombre}
                          </Link>
                        </td>
                        {sesiones.map((s: Fecha) => {
                          const m = f.marcas.get(s);
                          return (
                            <td key={s} className="border-t border-ink-100 px-0.5 py-1.5 text-center">
                              {m ? (
                                <span title={MARCA[m].titulo} aria-label={MARCA[m].titulo} className={cx('inline-flex h-7 w-7 items-center justify-center rounded-lg text-xs font-extrabold', MARCA[m].cls)}>
                                  {MARCA[m].txt}
                                </span>
                              ) : (
                                <span className={cx('text-ink-300', s > dia && 'opacity-40')}>·</span>
                              )}
                            </td>
                          );
                        })}
                        <td className="border-t border-ink-100 px-3 py-1.5 text-right whitespace-nowrap">
                          {f.debe > 0 ? (
                            <span className="inline-flex items-center gap-1.5">
                              <span className="font-bold text-bad-600">Debe {dinero(f.debe)}</span>
                              {wa && (
                                <a href={wa} target="_blank" rel="noreferrer" className="rounded-full bg-ok-50 p-1.5 text-ok-600" aria-label={`Recordarle a ${a.nombre} lo que debe`}>
                                  <MessageCircle size={16} />
                                </a>
                              )}
                            </span>
                          ) : f.plan ? (
                            <span className="text-xs text-ok-600">Plan hasta {fechaCorta(f.plan.fin)}</span>
                          ) : (
                            <span className="text-xs text-ink-500">Por clase</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Tarjeta>
          )}
          <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 px-1 text-xs text-ink-500">
            {(Object.keys(MARCA) as Marca[]).map((k) => (
              <span key={k} className="inline-flex items-center gap-1.5">
                <span className={cx('inline-flex h-5 w-5 items-center justify-center rounded-md text-[10px] font-extrabold', MARCA[k].cls)}>{MARCA[k].txt}</span>
                {MARCA[k].titulo}
              </span>
            ))}
          </p>
        </>
      )}
    </div>
  );
}
