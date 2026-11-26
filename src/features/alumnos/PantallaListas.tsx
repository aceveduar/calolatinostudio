import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowLeft, ChevronDown, ChevronLeft, ChevronRight, MessageCircle } from 'lucide-react';
import { nombreClase, useClases, useDisciplinas, usePlanes } from '../../app/datos';
import { mismaSede, nombreSede, useSedeActual, useSedes } from '../../app/sedes';
import { useSesion } from '../../app/sesion';
import { Cargando, Selector, Tarjeta, Vacio, cx } from '../../components/ui';
import { db } from '../../db/db';
import type { Fecha, ID } from '../../db/types';
import { listaDelMes, sesionesDelMes, type Marca } from '../../domain/adeudos';
import { dinero } from '../../domain/dinero';
import { DIAS_CORTOS, deFecha, fechaCorta, fechaLarga, hoy } from '../../domain/fechas';
import { mesDe, nombreMes, rangoMes, sumarMes } from '../../domain/gastos';
import { armarMensaje, plantilla } from '../../domain/mensajes';
import { waLink } from '../../domain/reportes';

const MARCA: Record<Marca, { txt: string; cls: string; titulo: string; leyenda: string }> = {
  plan: { txt: '✓', cls: 'bg-ok-50 text-ok-600', titulo: 'Vino con su plan', leyenda: 'Plan' },
  pagada: { txt: '$', cls: 'bg-ink-100 text-ink-700', titulo: 'Vino y pagó la clase', leyenda: 'Pagó clase' },
  beca: { txt: '★', cls: 'bg-brand-50 text-brand-600', titulo: 'Vino con beca', leyenda: 'Beca' },
  debe: { txt: '!', cls: 'bg-bad-50 text-bad-600', titulo: 'Vino y debe la clase', leyenda: 'Adeudo' },
};

/**
 * La libreta de Monse: por grupo y por mes, quién vino cada día, cómo pagó y quién debe.
 * Toca un nombre para ir a su ficha (cobrar, vender plan); el botón de WhatsApp le recuerda lo que debe.
 */
export function PantallaListas() {
  const { academia, esDueno } = useSesion();
  const [sedeActual] = useSedeActual();
  const sedes = useSedes();
  const disciplinas = useDisciplinas();
  const planes = usePlanes();
  const todas = useClases();
  // Recepción ve las clases de su sede; la dirección, todas
  const clases = useMemo(
    () => todas.filter((c) => c.activo && (esDueno || mismaSede(c.sedeId, sedeActual))).sort((a, b) => nombreClase(a, disciplinas).localeCompare(nombreClase(b, disciplinas)) || a.horaInicio.localeCompare(b.horaInicio)),
    [todas, esDueno, sedeActual, disciplinas],
  );
  const [claseId, setClaseId] = useState<ID | null>(null);
  const [soloAdeudos, setSoloAdeudos] = useState(false);
  const clase = clases.find((c) => c.id === claseId) ?? clases.find((c) => c.dias.includes(deFecha(hoy()).getDay())) ?? clases[0];
  const [mes, setMes] = useState(mesDe(hoy()));
  const { desde, hasta } = rangoMes(mes);
  const dia = hoy();

  const consulta = useLiveQuery(async () => {
    if (!clase) return null;
    const [asistencias, membresias] = await Promise.all([
      db.asistencias.where('[claseId+fecha]').between([clase.id, desde], [clase.id, hasta], true, true).toArray(),
      db.membresias.where('fin').aboveOrEqual(desde).toArray(),
    ]);
    const filas = listaDelMes({ clase, mes, asistencias, membresias, planes });
    const alumnos = await db.alumnos.bulkGet(filas.map((f) => f.alumnoId));
    const lista = filas
      .map((f, i) => ({ ...f, alumno: alumnos[i] }))
      .filter((f) => f.alumno && !f.alumno.deletedAt)
      .sort((a, b) => a.alumno!.nombre.localeCompare(b.alumno!.nombre));
    return { claseId: clase.id, mes, lista };
  }, [clase, mes, desde, hasta, planes]);

  const sesiones = clase ? sesionesDelMes(clase, mes) : [];
  const datos = consulta && consulta.claseId === clase?.id && consulta.mes === mes ? consulta.lista : undefined;
  const deben = (datos ?? []).filter((f) => f.debe > 0);
  const filasVisibles = soloAdeudos ? deben : datos;
  const totalDebe = deben.reduce((s, f) => s + f.debe, 0);
  const esMesActual = mes === mesDe(dia);
  const cambiarMes = (nuevoMes: typeof mes) => {
    setSoloAdeudos(false);
    setMes(nuevoMes);
  };

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
          <div className="relative mb-3 max-w-full sm:w-fit">
            <Selector aria-label="Clase de la lista" value={clase?.id ?? ''} onChange={(e) => {
              setSoloAdeudos(false);
              setClaseId(e.target.value);
            }} className="h-11 pr-9 pl-3 font-semibold text-brand-600">
              {clases.map((c) => (
                <option key={c.id} value={c.id}>
                  {nombreClase(c, disciplinas)} · {c.horaInicio}{esDueno && sedes.length > 0 ? ` · ${nombreSede(c.sedeId, sedes, academia)}` : ''}
                </option>
              ))}
            </Selector>
            <ChevronDown size={16} className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-brand-600" aria-hidden="true" />
          </div>

          <div className="mb-3 flex items-center justify-between rounded-2xl bg-superficie p-1 ring-1 ring-ink-100">
            <button className="rounded-xl p-2.5 active:bg-ink-100" onClick={() => cambiarMes(sumarMes(mes, -1))} aria-label="Mes anterior">
              <ChevronLeft />
            </button>
            <button className="rounded-xl px-4 py-2.5 font-semibold disabled:text-ink-900" disabled={esMesActual} onClick={() => cambiarMes(mesDe(dia))}>
              {nombreMes(mes)}
              {!esMesActual && <span className="ml-2 text-sm text-brand-600">Este mes</span>}
            </button>
            <button className="rounded-xl p-2.5 active:bg-ink-100 disabled:opacity-30" disabled={esMesActual} onClick={() => cambiarMes(sumarMes(mes, 1))} aria-label="Mes siguiente">
              <ChevronRight />
            </button>
          </div>

          {datos && (
            <div className="mb-2 flex flex-wrap items-center justify-between gap-x-3 px-1 text-sm text-ink-500">
              <p>
                <b className="text-ink-900">{datos.length}</b> {datos.length === 1 ? 'alumno' : 'alumnos'}
                {deben.length > 0 && <span className="text-bad-600"> · {deben.length} {deben.length === 1 ? 'debe' : 'deben'} <b>{dinero(totalDebe)}</b></span>}
              </p>
              {(deben.length > 0 || soloAdeudos) && (
                <label className="flex min-h-11 cursor-pointer items-center gap-2 font-semibold text-ink-700">
                  <input type="checkbox" className="size-4 accent-brand-600" checked={soloAdeudos} onChange={(e) => setSoloAdeudos(e.target.checked)} />
                  Solo adeudos
                </label>
              )}
            </div>
          )}

          {!filasVisibles ? <Cargando texto="Cargando la lista…" /> : filasVisibles.length === 0 ? (
            <Tarjeta>
              {soloAdeudos ? <Vacio titulo="Sin adeudos en esta lista" /> : <Vacio titulo="Nadie en esta lista este mes" texto="Aquí aparece quien viene a la clase o pagó un plan para ella." />}
            </Tarjeta>
          ) : (
            <>
              <ul aria-label="Marcas de asistencia" className="mb-2 flex flex-wrap gap-x-3 gap-y-1 px-1 text-xs text-ink-600">
                {(Object.keys(MARCA) as Marca[]).map((k) => (
                  <li key={k} className="inline-flex items-center gap-1">
                    <span aria-hidden="true" className={cx('inline-flex size-5 items-center justify-center rounded-md font-extrabold', MARCA[k].cls)}>{MARCA[k].txt}</span>
                    {MARCA[k].leyenda}
                  </li>
                ))}
              </ul>
              {sesiones.length > 5 && <p className="mb-2 px-1 text-xs text-ink-500 sm:hidden">Desliza la tabla para ver más fechas.</p>}
              <Tarjeta className="overflow-x-auto">
                <table aria-label="Asistencia del mes" className="w-full border-separate border-spacing-0 text-sm">
                  <thead>
                    <tr>
                      <th className="sticky left-0 z-10 min-w-36 bg-superficie px-3 py-2 text-left text-xs font-bold text-ink-500">Alumno</th>
                      {sesiones.map((f) => (
                        <th key={f} scope="col" aria-label={fechaLarga(f)} aria-current={f === dia ? 'date' : undefined} className={cx('px-1 py-2 text-center text-xs font-semibold', f === dia ? 'bg-brand-50 text-brand-600' : 'text-ink-500', f > dia && 'opacity-40')}>
                          <span className="block text-[10px] font-normal">{DIAS_CORTOS[deFecha(f).getDay()][0]}</span>
                          {deFecha(f).getDate()}
                        </th>
                      ))}
                      <th className="hidden px-3 py-2 text-right text-xs font-bold text-ink-500 sm:table-cell">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filasVisibles.map((f) => {
                      const a = f.alumno!;
                      const wa = f.debe > 0 ? waLink(a.telefono, armarMensaje(plantilla(academia, 'adeudo'), { nombre: a.nombre.split(' ')[0], academia: academia.nombre, monto: dinero(f.debe) })) : null;
                      const estado =
                        f.debe > 0 ? (
                          <span className="inline-flex items-center gap-1.5">
                            <Link to={`/alumnos/${a.id}#adeudos`} aria-label={`Ver adeudo de ${a.nombre}: ${dinero(f.debe)}`} className="rounded-sm font-bold text-bad-600 underline underline-offset-2">Debe {dinero(f.debe)}</Link>
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
                        );
                      return (
                        <tr key={f.alumnoId} className="group">
                          <td className="sticky left-0 z-10 border-t border-ink-100 bg-superficie px-3 py-2">
                            <Link to={`/alumnos/${a.id}`} className="-my-2 block max-w-40 break-words py-2.5 font-semibold">
                              {a.nombre}
                            </Link>
                            {/* en el celular, el estado va aquí: la columna de la derecha quedaba cortada */}
                            <span className="-mt-1.5 block pb-0.5 sm:hidden">{estado}</span>
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
                          <td className="hidden border-t border-ink-100 px-3 py-1.5 text-right whitespace-nowrap sm:table-cell">{estado}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </Tarjeta>
            </>
          )}
        </>
      )}
    </div>
  );
}
