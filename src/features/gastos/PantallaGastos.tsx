import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowLeft, Check, ChevronLeft, ChevronRight, Plus, Repeat, Wallet } from 'lucide-react';
import { colorClase, nombreClase, nombreMaestro, useClases, useDisciplinas, useMaestros } from '../../app/datos';
import { rentabilidadPorClase } from '../../domain/rentabilidad';
import type { Maestro } from '../../db/types';
import { useSesion } from '../../app/sesion';
import { nombreSede, useSedes } from '../../app/sedes';
import { useAvisos } from '../../components/avisos';
import { Boton, Campo, Entrada, Hoja, Seccion, Segmentos, Selector, Tarjeta, Vacio, cx } from '../../components/ui';
import { db } from '../../db/db';
import { actualizar, borrar, crear } from '../../db/repo';
import type { CategoriaGasto, Fecha, Gasto, GastoFijo, MetodoPago, Sede } from '../../db/types';
import { aCentavos, aPesosTexto, dinero } from '../../domain/dinero';
import { fechaCorta, hoy, sumarDias } from '../../domain/fechas';
import { CATEGORIAS, categoria, estadoFijos, mesDe, nombreMes, rangoMes, registrarGasto, resumenMes, sumarMes, type Mes } from '../../domain/gastos';
import { PRINCIPAL, claveSede, conSede } from '../../domain/sedes';
import { METODOS } from '../alumnos/VenderPlan';

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

  const datos = useLiveQuery(async () => {
    const [pagos, gastos, fijos] = await Promise.all([
      db.pagos.where('fecha').between(desde, hasta, true, true).toArray(),
      db.gastos.where('fecha').between(desde, hasta, true, true).toArray(),
      db.gastosFijos.toArray(),
    ]);
    // para lo que deja cada clase: las entradas del mes y de antes (cuántas clases cubrió cada plan)
    const [asistencias, rentas] = await Promise.all([db.asistencias.where('fecha').between(sumarDias(desde, -120), hasta, true, true).toArray(), db.rentas.toArray()]);
    const memIds = [...new Set(asistencias.flatMap((a) => (a.membresiaId ? [a.membresiaId] : [])))];
    const membresias = (await db.membresias.bulkGet(memIds)).filter((m) => !!m);
    const pagoIds = [...new Set([...membresias.map((m) => m.pagoId), ...asistencias.flatMap((a) => (a.pagoId ? [a.pagoId] : []))])];
    const pagosClase = (await db.pagos.bulkGet(pagoIds)).filter((x) => !!x);
    return { pagos, gastos, fijos, asistencias, rentas, membresias, pagosClase };
  }, [desde, hasta]);
  if (!datos) return null;

  const enSede = (s: string | null | undefined) => verSede === 'todas' || claveSede(s) === verSede;
  const pagos = datos.pagos.filter((p) => enSede(p.sedeId));
  const gastos = datos.gastos.filter((g) => !g.deletedAt && enSede(g.sedeId)).sort((a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : b.createdAt - a.createdAt));
  const fijosS = datos.fijos.filter((f) => enSede(f.sedeId));
  const r = resumenMes({ mes, pagos, gastos, fijos: fijosS });
  const estados = estadoFijos(fijosS, gastos, mes);
  const sedeNueva = verSede === 'todas' ? null : verSede === PRINCIPAL ? null : verSede;
  const fechaNueva = esMesActual ? hoy() : hasta < hoy() ? hasta : desde;
  const verSedes = sedes.length > 0;
  const rent = rentabilidadPorClase({
    mes,
    clases: clases.filter((c) => enSede(c.sedeId)),
    asistencias: datos.asistencias,
    membresias: datos.membresias,
    pagos: datos.pagosClase,
    gastos,
    fijos: fijosS,
    rentas: datos.rentas,
  });
  const sinPagoMaestro = rent.filas.some((f) => f.sinCosto);

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
        <div className="no-scrollbar -mx-4 mb-3 flex gap-2 overflow-x-auto px-4 lg:mx-0 lg:px-0">
          {['todas', PRINCIPAL, ...sedes.map((x) => x.id)].map((id) => (
            <button
              key={id}
              onClick={() => setVerSede(id)}
              className={cx('shrink-0 rounded-full px-4 py-2.5 text-sm font-semibold ring-1', verSede === id ? 'bg-brand-500 text-white ring-brand-500' : 'bg-superficie ring-ink-100')}
            >
              {id === 'todas' ? 'Todas las sedes' : nombreSede(id === PRINCIPAL ? null : id, sedes, academia)}
            </button>
          ))}
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
                <p className="text-white/60">Gastos</p>
                <p className="text-lg font-bold">{dinero(r.gastos)}</p>
                {r.pendiente > 0 && <p className="text-xs text-[#ffd48a]">faltan fijos por ~{dinero(r.pendiente)}</p>}
              </div>
            </div>
          </div>

          <Boton grande bloque className="mt-3" onClick={() => setBorrador({ fecha: fechaNueva })}>
            <Plus size={20} /> Registrar gasto
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
                    <span className="text-2xl leading-none">{categoria(fijo.categoria).emoji}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{fijo.concepto}</span>
                      <span className="block truncate text-xs text-ink-500">
                        {pagado ? `Pagado el ${fechaCorta(pagado.fecha)}` : `Se paga el día ${fijo.dia}`}
                        {verSedes && verSede === 'todas' && ` · ${nombreSede(fijo.sedeId, sedes, academia)}`}
                      </span>
                    </span>
                    {pagado ? (
                      <button className="-my-1 flex min-h-10 items-center gap-1 rounded-lg px-1 text-right active:bg-ink-50" onClick={() => setBorrador({ gasto: pagado, fecha: pagado.fecha })}>
                        <Check size={16} className="text-ok-600" />
                        <span className="font-bold">{dinero(pagado.monto)}</span>
                      </button>
                    ) : (
                      <Boton variante="secundario" onClick={() => setBorrador({ fijo, fecha: esMesActual ? hoy() : fecha })}>
                        Registrar {dinero(fijo.monto)}
                      </Boton>
                    )}
                  </div>
                ))}
              </Tarjeta>
            )}
          </Seccion>

          {r.porCategoria.length > 0 && (
            <Seccion titulo="En qué se gasta">
              <Tarjeta className="space-y-3 p-4">
                {r.porCategoria.map((c) => (
                  <div key={c.categoria}>
                    <div className="flex items-baseline justify-between text-sm">
                      <span className="font-semibold">
                        {categoria(c.categoria).emoji} {categoria(c.categoria).texto}
                      </span>
                      <span className="font-bold">{dinero(c.monto)}</span>
                    </div>
                    <div className="mt-1 h-1.5 rounded-full bg-ink-100">
                      <div className="h-full rounded-full bg-brand-500" style={{ width: `${(c.monto / r.gastos) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </Tarjeta>
            </Seccion>
          )}
        </div>

        <div className="min-w-0 lg:[&>section]:mt-0">
          {rent.filas.length > 0 && (
            <Seccion titulo="Lo que deja cada clase">
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
            </Seccion>
          )}
          <Seccion titulo={`Gastos registrados · ${gastos.length}`}>
            {gastos.length === 0 ? (
              <Tarjeta>
                <Vacio icono={<Wallet size={32} />} titulo={`Sin gastos en ${nombreMes(mes).toLowerCase()}`} />
              </Tarjeta>
            ) : (
              <Tarjeta className="divide-y divide-ink-100">
                {gastos.map((g) => (
                  <button key={g.id} onClick={() => setBorrador({ gasto: g, fecha: g.fecha })} className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-ink-50">
                    <span className="text-xl leading-none">{categoria(g.categoria).emoji}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{g.concepto}</span>
                      <span className="block truncate text-xs text-ink-500">
                        {fechaCorta(g.fecha)} · {g.metodo}
                        {verSedes && verSede === 'todas' && ` · ${nombreSede(g.sedeId, sedes, academia)}`}
                      </span>
                    </span>
                    <span className="font-bold">{dinero(g.monto)}</span>
                  </button>
                ))}
              </Tarjeta>
            )}
          </Seccion>
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

function Categorias({ valor, onChange }: { valor: CategoriaGasto; onChange: (c: CategoriaGasto) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {CATEGORIAS.map((c) => (
        <button
          key={c.valor}
          type="button"
          onClick={() => onChange(c.valor)}
          className={cx('rounded-full px-3 py-1.5 text-sm font-semibold ring-1', valor === c.valor ? 'bg-brand-50 text-brand-600 ring-brand-500' : 'bg-superficie ring-ink-100')}
        >
          {c.emoji} {c.texto}
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
        {g ? 'Guardar cambios' : `Registrar ${centavos > 0 ? dinero(centavos) : 'gasto'}`}
      </Boton>
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
                <span className="text-xl leading-none">{categoria(f.categoria).emoji}</span>
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
            avisar('Gasto fijo eliminado');
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
