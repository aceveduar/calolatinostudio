import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowUpFromLine, Calculator, ChevronDown, ChevronLeft, ChevronRight, Lock, Receipt, RotateCcw, Scale } from 'lucide-react';
import { nombreClase, useClases, useDisciplinas, useMaestros, useUsuarios } from '../../app/datos';
import { useSesion } from '../../app/sesion';
import { nombreSede, useSedeActual, useSedes } from '../../app/sedes';
import { PRINCIPAL, claveSede, conSede } from '../../domain/sedes';
import { useAvisos } from '../../components/avisos';
import { Avatar, Boton, Campo, Encabezado, Entrada, Etiqueta, Hoja, Seccion, Segmentos, Selector, Tarjeta, Vacio, cx, Cargando } from '../../components/ui';
import { db } from '../../db/db';
import { crear } from '../../db/repo';
import type { CategoriaGasto, Gasto, MetodoPago, Pago } from '../../db/types';
import { cambiarMetodoPago, restaurarPago } from '../../domain/correcciones';
import { METODOS } from '../../domain/planes';
import { DENOMINACIONES, asistenciasValidas, esperadoEnCaja, resumenCaja, sumaConteo } from '../../domain/caja';
import { registrarGasto } from '../../domain/gastos';
import { aCentavos, dinero } from '../../domain/dinero';
import { fechaCorta, fechaLarga, horaDe, hoy, sumarDias } from '../../domain/fechas';
import { anularPago } from '../../domain/operaciones';
import { useRespaldoMovimientos } from '../../sync/respaldoMovimiento';
import { claseEnFecha } from '../../domain/clases';

export function PantallaCaja() {
  const [fecha, setFecha] = useState(hoy());
  const clases = useClases();
  const disciplinas = useDisciplinas();
  const usuarios = useUsuarios();
  const maestros = useMaestros();
  const [pagoSel, setPagoSel] = useState<Pago | null>(null);
  const [corte, setCorte] = useState(false);
  const [salida, setSalida] = useState(false);
  const { academia, esDueno } = useSesion();
  const sedes = useSedes();
  const [sedeActual] = useSedeActual();
  // Qué sede se ve: 'todas' | PRINCIPAL | id. Por defecto, la de este equipo.
  const [verSede, setVerSede] = useState<string | null>(null);
  const k = verSede ?? claveSede(sedeActual);
  const enSede = (sedeId: string | null | undefined) => k === 'todas' || claveSede(sedeId) === k;
  const sedeDeClase = new Map(clases.map((c) => [c.id, (claseEnFecha(c, fecha) ?? c).sedeId]));

  const datos = useLiveQuery(async () => {
    const movimientos = await db.pagos.where('fecha').equals(fecha).filter((p) => enSede(p.sedeId)).toArray();
    const pagos = movimientos.filter((p) => !p.deletedAt);
    const asis = asistenciasValidas(await db.asistencias.where('fecha').equals(fecha).toArray()).filter((a) => enSede(sedeDeClase.get(a.claseId)));
    const alumnos = await db.alumnos.bulkGet(pagos.map((p) => p.alumnoId ?? ''));
    const cortes = await db.cortes.where('fecha').equals(fecha).filter((c) => !c.deletedAt && k !== 'todas' && claveSede(c.sedeId) === k).sortBy('createdAt');
    const visitantes = new Map(asis.filter((a) => a.pagoId).map((a) => [a.pagoId!, a.nombreVisitante]));
    // efectivo que salió del cajón (garrafón, pago a un maestro): se descuenta en el corte
    const gastosCaja = await db.gastos.where('fecha').equals(fecha).filter((g) => !!g.deCaja && enSede(g.sedeId)).toArray();
    const ultimoCorte = cortes[cortes.length - 1];
    const cambioTrasCorte = !!ultimoCorte && [...movimientos, ...gastosCaja].some((m) => m.updatedAt > ultimoCorte.createdAt);
    return {
      fecha,
      sede: k,
      cambioTrasCorte,
      salidas: gastosCaja.filter((g) => !g.deletedAt).sort((a, b) => b.createdAt - a.createdAt),
      pagos: pagos
        .map((p, i) => ({ p, quien: alumnos[i]?.nombre ?? visitantes.get(p.id) ?? (p.rentaId ? p.concepto.split(' · ')[1] || 'Renta' : p.eventoId ? 'Boletos' : 'Visitante') }))
        .sort((a, b) => b.p.createdAt - a.p.createdAt),
      asis,
      corte: ultimoCorte,
    };
  }, [fecha, k, clases]);
  const respaldo = useRespaldoMovimientos(datos?.pagos.map(({ p }) => p.id) ?? []);

  if (!datos || datos.fecha !== fecha || datos.sede !== k) return <Cargando texto="Actualizando totales…" />;
  const r = resumenCaja(datos.pagos.map((x) => x.p));
  const totalSalidas = datos.salidas.reduce((t, g) => t + g.monto, 0);
  const porClase = clases
    .map((c) => ({ c, n: datos.asis.filter((a) => a.claseId === c.id).length }))
    .filter((x) => x.n > 0)
    .sort((a, b) => a.c.horaInicio.localeCompare(b.c.horaInicio));
  const esHoy = fecha === hoy();

  // Por maestro: alumnos en sus clases y lo cobrado por clase suelta en ellas
  // (las mensualidades no se atribuyen a un maestro porque cubren varias clases)
  const montoPago = new Map(datos.pagos.filter(({ p }) => !p.anuladoAt).map(({ p }) => [p.id, p.monto]));
  const acumulado = new Map<string, { nombre: string; clases: Set<string>; alumnos: number; cobrado: number }>();
  for (const a of datos.asis) {
    const c = clases.find((x) => x.id === a.claseId);
    const m = maestros.find((x) => x.id === c?.maestroId);
    const clave = m?.id ?? 'sin';
    const fila = acumulado.get(clave) ?? { nombre: m?.nombre ?? 'Sin maestro asignado', clases: new Set<string>(), alumnos: 0, cobrado: 0 };
    if (c) fila.clases.add(nombreClase(c, disciplinas));
    fila.alumnos++;
    fila.cobrado += a.pagoId ? (montoPago.get(a.pagoId) ?? 0) : 0;
    acumulado.set(clave, fila);
  }
  const porMaestro = [...acumulado.values()].sort((a, b) => b.alumnos - a.alumnos);

  return (
    <div className="px-4 pb-8">
      <div className="-mx-4">
        <Encabezado titulo="Caja" sub={sedes.length > 0 ? (
          <span className="relative mt-1 inline-block max-w-full">
            <Selector aria-label="Sede de Caja" value={k} onChange={(e) => setVerSede(e.target.value)} className="h-11 pr-9 pl-3 font-semibold text-brand-600">
              {esDueno && <option value="todas">Todas las sedes</option>}
              <option value={PRINCIPAL}>{nombreSede(null, sedes, academia)}</option>
              {sedes.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
            </Selector>
            <ChevronDown size={16} className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-brand-600" aria-hidden="true" />
          </span>
        ) : undefined} />
      </div>
      {/* Laptop/PC: resumen a la izquierda, movimientos a la derecha */}
      <div className="lg:grid lg:grid-cols-2 lg:items-start lg:gap-6">
      <div className="min-w-0">

      <div className="mb-4 flex items-center justify-between rounded-2xl bg-superficie p-1 ring-1 ring-ink-100">
        <button className="rounded-xl p-2.5 active:bg-ink-100" onClick={() => setFecha(sumarDias(fecha, -1))} aria-label="Día anterior">
          <ChevronLeft />
        </button>
        <div className="min-w-0 py-1 text-center text-sm">
          <p className="font-semibold first-letter:uppercase">{esHoy ? `Hoy · ${fechaCorta(fecha)}` : fechaLarga(fecha)}</p>
          {!esHoy && <button type="button" className="min-h-8 rounded-lg px-2 font-semibold text-brand-600 active:bg-brand-50" onClick={() => setFecha(hoy())}>Ir a hoy</button>}
        </div>
        <button className="rounded-xl p-2.5 active:bg-ink-100 disabled:opacity-30" disabled={esHoy} onClick={() => setFecha(sumarDias(fecha, 1))} aria-label="Día siguiente">
          <ChevronRight />
        </button>
      </div>

      {/* Totales */}
      <div className="rounded-3xl bg-panel p-5 text-white">
        <p className="text-sm text-white/60">Total cobrado</p>
        <p className="mt-1 text-4xl font-extrabold tracking-tight">{dinero(r.total)}</p>
        {(r.tienda > 0 || r.rentas > 0 || r.eventos > 0) && (
          <p className="mt-1 text-sm text-white/70">
            {[
              `Clases ${dinero(r.total - r.tienda - r.rentas - r.eventos)}`,
              r.tienda > 0 && `Tienda ${dinero(r.tienda)}`,
              r.rentas > 0 && `Renta del salón ${dinero(r.rentas)}`,
              r.eventos > 0 && `Eventos ${dinero(r.eventos)}`,
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
        )}
        <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
          <Cifra etiqueta="Efectivo" valor={r.efectivo} />
          <Cifra etiqueta="Transferencia" valor={r.transferencia} />
          <Cifra etiqueta="Tarjeta" valor={r.tarjeta} />
        </div>
        {totalSalidas > 0 && (
          <p className="mt-3 border-t border-white/15 pt-3 text-sm text-white/80">
            Salieron de la caja <b className="text-white">−{dinero(totalSalidas)}</b> en efectivo
          </p>
        )}
      </div>

      {/* Corte */}
      <div className="mt-3">
        {datos.corte ? (
          <Tarjeta className="flex items-center gap-3 p-4">
            <Lock className={!datos.cambioTrasCorte && datos.corte.diferencia === 0 ? 'shrink-0 text-ok-600' : 'shrink-0 text-warn-600'} size={22} aria-hidden="true" />
            <div className="flex-1 text-sm">
              <p className="font-semibold">{datos.cambioTrasCorte ? 'Corte por actualizar' : `Corte hecho a las ${horaDe(datos.corte.createdAt)}`}</p>
              <p className="text-ink-500">
                Contado {dinero(datos.corte.contadoEfectivo)} ·{' '}
                {datos.corte.diferencia === 0 ? 'cuadró exacto' : `${datos.corte.diferencia > 0 ? 'sobró' : 'faltó'} ${dinero(Math.abs(datos.corte.diferencia))}`}
                {!!datos.corte.fondo && ` · ${dinero(datos.corte.fondo)} de feria`}
              </p>
              {datos.cambioTrasCorte && <p className="mt-1 text-warn-600">Hubo cambios después del corte de las {horaDe(datos.corte.createdAt)}.</p>}
            </div>
            <button className="min-h-11 shrink-0 rounded-lg px-1 text-sm font-semibold text-brand-600" onClick={() => setCorte(true)}>
              {datos.cambioTrasCorte ? 'Actualizar corte' : 'Rehacer'}
            </button>
          </Tarjeta>
        ) : k === 'todas' || (!r.cobros && !totalSalidas) ? (
          <p className="px-2 py-2 text-center text-sm text-ink-500">
            {k === 'todas' ? 'Elige una sede para hacer el corte.' : 'Aún no hay movimientos para hacer el corte.'}
          </p>
        ) : (
          <Boton bloque grande variante="secundario" onClick={() => setCorte(true)}>
            <Scale size={20} /> Hacer corte de caja
          </Boton>
        )}
        {esHoy && k !== 'todas' && (
          <button type="button" onClick={() => setSalida(true)} className="mt-2 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold text-ink-700 active:bg-ink-100">
            <ArrowUpFromLine size={17} aria-hidden="true" /> Registrar salida de efectivo
          </button>
        )}
      </div>

      {(porClase.length > 0 || r.porConcepto.length > 0) && (
        <details className="group mt-3">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 rounded-xl px-3 text-sm font-semibold text-ink-700 ring-1 ring-inset ring-ink-100 active:bg-ink-100 [&::-webkit-details-marker]:hidden">
            Desglose del día <ChevronDown size={16} className="shrink-0 text-ink-500 group-open:rotate-180" aria-hidden="true" />
          </summary>
          {porClase.length > 0 && (
            <Seccion titulo="Por clase">
              <Tarjeta className="divide-y divide-ink-100">
                {porClase.map(({ c, n }) => (
                  <div key={c.id} className="flex items-center justify-between px-4 py-2.5">
                    <span className="font-medium">
                      {nombreClase(c, disciplinas)} <span className="text-sm text-ink-500">{c.horaInicio}</span>
                    </span>
                    <span className="font-bold">
                      {n} <span className="text-sm font-normal text-ink-500">{n === 1 ? 'alumno' : 'alumnos'}</span>
                    </span>
                  </div>
                ))}
              </Tarjeta>
            </Seccion>
          )}

          {porMaestro.length > 0 && maestros.length > 0 && (
            <Seccion titulo="Por maestro">
              <Tarjeta className="divide-y divide-ink-100">
                {porMaestro.map((m) => (
                  <div key={m.nombre} className="flex items-center gap-3 px-4 py-3">
                    <Avatar nombre={m.nombre} tam={36} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{m.nombre}</span>
                      <span className="block truncate text-xs text-ink-500">
                        {[...m.clases].join(', ')} · {m.alumnos} alumno{m.alumnos === 1 ? '' : 's'}
                      </span>
                    </span>
                    <span className="text-right">
                      <span className="block font-bold">{dinero(m.cobrado)}</span>
                      <span className="block text-[11px] text-ink-500">por clase</span>
                    </span>
                  </div>
                ))}
              </Tarjeta>
            </Seccion>
          )}

          {r.porConcepto.length > 0 && (
            <Seccion titulo="Por concepto">
              <Tarjeta className="divide-y divide-ink-100">
                {r.porConcepto.map((c) => (
                  <div key={c.concepto} className="flex items-center justify-between px-4 py-2.5">
                    <span className="font-medium">
                      {c.concepto} <span className="text-sm text-ink-500">× {c.cantidad}</span>
                    </span>
                    <span className="font-bold">{dinero(c.monto)}</span>
                  </div>
                ))}
              </Tarjeta>
            </Seccion>
          )}
        </details>
      )}

      </div>
      <div className="min-w-0 lg:[&>section]:mt-0">
      {datos.salidas.length > 0 && (
        <Seccion titulo={`Salidas de efectivo · ${datos.salidas.length}`}>
          <Tarjeta className="divide-y divide-ink-100">
            {datos.salidas.map((g) => (
              <div key={g.id} className="flex items-center gap-3 px-4 py-3">
                <span className="w-11 text-xs text-ink-500">{horaDe(g.createdAt)}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{g.concepto}</span>
                  <span className="block truncate text-xs text-ink-500">{usuarios.find((u) => u.id === g.usuarioId)?.nombre ?? ''}</span>
                </span>
                <span className="font-bold text-bad-600">−{dinero(g.monto)}</span>
              </div>
            ))}
          </Tarjeta>
        </Seccion>
      )}
      <Seccion titulo={`Movimientos · ${r.cobros}${r.anulados ? ` (+${r.anulados} anulados)` : ''}`}>
        {datos.pagos.length === 0 ? (
          <Tarjeta>
            <Vacio icono={<Receipt size={36} />} titulo="Sin cobros este día" />
          </Tarjeta>
        ) : (
          <Tarjeta className="divide-y divide-ink-100">
            {datos.pagos.map(({ p, quien }) => (
              <button key={p.id} onClick={() => setPagoSel(p)} className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-ink-50">
                <span className="w-11 text-xs text-ink-500">{horaDe(p.createdAt)}</span>
                <span className={cx('min-w-0 flex-1', !!p.anuladoAt && 'opacity-40')}>
                  <span className={cx('block truncate font-medium', !!p.anuladoAt && 'line-through')}>{quien}</span>
                  <span className="block truncate text-xs text-ink-500">
                    {p.rentaId ? 'Renta del salón' : p.concepto} · {p.monto === 0 && p.planId ? 'sin costo' : p.metodo}
                  </span>
                  {respaldo(p.id) === 'Pendiente de sincronizar' && (
                    <span className="block text-xs font-semibold text-warn-600">Pendiente de sincronizar</span>
                  )}
                </span>
                {p.anuladoAt ? <Etiqueta tono="sin">Anulado</Etiqueta> : <span className="font-bold">{dinero(p.monto)}</span>}
              </button>
            ))}
          </Tarjeta>
        )}
      </Seccion>
      </div>
      </div>

      <Hoja abierta={!!pagoSel} onCerrar={() => setPagoSel(null)} titulo="Cobro">
        {pagoSel && <DetallePago pago={pagoSel} cobro={usuarios.find((u) => u.id === pagoSel.usuarioId)?.nombre} anulo={usuarios.find((u) => u.id === pagoSel.anuladoPor)?.nombre} onHecho={() => setPagoSel(null)} />}
      </Hoja>
      <Hoja abierta={corte} onCerrar={() => setCorte(false)} titulo="Corte de caja">
        {corte && k !== 'todas' && (
          <FormCorte
            fecha={fecha}
            sedeId={k === PRINCIPAL ? null : k}
            sede={nombreSede(k === PRINCIPAL ? null : k, sedes, academia)}
            efectivo={r.efectivo}
            salidas={datos.salidas}
            transferencia={r.transferencia}
            tarjeta={r.tarjeta}
            rehaciendo={!!datos.corte}
            onHecho={() => setCorte(false)}
          />
        )}
      </Hoja>
      <Hoja abierta={salida} onCerrar={() => setSalida(false)} titulo="Salida de efectivo">
        {salida && <FormSalida sedeId={k === PRINCIPAL || k === 'todas' ? null : k} onHecho={() => setSalida(false)} />}
      </Hoja>
    </div>
  );
}

function Cifra({ etiqueta, valor }: { etiqueta: string; valor: number }) {
  return (
    <div>
      <p className="text-white/60">{etiqueta}</p>
      <p className="font-bold">{dinero(valor)}</p>
    </div>
  );
}

const MOTIVOS = ['Se cobró dos veces', 'Persona equivocada', 'Monto equivocado', 'Se le devolvió el dinero'];

export function DetallePago({ pago: inicial, cobro, anulo, onHecho, onVerTicket }: { pago: Pago; cobro?: string; anulo?: string; onHecho: () => void; onVerTicket?: (pago: Pago) => void }) {
  const { usuario } = useSesion();
  const avisar = useAvisos();
  const pago = useLiveQuery(() => db.pagos.get(inicial.id), [inicial.id]) ?? inicial;
  const producto = useLiveQuery(() => pago.productoId ? db.productos.get(pago.productoId) : undefined, [pago.productoId]);
  const devuelveExistencias = producto?.inventario != null && pago.createdAt >= (producto.inventarioAt ?? 0);
  const piezas = pago.cantidad ?? 1;
  const respaldo = useRespaldoMovimientos([pago.id])(pago.id);
  const [motivo, setMotivo] = useState('');
  return (
    <div className="space-y-4">
      <Tarjeta className="divide-y divide-ink-100 text-sm">
        <Fila k="Concepto" v={pago.concepto} />
        <Fila k="Monto" v={dinero(pago.monto)} />
        {respaldo && <Fila k="Respaldo" v={respaldo} />}
        <Fila k="Cobró" v={`${cobro ?? '—'} · ${horaDe(pago.createdAt)}`} />
        {pago.anuladoAt && <Fila k="Anulado" v={`${anulo ?? '—'} · ${pago.anuladoMotivo ?? ''}`} />}
      </Tarjeta>

      {pago.anuladoAt ? (
        <Boton
          bloque
          variante="secundario"
          onClick={async () => {
            await restaurarPago(pago.id);
            avisar('Cobro restaurado');
            onHecho();
          }}
        >
          <RotateCcw size={18} /> Restaurar cobro (se anuló por error)
        </Boton>
      ) : (
        <>
          {onVerTicket && pago.monto > 0 && !pago.deletedAt && (
            <Boton bloque variante="secundario" onClick={() => onVerTicket(pago)}>Ver ticket</Boton>
          )}
          {pago.monto > 0 && <div>
            <p className="mb-1.5 px-1 text-sm font-medium text-ink-700">Método de pago</p>
            <Segmentos<MetodoPago>
              opciones={METODOS}
              valor={pago.metodo}
              onChange={async (m) => {
                const antes = await cambiarMetodoPago(pago.id, m);
                avisar(`Método: ${m}`, 'ok', { texto: 'Deshacer', fn: () => cambiarMetodoPago(pago.id, antes).then(() => undefined) });
              }}
            />
          </div>}
          <div className="space-y-2 rounded-2xl bg-superficie p-4 ring-1 ring-ink-100">
            <p className="text-sm font-medium text-ink-700">{pago.monto === 0 && pago.planId ? 'Anular (quita la beca)' : 'Anular cobro'}</p>
            <div className="flex flex-wrap gap-2">
              {MOTIVOS.map((m) => (
                <button
                  key={m}
                  onClick={() => setMotivo(m)}
                  className={cx('rounded-full px-3 py-1.5 text-sm font-medium ring-1', motivo === m ? 'bg-bad-50 text-bad-600 ring-bad-600/30' : 'ring-ink-100')}
                >
                  {m}
                </button>
              ))}
            </div>
            <Entrada value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="u otro motivo…" />
            {pago.productoId ? (
              <p className="text-sm text-ink-700">
                Se anula la venta de {dinero(pago.monto)} en Caja. {devuelveExistencias && (piezas === 1 ? 'Una pieza vuelve al inventario. ' : `Vuelven ${piezas} piezas al inventario. `)} La devolución del dinero se hace por separado.
              </p>
            ) : (
              <p className="text-xs text-ink-500">Se quita el cobro y la entrada o el plan que generó. Queda registrado quién lo hizo y se puede restaurar.</p>
            )}
            <Boton
              bloque
              variante="peligro"
              disabled={motivo.trim().length < 3}
              onClick={async () => {
                await anularPago(pago.id, motivo.trim(), usuario.id);
                avisar('Cobro anulado', 'ok', { texto: 'Deshacer', fn: () => restaurarPago(pago.id) });
                onHecho();
              }}
            >
              Anular cobro
            </Boton>
          </div>
        </>
      )}
    </div>
  );
}

function Fila({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-4 px-4 py-2.5">
      <span className="text-ink-500">{k}</span>
      <span className="text-right font-medium first-letter:uppercase">{v}</span>
    </div>
  );
}

/**
 * Corte de caja: feria con que abrió + cobrado en efectivo − lo que salió = lo que debe haber.
 * La feria se propone sola (la del último corte de esta sede). Se puede contar billete por billete.
 * Si falta dinero se pide una nota (para que la diferencia tenga explicación).
 */
function FormCorte({ fecha, sedeId, sede, efectivo, salidas, transferencia, tarjeta, rehaciendo, onHecho }: {
  fecha: string;
  sedeId: string | null;
  sede: string;
  efectivo: number;
  salidas: Gasto[];
  transferencia: number;
  tarjeta: number;
  rehaciendo: boolean;
  onHecho: () => void;
}) {
  const { usuario } = useSesion();
  const avisar = useAvisos();
  const clave = claveSede(sedeId);
  const ultimoFondo = useLiveQuery(async () => {
    const cs = await db.cortes.where('fecha').belowOrEqual(fecha).filter((c) => !c.deletedAt && claveSede(c.sedeId) === clave && c.fondo != null).toArray();
    return cs.sort((a, b) => b.fecha.localeCompare(a.fecha) || b.createdAt - a.createdAt)[0]?.fondo ?? 0;
  }, [clave, fecha]);
  const [fondoTxt, setFondoTxt] = useState<string | null>(null);
  const fondo = fondoTxt === null ? (ultimoFondo ?? 0) : aCentavos(fondoTxt);
  const totalSalidas = salidas.reduce((t, g) => t + g.monto, 0);
  const esperado = esperadoEnCaja({ fondo, efectivo, salidas: totalSalidas });
  const [contadoTxt, setContadoTxt] = useState('');
  const [contar, setContar] = useState(false);
  const [conteo, setConteo] = useState<number[]>(() => DENOMINACIONES.map(() => 0));
  const [notas, setNotas] = useState('');
  const [guardando, setGuardando] = useState(false);
  const fondoListo = fondoTxt !== null || ultimoFondo !== undefined;
  const contado = contar ? sumaConteo(conteo) : aCentavos(contadoTxt);
  const dif = contado - esperado;
  const listo = contar ? contado > 0 : contadoTxt.trim() !== '';
  const faltaNota = listo && dif < 0 && !notas.trim();

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-panel p-4 text-white">
        <p className="text-sm font-semibold text-white/80">
          {sede} · <time dateTime={fecha}>{fechaLarga(fecha)}</time>
        </p>
        <p className="mt-2 text-sm text-white/80">Efectivo esperado en el cajón</p>
        <p className="text-3xl font-extrabold tabular-nums">{fondoListo ? dinero(esperado) : '…'}</p>
      </div>
      {rehaciendo && <p className="px-1 text-sm text-ink-500">Vuelve a contar el efectivo para guardar un corte con los movimientos actuales.</p>}
      <Tarjeta className="divide-y divide-ink-100 text-sm">
        <label className="flex items-center justify-between gap-3 px-4 py-2.5">
          <span>
            <span className="block font-medium">Feria con la que abrió</span>
            <span className="block text-xs text-ink-500">Se queda en el cajón para dar cambio</span>
          </span>
          <span className="w-28 shrink-0">
            <Entrada
              inputMode="decimal"
              aria-label="Feria con la que abrió"
              value={fondoTxt ?? (ultimoFondo ? String(ultimoFondo / 100) : '')}
              onChange={(e) => setFondoTxt(e.target.value)}
              placeholder="0"
              className="h-11 text-right font-bold"
            />
          </span>
        </label>
        <div className="flex justify-between px-4 py-2.5">
          <span>+ Cobrado en efectivo</span>
          <b>{dinero(efectivo)}</b>
        </div>
        {totalSalidas > 0 && (
          <div className="px-4 py-2.5">
            <div className="flex justify-between">
              <span>− Salidas de efectivo</span>
              <b className="text-bad-600">{dinero(totalSalidas)}</b>
            </div>
            <p className="mt-0.5 text-xs text-ink-500">{salidas.map((g) => `${g.concepto} ${dinero(g.monto)}`).join(' · ')}</p>
          </div>
        )}
      </Tarjeta>
      {(transferencia > 0 || tarjeta > 0) && (
        <div className="rounded-xl bg-ink-50 px-4 py-2.5 text-sm text-ink-700">
          <p className="text-xs font-semibold text-ink-600">Cobros fuera del cajón</p>
          {transferencia > 0 && <p className="flex justify-between gap-2">Transferencia <strong>{dinero(transferencia)}</strong></p>}
          {tarjeta > 0 && <p className="flex justify-between gap-2">Tarjeta <strong>{dinero(tarjeta)}</strong></p>}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <p className="text-sm font-semibold text-ink-900">Conteo de efectivo</p>
        <button type="button" onClick={() => {
          if (contar && contado > 0) setContadoTxt(String(contado / 100));
          setContar(!contar);
        }} className="flex min-h-11 items-center gap-1.5 text-sm font-semibold text-brand-600">
          <Calculator size={16} aria-hidden="true" /> {contar ? 'Escribir el total' : 'Contar billete por billete'}
        </button>
      </div>
      {!contar ? (
        <Campo etiqueta="Efectivo contado" ayuda="Escribe 0 si el cajón está vacío.">
          <Entrada inputMode="decimal" value={contadoTxt} onChange={(e) => setContadoTxt(e.target.value)} placeholder="0" className="h-14 text-2xl font-bold" />
        </Campo>
      ) : (
        <div>
          <div className="grid grid-cols-2 gap-2">
            {DENOMINACIONES.map((d, i) => (
              <div key={i} className="flex items-center justify-between rounded-xl bg-superficie px-3 py-1.5 ring-1 ring-ink-100">
                <span className="text-sm">
                  <b>{d.valor < 100 ? `${d.valor}¢` : dinero(d.valor)}</b> <span className="text-xs text-ink-500">{d.tipo}</span>
                </span>
                <input
                  inputMode="numeric"
                  aria-label={`Cuántos de ${dinero(d.valor)} (${d.tipo})`}
                  value={conteo[i] || ''}
                  onChange={(e) => setConteo(conteo.map((x, j) => (j === i ? Number(e.target.value.replace(/\D/g, '')) || 0 : x)))}
                  placeholder="0"
                  className="h-10 w-14 rounded-lg bg-ink-50 text-center font-bold outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {fondoListo && listo && dif !== 0 && (
        <Campo etiqueta={dif < 0 ? '¿Qué pasó? (obligatorio cuando falta)' : 'Nota (opcional)'}>
          <Entrada value={notas} onChange={(e) => setNotas(e.target.value)} placeholder={dif < 0 ? 'Ej. se dio cambio de más, se pagó algo sin registrar' : 'Ej. propina, cobro sin registrar'} />
        </Campo>
      )}
      <div className="sticky bottom-0 -mx-5 space-y-2 border-t border-ink-100 bg-ink-50/95 px-5 pt-3 pb-4 backdrop-blur">
        {fondoListo && (listo || contar) && (
          <div role="status" className="space-y-1">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm">
              <p>Contado <b className="tabular-nums">{dinero(contado)}</b></p>
              {listo && <p className={cx('font-bold', dif === 0 ? 'text-ok-600' : 'text-warn-600')}>
                {dif === 0 ? 'Cuadra exacto' : dif > 0 ? `Sobran ${dinero(dif)}` : `Faltan ${dinero(-dif)}`}
              </p>}
            </div>
            {faltaNota ? <p className="text-xs font-medium text-warn-600">Escribe el motivo del faltante para guardar.</p>
              : listo && contado > fondo && (
                <p className="text-xs text-ink-500">
                  Guarda {dinero(contado - fondo)}{fondo > 0 ? ` y deja ${dinero(fondo)} de feria` : ''}.
                </p>
              )}
          </div>
        )}
        <Boton
        grande
        bloque
        disabled={!fondoListo || !listo || faltaNota || guardando}
        onClick={async () => {
          setGuardando(true);
          try {
            await crear('cortes', { ...conSede(sedeId), fecha, esperadoEfectivo: esperado, contadoEfectivo: contado, diferencia: dif, totalOtros: transferencia + tarjeta, usuarioId: usuario.id, notas: notas.trim(), fondo, salidas: totalSalidas });
            avisar(contado > fondo ? `Corte guardado · guarda ${dinero(contado - fondo)}` : 'Corte guardado');
            onHecho();
          } catch {
            avisar('No se pudo guardar el corte. Inténtalo de nuevo.', 'error');
          } finally {
            setGuardando(false);
          }
        }}
      >
          {guardando ? 'Guardando corte…' : 'Guardar corte'}
        </Boton>
      </div>
    </div>
  );
}

const CATEGORIAS_SALIDA: { valor: CategoriaGasto; texto: string }[] = [
  { valor: 'maestros', texto: 'Pago a maestro' },
  { valor: 'limpieza', texto: 'Limpieza' },
  { valor: 'agua', texto: 'Agua / garrafón' },
  { valor: 'otro', texto: 'Otro' },
];

/** Dinero que sale del cajón: queda como gasto del día y se descuenta en el corte. */
function FormSalida({ sedeId, onHecho }: { sedeId: string | null; onHecho: () => void }) {
  const { usuario } = useSesion();
  const avisar = useAvisos();
  const [concepto, setConcepto] = useState('');
  const [montoTxt, setMontoTxt] = useState('');
  const [categoria, setCategoria] = useState<CategoriaGasto>('otro');
  const monto = aCentavos(montoTxt);
  const listo = concepto.trim() && monto > 0;
  return (
    <div className="space-y-4">
      <p className="text-sm text-ink-500">Lo que se pagó con dinero del cajón. Se descuenta en el corte de caja y queda en Gastos.</p>
      <Campo etiqueta="¿Para qué?">
        <Entrada autoFocus value={concepto} onChange={(e) => setConcepto(e.target.value)} placeholder="Ej. garrafón de agua" maxLength={80} />
      </Campo>
      <Campo etiqueta="¿Cuánto?">
        <Entrada inputMode="decimal" value={montoTxt} onChange={(e) => setMontoTxt(e.target.value)} placeholder="$0" className="h-14 text-2xl font-bold" />
      </Campo>
      <Segmentos<CategoriaGasto> opciones={CATEGORIAS_SALIDA} valor={categoria} onChange={setCategoria} />
      <Boton
        grande
        bloque
        disabled={!listo}
        onClick={async () => {
          try {
            await registrarGasto({ concepto, categoria, monto, fecha: hoy(), metodo: 'efectivo', sedeId, usuarioId: usuario.id, deCaja: true });
            avisar(`Salida registrada · −${dinero(monto)}`);
            onHecho();
          } catch (e) {
            avisar(e instanceof Error ? e.message : 'No se pudo guardar', 'error');
          }
        }}
      >
        Registrar salida{monto > 0 ? ` de ${dinero(monto)}` : ''}
      </Boton>
    </div>
  );
}
