import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { ChevronLeft, ChevronRight, Lock, Receipt, RotateCcw, Scale } from 'lucide-react';
import { nombreClase, useClases, useDisciplinas, useMaestros, useUsuarios } from '../../app/datos';
import { useSesion } from '../../app/sesion';
import { useAvisos } from '../../components/avisos';
import { Avatar, Boton, Campo, Encabezado, Entrada, Etiqueta, Hoja, Seccion, Segmentos, Tarjeta, Vacio, cx } from '../../components/ui';
import { db } from '../../db/db';
import { crear } from '../../db/repo';
import type { MetodoPago, Pago } from '../../db/types';
import { cambiarMetodoPago, restaurarPago } from '../../domain/correcciones';
import { METODOS } from '../alumnos/VenderPlan';
import { asistenciasValidas, resumenCaja } from '../../domain/caja';
import { aCentavos, dinero } from '../../domain/dinero';
import { fechaLarga, horaDe, hoy, sumarDias } from '../../domain/fechas';
import { anularPago } from '../../domain/operaciones';

export function PantallaCaja() {
  const [fecha, setFecha] = useState(hoy());
  const clases = useClases();
  const disciplinas = useDisciplinas();
  const usuarios = useUsuarios();
  const maestros = useMaestros();
  const [pagoSel, setPagoSel] = useState<Pago | null>(null);
  const [corte, setCorte] = useState(false);

  const datos = useLiveQuery(async () => {
    const pagos = await db.pagos.where('fecha').equals(fecha).filter((p) => !p.deletedAt).toArray();
    const asis = asistenciasValidas(await db.asistencias.where('fecha').equals(fecha).toArray());
    const alumnos = await db.alumnos.bulkGet(pagos.map((p) => p.alumnoId ?? ''));
    const cortes = await db.cortes.where('fecha').equals(fecha).filter((c) => !c.deletedAt).sortBy('createdAt');
    const visitantes = new Map(asis.filter((a) => a.pagoId).map((a) => [a.pagoId!, a.nombreVisitante]));
    return {
      pagos: pagos
        .map((p, i) => ({ p, quien: alumnos[i]?.nombre ?? visitantes.get(p.id) ?? 'Visitante' }))
        .sort((a, b) => b.p.createdAt - a.p.createdAt),
      asis,
      corte: cortes[cortes.length - 1],
    };
  }, [fecha]);

  if (!datos) return null;
  const r = resumenCaja(datos.pagos.map((x) => x.p));
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
        <Encabezado titulo="Caja" sub={esHoy ? `Hoy, ${fechaLarga(fecha)}` : fechaLarga(fecha)} />
      </div>
      {/* Laptop/PC: resumen a la izquierda, movimientos a la derecha */}
      <div className="lg:grid lg:grid-cols-2 lg:items-start lg:gap-6">
      <div className="min-w-0">

      <div className="mb-4 flex items-center justify-between rounded-2xl bg-superficie p-1 ring-1 ring-ink-100">
        <button className="rounded-xl p-2.5 active:bg-ink-100" onClick={() => setFecha(sumarDias(fecha, -1))} aria-label="Día anterior">
          <ChevronLeft />
        </button>
        <button className="text-sm font-semibold text-brand-600 disabled:text-ink-300" disabled={esHoy} onClick={() => setFecha(hoy())}>
          Ir a hoy
        </button>
        <button className="rounded-xl p-2.5 active:bg-ink-100 disabled:opacity-30" disabled={esHoy} onClick={() => setFecha(sumarDias(fecha, 1))} aria-label="Día siguiente">
          <ChevronRight />
        </button>
      </div>

      {/* Totales */}
      <div className="rounded-3xl bg-panel p-5 text-white">
        <p className="text-sm text-white/60">Total cobrado</p>
        <p className="mt-1 text-4xl font-extrabold tracking-tight">{dinero(r.total)}</p>
        <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
          <Cifra etiqueta="Efectivo" valor={r.efectivo} />
          <Cifra etiqueta="Transferencia" valor={r.transferencia} />
          <Cifra etiqueta="Tarjeta" valor={r.tarjeta} />
        </div>
      </div>

      {/* Corte */}
      <div className="mt-3">
        {datos.corte ? (
          <Tarjeta className="flex items-center gap-3 p-4">
            <Lock className={datos.corte.diferencia === 0 ? 'text-ok-600' : 'text-warn-600'} size={22} />
            <div className="flex-1 text-sm">
              <p className="font-semibold">Corte hecho a las {horaDe(datos.corte.createdAt)}</p>
              <p className="text-ink-500">
                Contado {dinero(datos.corte.contadoEfectivo)} ·{' '}
                {datos.corte.diferencia === 0 ? 'cuadró exacto' : `${datos.corte.diferencia > 0 ? 'sobró' : 'faltó'} ${dinero(Math.abs(datos.corte.diferencia))}`}
              </p>
            </div>
            <button className="text-sm font-semibold text-brand-600" onClick={() => setCorte(true)}>
              Rehacer
            </button>
          </Tarjeta>
        ) : (
          <Boton bloque grande variante="secundario" onClick={() => setCorte(true)} disabled={!r.cobros}>
            <Scale size={20} /> Hacer corte de caja
          </Boton>
        )}
      </div>

      {porClase.length > 0 && (
        <Seccion titulo={`Asistencia · ${datos.asis.length}`}>
          <Tarjeta className="divide-y divide-ink-100">
            {porClase.map(({ c, n }) => (
              <div key={c.id} className="flex items-center justify-between px-4 py-2.5">
                <span className="font-medium">
                  {nombreClase(c, disciplinas)} <span className="text-sm text-ink-500">{c.horaInicio}</span>
                </span>
                <span className="font-bold">{n}</span>
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

      </div>
      <div className="min-w-0 lg:[&>section]:mt-0">
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
                    {p.concepto} · {p.metodo}
                  </span>
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
        {corte && <FormCorte fecha={fecha} esperado={r.efectivo} otros={r.transferencia + r.tarjeta} onHecho={() => setCorte(false)} />}
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

export function DetallePago({ pago: inicial, cobro, anulo, onHecho }: { pago: Pago; cobro?: string; anulo?: string; onHecho: () => void }) {
  const { usuario } = useSesion();
  const avisar = useAvisos();
  const pago = useLiveQuery(() => db.pagos.get(inicial.id), [inicial.id]) ?? inicial;
  const [motivo, setMotivo] = useState('');
  return (
    <div className="space-y-4">
      <Tarjeta className="divide-y divide-ink-100 text-sm">
        <Fila k="Concepto" v={pago.concepto} />
        <Fila k="Monto" v={dinero(pago.monto)} />
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
          <div>
            <p className="mb-1.5 px-1 text-sm font-medium text-ink-700">Método de pago</p>
            <Segmentos<MetodoPago>
              opciones={METODOS}
              valor={pago.metodo}
              onChange={async (m) => {
                const antes = await cambiarMetodoPago(pago.id, m);
                avisar(`Método: ${m}`, 'ok', { texto: 'Deshacer', fn: () => cambiarMetodoPago(pago.id, antes).then(() => undefined) });
              }}
            />
          </div>
          <div className="space-y-2 rounded-2xl bg-superficie p-4 ring-1 ring-ink-100">
            <p className="text-sm font-medium text-ink-700">Anular cobro</p>
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
            <p className="text-xs text-ink-500">Se quita el cobro y la entrada o el plan que generó. Queda registrado quién lo hizo y se puede restaurar.</p>
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

function FormCorte({ fecha, esperado, otros, onHecho }: { fecha: string; esperado: number; otros: number; onHecho: () => void }) {
  const { usuario } = useSesion();
  const avisar = useAvisos();
  const [contadoTxt, setContadoTxt] = useState('');
  const [notas, setNotas] = useState('');
  const contado = aCentavos(contadoTxt);
  const dif = contado - esperado;
  const listo = contadoTxt.trim() !== '';

  return (
    <div className="space-y-4">
      <Tarjeta className="p-4">
        <p className="text-sm text-ink-500">Efectivo que debe haber</p>
        <p className="text-3xl font-extrabold">{dinero(esperado)}</p>
        {otros > 0 && <p className="mt-1 text-sm text-ink-500">+ {dinero(otros)} en transferencia/tarjeta (no se cuenta en caja)</p>}
      </Tarjeta>
      <Campo etiqueta="¿Cuánto efectivo hay?">
        <Entrada autoFocus inputMode="decimal" value={contadoTxt} onChange={(e) => setContadoTxt(e.target.value)} placeholder="0" className="h-14 text-2xl font-bold" />
      </Campo>
      {listo && (
        <div className={cx('rounded-2xl p-4 text-center font-bold', dif === 0 ? 'bg-ok-50 text-ok-600' : 'bg-warn-50 text-warn-600')}>
          {dif === 0 ? '✓ Cuadra exacto' : dif > 0 ? `Sobran ${dinero(dif)}` : `Faltan ${dinero(-dif)}`}
        </div>
      )}
      {listo && dif !== 0 && (
        <Campo etiqueta="Nota (opcional)">
          <Entrada value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Ej. se dio cambio de más" />
        </Campo>
      )}
      <Boton
        grande
        bloque
        disabled={!listo}
        onClick={async () => {
          await crear('cortes', { fecha, esperadoEfectivo: esperado, contadoEfectivo: contado, diferencia: dif, totalOtros: otros, usuarioId: usuario.id, notas: notas.trim() });
          avisar('Corte guardado');
          onHecho();
        }}
      >
        Guardar corte
      </Boton>
    </div>
  );
}
