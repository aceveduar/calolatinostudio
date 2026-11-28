import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowLeft, Brush, Check, ChevronDown, ChevronLeft, ChevronRight, Droplet, FileSpreadsheet, House, Lightbulb, Plus, Receipt, Repeat, Users, Wallet, Wifi } from 'lucide-react';
import { descargarArchivo } from '../../app/compartirImagen';
import { VENTANA_DIAS } from '../../sync/engine';
import { colorClase, nombreClase, nombreMaestro, useClases, useDisciplinas, useMaestros } from '../../app/datos';
import { rentabilidadPorClase } from '../../domain/rentabilidad';
import type { Maestro } from '../../db/types';
import { useSesion } from '../../app/sesion';
import { nombreSede, useSedes } from '../../app/sedes';
import { useAvisos } from '../../components/avisos';
import { Boton, Campo, Entrada, Hoja, Seccion, Segmentos, Selector, Tarjeta, Vacio, cx, Cargando } from '../../components/ui';
import { db } from '../../db/db';
import { actualizar, borrar, crear } from '../../db/repo';
import type { CategoriaGasto, Fecha, Gasto, GastoFijo, MetodoPago, Pago, Sede } from '../../db/types';
import { aCentavos, aPesosTexto, dinero } from '../../domain/dinero';
import { fechaCorta, hoy, sumarDias } from '../../domain/fechas';
import { CATEGORIAS, categoria, estadoFijos, mesDe, nombreMes, rangoMes, registrarGasto, resumenMes, sumarMes, type Mes } from '../../domain/gastos';
import { PRINCIPAL, claveSede, conSede } from '../../domain/sedes';
import { METODOS } from '../../domain/planes';

/** Borrador para el formulario: un gasto nuevo, uno de un gasto fijo, o uno existente. */
type Borrador = { gasto?: Gasto; fijo?: GastoFijo; fecha: Fecha };

export function PantallaGastos() {
  const { academia } = useSesion();
  const sedes = useSedes();
  const clases = useClases();
  const disciplinas = useDisciplinas();
  const maestros = useMaestros();
  const [mes, setMes] = useState<Mes>(mesDe(hoy()));
  const [verSede, setVerSede] = useState<string>('todas');
  const [borrador, setBorrador] = useState<Borrador | null>(null);
  const [fijos, setFijos] = useState(false);
  const { desde, hasta } = rangoMes(mes);
  const esMesActual = mes === mesDe(hoy());
  const avisar = useAvisos();
  const [exportando, setExportando] = useState(false);
  const { hash } = useLocation();
  const abrirPorClase = hash === '#por-clase';

  /** El mes en Excel (Resumen, Cobros, Gastos, Cortes), de la sede que se está viendo. En el celular se comparte (WhatsApp, correo); en PC se descarga. */
  async function exportar(pagos: Pago[], gastos: Gasto[]) {
    if (desde < sumarDias(hoy(), -VENTANA_DIAS)) {
      avisar('Ese mes es de hace más de 18 meses: este teléfono ya no lo tiene completo. Pídeselo a soporte.', 'error');
      return;
    }
    setExportando(true);
    try {
      const [{ hojasDelMes, nombreArchivoMes }, { crearXlsx }] = await Promise.all([import('../../domain/exportarMes'), import('../../app/xlsxEscribir')]);
      const enSede = (s: string | null | undefined) => verSede === 'todas' || claveSede(s) === verSede;
      const [cortes, usuarios] = await Promise.all([db.cortes.where('fecha').between(desde, hasta, true, true).toArray(), db.usuarios.toArray()]);
      const ids = [...new Set(pagos.flatMap((p) => (p.alumnoId ? [p.alumnoId] : [])))];
      const alumnos = new Map((await db.alumnos.bulkGet(ids)).flatMap((a) => (a ? [[a.id, a.nombre] as const] : [])));
      const quien = new Map(usuarios.map((u) => [u.id, u.nombre]));
      const hojas = hojasDelMes({
        academia: academia.nombre,
        mes,
        sede: verSede === 'todas' ? null : nombreSede(verSede === PRINCIPAL ? null : verSede, sedes, academia),
        pagos,
        gastos,
        cortes: cortes.filter((c) => enSede(c.sedeId)),
        nombres: {
          alumno: (id) => (id ? (alumnos.get(id) ?? '') : ''),
          usuario: (id) => quien.get(id) ?? '',
          sede: verSedes ? (id) => nombreSede(id, sedes, academia) : null,
        },
        generado: Date.now(),
      });
      const archivo = new File([crearXlsx(hojas)], nombreArchivoMes(academia.nombre, mes), { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      if (matchMedia('(pointer: coarse)').matches && navigator.canShare?.({ files: [archivo] })) {
        try {
          await navigator.share({ files: [archivo], title: archivo.name });
        } catch (e) {
          if ((e as Error).name !== 'AbortError') descargarArchivo(archivo);
        }
      } else {
        descargarArchivo(archivo);
        avisar(`Listo: ${archivo.name} está en tus descargas`);
      }
    } catch (e) {
      avisar(e instanceof Error ? e.message : 'No se pudo preparar el Excel', 'error');
    } finally {
      setExportando(false);
    }
  }

  const datos = useLiveQuery(async () => {
    const [pagos, gastos, fijos] = await Promise.all([
      db.pagos.where('fecha').between(desde, hasta, true, true).toArray(),
      db.gastos.where('fecha').between(desde, hasta, true, true).toArray(),
      db.gastosFijos.toArray(),
    ]);
    return { desde, pagos, gastos, fijos };
  }, [desde, hasta]);

  const baseRentabilidad = useLiveQuery(async () => {
    // para lo que deja cada clase: las entradas del mes y de antes (cuántas clases cubrió cada plan)
    // basta desde que empezó el plan más antiguo que aún cubre el mes: la vigencia más larga de los planes
    // con precio (las becas no reparten dinero). Leer de más eran decenas de miles de entradas extra.
    const planes = await db.planes.toArray();
    const vigenciaMax = Math.max(31, ...planes.filter((x) => x.precio > 0 && x.vigenciaDias).map((x) => x.vigenciaDias!));
    const inicioVentana = sumarDias(desde, -vigenciaMax);
    const [asistencias, rentas] = await Promise.all([db.asistencias.where('fecha').between(inicioVentana, hasta, true, true).toArray(), db.rentas.toArray()]);
    // planes y cobros de esas entradas, con lecturas por rango de fecha (una por tabla): pedirlos uno por uno
    // (bulkGet con decenas de miles de ids) tardaba varios segundos con una academia grande
    const memIds = new Set(asistencias.flatMap((a) => (a.membresiaId ? [a.membresiaId] : [])));
    const membresias = (await db.membresias.where('fin').aboveOrEqual(inicioVentana).toArray()).filter((m) => memIds.has(m.id));
    const pagoIds = new Set([...membresias.map((m) => m.pagoId), ...asistencias.flatMap((a) => (a.pagoId ? [a.pagoId] : []))]);
    const desdePagos = membresias.reduce((min, m) => (m.inicio < min ? m.inicio : min), inicioVentana);
    const pagosClase = (await db.pagos.where('fecha').between(desdePagos, hasta, true, true).toArray()).filter((x) => pagoIds.has(x.id));
    return { desde, asistencias, rentas, membresias, pagosClase };
  }, [desde, hasta]);

  // Los cálculos pesados (lo que deja cada clase recorre miles de entradas) solo cuando cambian sus datos,
  // no en cada redibujo de la pantalla.
  const calculo = useMemo(() => {
    if (!datos || datos.desde !== desde) return null;
    const enSede = (s: string | null | undefined) => verSede === 'todas' || claveSede(s) === verSede;
    const gastos = datos.gastos.filter((g) => !g.deletedAt && enSede(g.sedeId)).sort((a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : b.createdAt - a.createdAt));
    const fijosS = datos.fijos.filter((f) => enSede(f.sedeId));
    return { enSede, gastos, fijosS };
  }, [datos, desde, verSede]);
  const rent = useMemo(() => {
    if (!calculo || !baseRentabilidad || baseRentabilidad.desde !== desde) return null;
    return rentabilidadPorClase({
      mes,
      clases: clases.filter((c) => calculo.enSede(c.sedeId)),
      asistencias: baseRentabilidad.asistencias,
      membresias: baseRentabilidad.membresias,
      pagos: baseRentabilidad.pagosClase,
      gastos: calculo.gastos,
      fijos: calculo.fijosS,
      rentas: baseRentabilidad.rentas,
    });
  }, [calculo, baseRentabilidad, clases, desde, mes]);
  const listo = !!datos && !!calculo;
  useEffect(() => {
    if (listo && abrirPorClase) document.getElementById('por-clase')?.scrollIntoView({ block: 'start' });
  }, [listo, abrirPorClase]);
  if (!datos || !calculo) return <Cargando texto="Calculando gastos y utilidad…" />;

  const { enSede, gastos, fijosS } = calculo;
  const pagos = datos.pagos.filter((p) => enSede(p.sedeId));
  const r = resumenMes({ mes, pagos, gastos, fijos: fijosS });
  const estados = estadoFijos(fijosS, gastos, mes);
  const sedeNueva = verSede === 'todas' ? null : verSede === PRINCIPAL ? null : verSede;
  const fechaNueva = esMesActual ? hoy() : hasta < hoy() ? hasta : desde;
  const verSedes = sedes.length > 0;
  const sinPagoMaestro = rent?.filas.some((f) => f.sinCosto);

  return (
    <div className="px-4 pb-8 lg:mx-auto lg:max-w-4xl">
      <div className="flex items-center gap-2 pt-4 pb-3">
        <Link to="/reportes" className="-ml-2.5 rounded-full p-2.5 active:bg-ink-100" aria-label="Volver a reportes">
          <ArrowLeft size={22} />
        </Link>
        <h1 className="flex-1 text-2xl font-extrabold tracking-tight">Gastos y utilidad</h1>
      </div>

      <div className="mb-3 flex items-center justify-between rounded-2xl bg-superficie p-1 ring-1 ring-ink-100">
        <button className="rounded-xl p-2.5 active:bg-ink-100" onClick={() => setMes(sumarMes(mes, -1))} aria-label="Mes anterior">
          <ChevronLeft />
        </button>
        <button className="rounded-xl px-4 py-2.5 font-semibold disabled:text-ink-900" disabled={esMesActual} onClick={() => setMes(mesDe(hoy()))}>
          {nombreMes(mes)}
          {!esMesActual && <span className="ml-2 text-sm text-brand-600">Ir a este mes</span>}
        </button>
        <button className="rounded-xl p-2.5 active:bg-ink-100 disabled:opacity-30" disabled={esMesActual} onClick={() => setMes(sumarMes(mes, 1))} aria-label="Mes siguiente">
          <ChevronRight />
        </button>
      </div>

      {verSedes && (
        <div className="relative mb-3 w-fit max-w-full">
          <Selector aria-label="Sede de Gastos y utilidad" value={verSede} onChange={(e) => setVerSede(e.target.value)} className="h-11 pr-9 pl-3 font-semibold text-brand-600">
            <option value="todas">Todas las sedes</option>
            <option value={PRINCIPAL}>{nombreSede(null, sedes, academia)}</option>
            {sedes.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
          </Selector>
          <ChevronDown size={16} className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-brand-600" aria-hidden="true" />
        </div>
      )}

      <div className="lg:grid lg:grid-cols-2 lg:items-start lg:gap-6">
        <div className="min-w-0">
          {/* Utilidad */}
          <div className="rounded-3xl bg-panel p-5 text-white">
            <p className="text-sm text-white/60">Utilidad {esMesActual ? 'en lo que va del mes' : 'del mes'}</p>
            <p className={cx('mt-1 text-4xl font-extrabold tracking-tight', r.utilidad < 0 && 'text-[#ff9b9b]')}>{dinero(r.utilidad)}</p>
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-white/60">Ingresos</p>
                <p className="text-lg font-bold">{dinero(r.ingresos)}</p>
                {r.tienda > 0 && <p className="text-xs text-white/60">tienda {dinero(r.tienda)}</p>}
              </div>
              <div>
                <p className="text-white/60">Gastos registrados</p>
                <p className="text-lg font-bold">{dinero(r.gastos)}</p>
              </div>
            </div>
            {r.pendiente > 0 && <p className="mt-3 border-t border-white/15 pt-3 text-xs text-[#ffd48a]">Fijos pendientes · aprox. {dinero(r.pendiente)}</p>}
          </div>

          <Boton grande bloque className="mt-3" onClick={() => setBorrador({ fecha: fechaNueva })}>
            <Plus size={20} /> Registrar gasto
          </Boton>
          <Boton bloque variante="secundario" className="mt-2" disabled={exportando} onClick={() => void exportar(pagos, gastos)}>
            <FileSpreadsheet size={18} aria-hidden="true" /> {exportando ? 'Preparando…' : `Excel de ${nombreMes(mes).split(' ')[0].toLowerCase()} para el contador`}
          </Boton>

          {/* Gastos fijos del mes */}
          <Seccion
            titulo="Gastos fijos del mes"
            accion={
              <button className="-mr-2 min-h-10 rounded-lg px-2 text-sm font-semibold text-brand-600 active:bg-brand-50" onClick={() => setFijos(true)}>
                {datos.fijos.some((f) => !f.deletedAt) ? 'Editar' : 'Agregar'}
              </button>
            }
          >
            {estados.length === 0 ? (
              <Tarjeta>
                <Vacio icono={<Repeat size={32} />} titulo="Sin gastos fijos" texto="Agrega la renta, la luz y el internet una vez; cada mes se registran con un toque.">
                  <Boton variante="secundario" onClick={() => setFijos(true)}>
                    Agregar gastos fijos
                  </Boton>
                </Vacio>
              </Tarjeta>
            ) : (
              <Tarjeta className="divide-y divide-ink-100">
                {estados.map(({ fijo, pagado, fecha }) => (
                  <div key={fijo.id} className="flex items-center gap-3 px-4 py-3">
                    <IconoCategoria valor={fijo.categoria} />
                    <span className="min-w-0 flex-1">
                      {/* hasta 2 renglones: con el botón al lado, "Pago Profa Daniela" se cortaba en "Pago Profa D…" */}
                      <span className="line-clamp-2 leading-snug font-semibold">{fijo.concepto}</span>
                      <span className="block truncate text-xs text-ink-500">
                        {pagado ? `Pagado el ${fechaCorta(pagado.fecha)}` : `Pendiente · día ${fijo.dia}`}
                        {verSedes && verSede === 'todas' && ` · ${nombreSede(fijo.sedeId, sedes, academia)}`}
                      </span>
                    </span>
                    {pagado ? (
                      <button className="-my-1 flex min-h-10 items-center gap-1 rounded-lg px-1 text-right active:bg-ink-50" onClick={() => setBorrador({ gasto: pagado, fecha: pagado.fecha })}>
                        <Check size={16} className="text-ok-600" />
                        <span className="font-bold">{dinero(pagado.monto)}</span>
                      </button>
                    ) : (
                      <Boton variante="secundario" className="shrink-0 px-3" onClick={() => setBorrador({ fijo, fecha: esMesActual ? hoy() : fecha })}>
                        Registrar {dinero(fijo.monto)}
                      </Boton>
                    )}
                  </div>
                ))}
              </Tarjeta>
            )}
          </Seccion>

        </div>

        <div className="min-w-0 lg:[&>section]:mt-0">
          <Seccion titulo={`Gastos registrados · ${gastos.length}`}>
            {gastos.length === 0 ? (
              <Tarjeta>
                <Vacio icono={<Wallet size={32} />} titulo={`Sin gastos en ${nombreMes(mes).toLowerCase()}`} />
              </Tarjeta>
            ) : (
              <Tarjeta className="divide-y divide-ink-100">
                {gastos.map((g) => (
                  <button key={g.id} onClick={() => setBorrador({ gasto: g, fecha: g.fecha })} className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-ink-50">
                    <IconoCategoria valor={g.categoria} />
                    <span className="min-w-0 flex-1">
                      <span className="block break-words font-medium">{g.concepto}</span>
                      <span className="block truncate text-xs text-ink-500">
                        {fechaCorta(g.fecha)} · {g.deCaja ? 'Salida de caja' : g.metodo}
                        {verSedes && verSede === 'todas' && ` · ${nombreSede(g.sedeId, sedes, academia)}`}
                      </span>
                    </span>
                    <span className="font-bold">{dinero(g.monto)}</span>
                  </button>
                ))}
              </Tarjeta>
            )}
          </Seccion>
          {r.porCategoria.length > 0 && (
          <details className="group mt-3 rounded-xl ring-1 ring-ink-100">
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 px-3 text-sm font-semibold [&::-webkit-details-marker]:hidden">
              En qué se gasta
              <ChevronDown size={16} className="text-ink-500 group-open:rotate-180" aria-hidden="true" />
            </summary>
            <div className="px-3 pb-3">
                  <Tarjeta className="space-y-3 p-4">
                    {r.porCategoria.map((c) => (
                      <div key={c.categoria}>
                        <div className="flex items-baseline justify-between text-sm">
                          <span className="inline-flex items-center gap-2 font-semibold">
                            <IconoCategoria valor={c.categoria} /> {categoria(c.categoria).texto}
                          </span>
                          <span className="font-bold">{dinero(c.monto)}</span>
                        </div>
                        <div className="mt-1 h-1.5 rounded-full bg-ink-100">
                          <div className="h-full rounded-full bg-brand-500" style={{ width: `${(c.monto / r.gastos) * 100}%` }} />
                        </div>
                      </div>
                    ))}
                  </Tarjeta>
            </div>
          </details>
          )}
          <details id="por-clase" open={abrirPorClase} className="group mt-3 scroll-mt-20 rounded-xl ring-1 ring-ink-100">
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 px-3 text-sm font-semibold [&::-webkit-details-marker]:hidden">
              Lo que deja cada clase
              <ChevronDown size={16} className="text-ink-500 group-open:rotate-180" aria-hidden="true" />
            </summary>
            <div className="px-3 pb-3">
              {!rent && <Cargando texto="Calculando el detalle por clase…" />}
              {rent && rent.filas.length === 0 && <p className="text-sm text-ink-500">Sin clases con actividad en este periodo.</p>}
              {rent && rent.filas.length > 0 && (
                <>
                  <Tarjeta className="divide-y divide-ink-100">
                    {rent.filas.map((f) => (
                      <div key={f.clase.id} className="flex items-center gap-3 px-4 py-3">
                        <span className="h-9 w-1.5 shrink-0 rounded-full" style={{ background: colorClase(f.clase, disciplinas) }} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-semibold">
                            {nombreClase(f.clase, disciplinas)}
                            {nombreMaestro(f.clase, maestros) && <span className="font-normal text-ink-500"> · {nombreMaestro(f.clase, maestros)}</span>}
                          </span>
                          <span className="block truncate text-xs text-ink-500">
                            {f.sesiones} {f.sesiones === 1 ? 'clase' : 'clases'} · {Math.round(f.asistencias / f.sesiones)} alumnos en promedio
                          </span>
                          <span className="block truncate text-xs text-ink-500">
                            Entra {dinero(f.ingresos)}
                            {f.renta > 0 && ` (renta ${dinero(f.renta)})`}
                            {f.costo > 0 ? ` · maestro ${f.estimado ? '~' : ''}${dinero(f.costo)}${f.estimado ? ' por pagar' : ''}` : f.sinCosto ? ' · sin pago al maestro' : ''}
                          </span>
                        </span>
                        <span className={cx('text-right font-extrabold', f.ganancia < 0 ? 'text-bad-600' : 'text-ink-900')}>
                          {dinero(f.ganancia)}
                          {f.ganancia < 0 && <span className="block text-[11px] font-semibold">pierde</span>}
                        </span>
                      </div>
                    ))}
                  </Tarjeta>
                  <p className="mt-2 px-1 text-xs leading-relaxed text-ink-500">
                    Lo que entra (clases sueltas y la parte de cada plan) menos lo pagado al maestro. Sin contar renta del local, luz, etc.
                    {(sinPagoMaestro || rent.sinAsignar > 0) && ' Para que se reste el pago del maestro, al registrarlo en Gastos (categoría Maestros) elige a qué maestro fue.'}
                    {rent.sinAsignar > 0 && ` Hay ${dinero(rent.sinAsignar)} pagados a maestros sin elegir maestro.`}
                  </p>
                </>
              )}
            </div>
          </details>
        </div>
      </div>

      <Hoja abierta={!!borrador} onCerrar={() => setBorrador(null)} titulo={borrador?.gasto ? 'Gasto' : borrador?.fijo ? borrador.fijo.concepto : 'Registrar gasto'}>
        {borrador && <FormGasto key={borrador.gasto?.id ?? borrador.fijo?.id ?? 'nuevo'} borrador={borrador} sedeInicial={borrador.fijo ? (borrador.fijo.sedeId ?? null) : sedeNueva} sedes={sedes} onHecho={() => setBorrador(null)} />}
      </Hoja>
      <Hoja abierta={fijos} onCerrar={() => setFijos(false)} titulo="Gastos fijos">
        <ListaFijos fijos={datos.fijos.filter((f) => !f.deletedAt)} sedes={sedes} sedeInicial={sedeNueva} />
      </Hoja>
    </div>
  );
}

function SelectorSede({ valor, onChange, sedes }: { valor: string | null; onChange: (v: string | null) => void; sedes: Sede[] }) {
  const { academia } = useSesion();
  if (!sedes.length) return null;
  return (
    <Campo etiqueta="Sede">
      <Selector value={valor ?? ''} onChange={(e) => onChange(e.target.value || null)}>
        <option value="">{nombreSede(null, sedes, academia)}</option>
        {sedes.map((s) => (
          <option key={s.id} value={s.id}>
            {s.nombre}
          </option>
        ))}
      </Selector>
    </Campo>
  );
}

function SelectorMaestro({ valor, onChange, maestros }: { valor: string | null; onChange: (v: string | null) => void; maestros: Maestro[] }) {
  if (!maestros.length) return null;
  return (
    <Campo etiqueta="¿A qué maestro?">
      <Selector value={valor ?? ''} onChange={(e) => onChange(e.target.value || null)}>
        <option value="">Sin elegir</option>
        {maestros.map((m) => (
          <option key={m.id} value={m.id}>
            {m.nombre}
          </option>
        ))}
      </Selector>
    </Campo>
  );
}

const ICONOS_CATEGORIA = { renta: House, luz: Lightbulb, agua: Droplet, internet: Wifi, maestros: Users, limpieza: Brush, otro: Receipt };

function IconoCategoria({ valor }: { valor: CategoriaGasto }) {
  const Icono = ICONOS_CATEGORIA[valor] ?? Receipt;
  return <Icono size={18} className="shrink-0 text-ink-500" aria-hidden="true" />;
}

function Categorias({ valor, onChange }: { valor: CategoriaGasto; onChange: (c: CategoriaGasto) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {CATEGORIAS.map((c) => (
        <button
          key={c.valor}
          type="button"
          onClick={() => onChange(c.valor)}
          className={cx('inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-semibold ring-1', valor === c.valor ? 'bg-brand-50 text-brand-600 ring-brand-500' : 'bg-superficie ring-ink-100')}
        >
          <IconoCategoria valor={c.valor} /> {c.texto}
        </button>
      ))}
    </div>
  );
}

function FormGasto({ borrador, sedeInicial, sedes, onHecho }: { borrador: Borrador; sedeInicial: string | null; sedes: Sede[]; onHecho: () => void }) {
  const { usuario } = useSesion();
  const avisar = useAvisos();
  const g = borrador.gasto;
  const f = borrador.fijo;
  const [concepto, setConcepto] = useState(g?.concepto ?? f?.concepto ?? '');
  const [cat, setCat] = useState<CategoriaGasto>(g?.categoria ?? f?.categoria ?? 'otro');
  const [monto, setMonto] = useState(g ? aPesosTexto(g.monto) : f ? aPesosTexto(f.monto) : '');
  const [fecha, setFecha] = useState<Fecha>(borrador.fecha);
  const [metodo, setMetodo] = useState<MetodoPago>(g?.metodo ?? 'transferencia');
  const [sede, setSede] = useState<string | null>(g ? (g.sedeId ?? null) : sedeInicial);
  const [notas, setNotas] = useState(g?.notas ?? '');
  const [maestro, setMaestro] = useState<string | null>(g ? (g.maestroId ?? null) : (f?.maestroId ?? null));
  const maestros = useMaestros();
  const [ocupado, setOcupado] = useState(false);
  const centavos = aCentavos(monto);
  // Si no escriben concepto, se usa el nombre de la categoría ("Luz")
  const conceptoFinal = concepto.trim() || (cat !== 'otro' ? categoria(cat).texto : '');
  const fueraDeLoNormal = f && centavos > f.monto * 2;

  const guardar = async () => {
    setOcupado(true);
    try {
      if (g) {
        const elMaestro = cat === 'maestros' ? maestro : null;
        await actualizar('gastos', g.id, { ...conSede(sede, g.sedeId), concepto: conceptoFinal, categoria: cat, monto: centavos, fecha, metodo, notas: notas.trim(), ...(elMaestro || g.maestroId ? { maestroId: elMaestro } : {}) });
        avisar('Gasto actualizado');
      } else {
        await registrarGasto({ concepto: conceptoFinal, categoria: cat, monto: centavos, fecha, metodo, sedeId: sede, fijoId: f?.id ?? null, notas, usuarioId: usuario.id, maestroId: cat === 'maestros' ? maestro : null });
        avisar(`Gasto registrado · ${dinero(centavos)}`);
      }
      onHecho();
    } catch (e) {
      avisar(e instanceof Error ? e.message : 'No se pudo guardar', 'error');
    } finally {
      setOcupado(false);
    }
  };

  return (
    <div className="space-y-4">
      {!f && (
        <>
          <Categorias valor={cat} onChange={setCat} />
          <Campo etiqueta="Concepto">
            <Entrada value={concepto} onChange={(e) => setConcepto(e.target.value)} placeholder={cat === 'otro' ? 'Ej. Garrafones, bocina…' : categoria(cat).texto} />
          </Campo>
        </>
      )}
      <div className="grid grid-cols-2 gap-3">
        <Campo etiqueta="Monto">
          <Entrada inputMode="decimal" value={monto} onChange={(e) => setMonto(e.target.value)} placeholder="$" autoFocus={!f && !g} />
        </Campo>
        <Campo etiqueta="Fecha">
          <Entrada type="date" value={fecha} max={hoy()} onChange={(e) => e.target.value && setFecha(e.target.value)} />
        </Campo>
      </div>
      {f && <p className="-mt-2 px-1 text-xs text-ink-500">Normalmente {dinero(f.monto)}. Si el recibo trae otra cantidad (como la luz), cámbiala.</p>}
      {fueraDeLoNormal && (
        <p className="rounded-xl bg-warn-50 px-3 py-2 text-sm font-medium text-warn-600">Ojo: es más del doble de lo normal. ¿Se teclearon ceros de más?</p>
      )}
      <Segmentos opciones={METODOS} valor={metodo} onChange={setMetodo} />
      {!f && cat === 'maestros' && <SelectorMaestro valor={maestro} onChange={setMaestro} maestros={maestros} />}
      {!f && <SelectorSede valor={sede} onChange={setSede} sedes={sedes} />}
      <Campo etiqueta="Notas (opcional)">
        <Entrada value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Folio, a quién se pagó…" />
      </Campo>
      <Boton grande bloque onClick={guardar} disabled={ocupado || centavos <= 0 || !conceptoFinal}>
        {ocupado ? 'Guardando…' : g ? 'Guardar cambios' : `Registrar ${centavos > 0 ? dinero(centavos) : 'gasto'}`}
      </Boton>
      {(!conceptoFinal || centavos <= 0) && <p className="-mt-2 text-center text-sm text-ink-500">{!conceptoFinal ? 'Escribe el concepto del gasto.' : 'Escribe el monto del gasto.'}</p>}
      {g && (
        <Boton
          bloque
          variante="fantasma"
          onClick={async () => {
            await borrar('gastos', g.id);
            avisar('Gasto eliminado', 'ok', { texto: 'Deshacer', fn: () => actualizar('gastos', g.id, { deletedAt: null }).then(() => undefined) });
            onHecho();
          }}
        >
          <span className="text-bad-600">Eliminar gasto</span>
        </Boton>
      )}
    </div>
  );
}

function ListaFijos({ fijos, sedes, sedeInicial }: { fijos: GastoFijo[]; sedes: Sede[]; sedeInicial: string | null }) {
  const { academia } = useSesion();
  const [sel, setSel] = useState<GastoFijo | 'nuevo' | null>(fijos.length ? null : 'nuevo');
  if (sel) return <FormFijo key={sel === 'nuevo' ? 'nuevo' : sel.id} fijo={sel === 'nuevo' ? null : sel} sedes={sedes} sedeInicial={sedeInicial} onHecho={() => setSel(null)} />;
  return (
    <div className="space-y-3">
      <p className="text-sm text-ink-500">Lo que pagas cada mes. Aparecen en la lista del mes para registrarlos con un toque cuando los pagues.</p>
      {fijos.length > 0 && (
        <Tarjeta className="divide-y divide-ink-100">
          {[...fijos]
            .sort((a, b) => a.dia - b.dia)
            .map((f) => (
              <button key={f.id} onClick={() => setSel(f)} className={cx('flex w-full items-center gap-3 px-4 py-3 text-left active:bg-ink-50', !f.activo && 'opacity-40')}>
                <IconoCategoria valor={f.categoria} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{f.concepto}</span>
                  <span className="block truncate text-xs text-ink-500">
                    Día {f.dia}
                    {sedes.length > 0 && ` · ${nombreSede(f.sedeId, sedes, academia)}`}
                    {!f.activo && ' · en pausa'}
                  </span>
                </span>
                <span className="font-bold">{dinero(f.monto)}</span>
              </button>
            ))}
        </Tarjeta>
      )}
      <Boton bloque variante="secundario" onClick={() => setSel('nuevo')}>
        <Plus size={18} /> Nuevo gasto fijo
      </Boton>
    </div>
  );
}

function FormFijo({ fijo, sedes, sedeInicial, onHecho }: { fijo: GastoFijo | null; sedes: Sede[]; sedeInicial: string | null; onHecho: () => void }) {
  const avisar = useAvisos();
  const [cat, setCat] = useState<CategoriaGasto>(fijo?.categoria ?? 'renta');
  const [concepto, setConcepto] = useState(fijo?.concepto ?? '');
  const [monto, setMonto] = useState(fijo ? aPesosTexto(fijo.monto) : '');
  const [dia, setDia] = useState(String(fijo?.dia ?? 1));
  const [sede, setSede] = useState<string | null>(fijo ? (fijo.sedeId ?? null) : sedeInicial);
  const [activo, setActivo] = useState(fijo?.activo ?? true);
  const [maestro, setMaestro] = useState<string | null>(fijo?.maestroId ?? null);
  const maestros = useMaestros();
  const { academia } = useSesion();
  const sugerido = `${categoria(cat).texto}${sedes.length ? ` ${nombreSede(sede, sedes, academia)}` : ''}`;
  const diaN = Math.min(28, Math.max(1, Number(dia) || 1));

  const guardar = async () => {
    const elMaestro = cat === 'maestros' ? maestro : null;
    const datos = { ...conSede(sede, fijo?.sedeId), concepto: concepto.trim() || sugerido, categoria: cat, monto: aCentavos(monto), dia: diaN, activo, ...(elMaestro || fijo?.maestroId ? { maestroId: elMaestro } : {}) };
    if (fijo) await actualizar('gastosFijos', fijo.id, datos);
    else await crear('gastosFijos', datos);
    avisar('Gasto fijo guardado');
    onHecho();
  };

  return (
    <div className="space-y-4">
      <Categorias valor={cat} onChange={setCat} />
      {cat === 'maestros' && <SelectorMaestro valor={maestro} onChange={setMaestro} maestros={maestros} />}
      <SelectorSede valor={sede} onChange={setSede} sedes={sedes} />
      <Campo etiqueta="Nombre">
        <Entrada value={concepto} onChange={(e) => setConcepto(e.target.value)} placeholder={sugerido} />
      </Campo>
      <div className="grid grid-cols-2 gap-3">
        <Campo etiqueta="Monto al mes">
          <Entrada inputMode="decimal" value={monto} onChange={(e) => setMonto(e.target.value)} placeholder="$" />
        </Campo>
        <Campo etiqueta="Se paga el día">
          <Entrada inputMode="numeric" value={dia} onChange={(e) => setDia(e.target.value.replace(/\D/g, '').slice(0, 2))} />
        </Campo>
      </div>
      {fijo && (
        <Segmentos<'si' | 'no'>
          opciones={[
            { valor: 'si', texto: 'Activo' },
            { valor: 'no', texto: 'En pausa' },
          ]}
          valor={activo ? 'si' : 'no'}
          onChange={(v) => setActivo(v === 'si')}
        />
      )}
      <Boton grande bloque onClick={guardar} disabled={aCentavos(monto) <= 0}>
        Guardar
      </Boton>
      {fijo && (
        <Boton
          bloque
          variante="fantasma"
          onClick={async () => {
            await borrar('gastosFijos', fijo.id);
            avisar('Gasto fijo eliminado', 'ok', { texto: 'Deshacer', fn: () => actualizar('gastosFijos', fijo.id, { deletedAt: null }).then(() => undefined) });
            onHecho();
          }}
        >
          <span className="text-bad-600">Eliminar (los gastos ya registrados se conservan)</span>
        </Boton>
      )}
      <button className="w-full py-3 text-sm font-semibold text-ink-500" onClick={onHecho}>
        ← Volver a la lista
      </button>
    </div>
  );
}
