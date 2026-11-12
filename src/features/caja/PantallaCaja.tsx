import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { ChevronLeft, ChevronRight, Lock, Receipt, Scale } from 'lucide-react';
import { nombreClase, useClases, useDisciplinas, useUsuarios } from '../../app/datos';
import { useSesion } from '../../app/sesion';
import { useAvisos } from '../../components/avisos';
import { Boton, Campo, Encabezado, Entrada, Etiqueta, Hoja, Seccion, Tarjeta, Vacio, cx } from '../../components/ui';
import { db } from '../../db/db';
import { crear } from '../../db/repo';
import type { Pago } from '../../db/types';
import { asistenciasValidas, resumenCaja } from '../../domain/caja';
import { aCentavos, dinero } from '../../domain/dinero';
import { fechaLarga, horaDe, hoy, sumarDias } from '../../domain/fechas';
import { anularPago } from '../../domain/operaciones';

export function PantallaCaja() {
  const [fecha, setFecha] = useState(hoy());
  const clases = useClases();
  const disciplinas = useDisciplinas();
  const usuarios = useUsuarios();
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

  return (
    <div className="px-4 pb-8">
      <div className="-mx-4">
        <Encabezado titulo="Caja" sub={esHoy ? `Hoy, ${fechaLarga(fecha)}` : fechaLarga(fecha)} />
      </div>

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

function DetallePago({ pago, cobro, anulo, onHecho }: { pago: Pago; cobro?: string; anulo?: string; onHecho: () => void }) {
  const { usuario } = useSesion();
  const avisar = useAvisos();
  const [motivo, setMotivo] = useState('');
  return (
    <div className="space-y-4">
      <Tarjeta className="divide-y divide-ink-100 text-sm">
        <Fila k="Concepto" v={pago.concepto} />
        <Fila k="Monto" v={dinero(pago.monto)} />
        <Fila k="Método" v={pago.metodo} />
        <Fila k="Cobró" v={`${cobro ?? '—'} · ${horaDe(pago.createdAt)}`} />
        {pago.anuladoAt && <Fila k="Anulado" v={`${anulo ?? '—'} · ${pago.anuladoMotivo ?? ''}`} />}
      </Tarjeta>
      {!pago.anuladoAt && (
        <>
          <Campo etiqueta="Motivo para anular" ayuda="Se quita el cobro y la entrada o el plan que generó. Queda registrado quién lo hizo.">
            <Entrada value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ej. se cobró dos veces" />
          </Campo>
          <Boton
            bloque
            variante="peligro"
            disabled={motivo.trim().length < 3}
            onClick={async () => {
              await anularPago(pago.id, motivo.trim(), usuario.id);
              avisar('Cobro anulado');
              onHecho();
            }}
          >
            Anular cobro
          </Boton>
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
