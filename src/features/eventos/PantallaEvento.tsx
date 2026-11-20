import { useState } from 'react';
import { DetalleEvento } from '../../components/DetalleEvento';
import { Link, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowLeft, Check, MessageCircle, Pencil, Search, Ticket, Wallet } from 'lucide-react';
import { useSesion } from '../../app/sesion';
import { useAvisos } from '../../components/avisos';
import { Boton, Campo, Entrada, Hoja, Seccion, Segmentos, Tarjeta, Vacio, cx } from '../../components/ui';
import { db } from '../../db/db';
import type { Boleto, Evento, MetodoPago } from '../../db/types';
import { rangoHora } from '../../domain/agenda';
import { aCentavos, dinero } from '../../domain/dinero';
import { boletoValido, cancelarEvento, cancelarVenta, marcarEntrada, resumenEvento, venderBoletos } from '../../domain/eventos';
import { fechaCorta, fechaLarga, hoy } from '../../domain/fechas';
import { registrarGasto } from '../../domain/gastos';
import { waLink } from '../../domain/reportes';
import { METODOS } from '../../domain/planes';
import { FormEvento } from './PantallaEventos';

const normalizar = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Un evento: cupo, venta de boletos, lista de entrada y su dinero (boletos − gastos). */
export function PantallaEvento() {
  const { id = '' } = useParams();
  const { esDueno, usuario, academia } = useSesion();
  const avisar = useAvisos();
  const [vender, setVender] = useState(false);
  const [editar, setEditar] = useState(false);
  const [gasto, setGasto] = useState(false);
  const [q, setQ] = useState('');
  const [venta, setVenta] = useState<Boleto | null>(null);
  const datos = useLiveQuery(async () => {
    const evento = await db.eventos.get(id);
    if (!evento) return null;
    const [boletos, pagos, gastos] = await Promise.all([
      db.boletos.where('eventoId').equals(id).toArray(),
      db.pagos.where('eventoId').equals(id).toArray(),
      db.gastos.where('eventoId').equals(id).toArray(),
    ]);
    return { evento, boletos, pagos, gastos };
  }, [id]);
  if (datos === undefined) return null;
  if (!datos) return <Vacio titulo="Evento no encontrado" />;
  const { evento: e, boletos, pagos, gastos } = datos;
  const r = resumenEvento(e, boletos, pagos, gastos);
  const lista = boletos
    .filter(boletoValido)
    .filter((b) => !q.trim() || normalizar(b.nombre).includes(normalizar(q.trim())) || b.codigo.toLowerCase() === q.trim().toLowerCase())
    .sort((a, b) => Number(!!a.usadoAt) - Number(!!b.usadoAt) || a.nombre.localeCompare(b.nombre));
  const esHoy = e.fecha === hoy();
  const pasado = e.fecha < hoy();
  const lleno = r.quedan === 0;

  return (
    <div className="px-4 pb-8 lg:mx-auto lg:max-w-3xl">
      <div className="flex items-center gap-2 pt-4 pb-1">
        <Link to="/agenda/eventos" className="-ml-2.5 rounded-full p-2.5 active:bg-ink-100" aria-label="Volver a eventos">
          <ArrowLeft size={22} />
        </Link>
        <h1 className="min-w-0 flex-1 truncate text-2xl font-extrabold tracking-tight">{e.nombre}</h1>
        {esDueno && e.activo && (
          <button onClick={() => setEditar(true)} className="rounded-full p-2 text-ink-500 active:bg-ink-100" aria-label="Editar evento">
            <Pencil size={20} />
          </button>
        )}
      </div>
      <p className="mb-3 text-sm text-ink-500 first-letter:uppercase">
        {fechaLarga(e.fecha)} · {rangoHora(e.horaInicio, e.duracionMin)} · boleto {dinero(e.precio)}
        {!e.activo && ' · CANCELADO'}
      </p>
      {(e.descripcion || e.vestimenta || e.lugar) && (
        <div className="mb-3 rounded-xl bg-superficie px-4 py-2.5 ring-1 ring-ink-100">
          {/* lo mismo que ve la gente en la página y el portal */}
          <DetalleEvento e={{ descripcion: e.descripcion, vestimenta: e.vestimenta ?? '', lugar: e.lugar ?? '', direccion: e.direccion ?? '', otro_lugar: !!e.lugar }} />
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <Cifra titulo="Boletos" valor={`${r.vendidos}${e.cupo !== null ? ` / ${e.cupo}` : ''}`} pie={r.quedan === null ? 'sin límite' : lleno ? 'cupo lleno' : `quedan ${r.quedan}`} alerta={lleno} />
        <Cifra titulo="Entraron" valor={`${r.entraron}`} pie={r.vendidos ? `de ${r.vendidos}` : '—'} />
        <Cifra titulo="Ingresos" valor={dinero(r.ingresos)} pie="por boletos" />
        <Cifra titulo="Utilidad" valor={dinero(r.utilidad)} pie={`gastos ${dinero(r.gastos)}`} alerta={r.utilidad < 0} />
      </div>
      {e.cupo !== null && (
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-ink-100">
          <div className={cx('h-full rounded-full', lleno ? 'bg-bad-600' : 'bg-brand-500')} style={{ width: `${Math.min(100, (r.vendidos / Math.max(1, e.cupo)) * 100)}%` }} />
        </div>
      )}

      {e.activo && !pasado && (
        <Boton grande bloque className="mt-4" disabled={lleno} onClick={() => setVender(true)}>
          <Ticket size={20} /> {lleno ? 'Cupo lleno' : `Vender boleto · ${dinero(e.precio)}`}
        </Boton>
      )}

      <Seccion titulo={esHoy ? 'Entrada · toca a quien llega' : `Boletos · ${r.vendidos}`}>
        {r.vendidos === 0 ? (
          <Tarjeta>
            <Vacio icono={<Ticket size={32} />} titulo="Aún no hay boletos vendidos" />
          </Tarjeta>
        ) : (
          <>
            <div className="relative mb-2">
              <Search className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-300" size={18} />
              <input
                value={q}
                onChange={(ev) => setQ(ev.target.value)}
                placeholder="Buscar por nombre o código"
                className="h-11 w-full rounded-xl bg-superficie pr-3 pl-10 ring-1 ring-ink-100 outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
            <p className="mb-2 px-1 text-xs text-ink-500">En la puerta: toca el círculo de quien va entrando. Puedes buscarlo por nombre o por el código de su boleto.</p>
            <Tarjeta className="divide-y divide-ink-100">
              {lista.map((b) => (
                <div key={b.id} className="flex items-center gap-3 px-3 py-2.5">
                  <button
                    onClick={async () => {
                      await marcarEntrada(b.id, !b.usadoAt);
                      if (!b.usadoAt) avisar(`${b.nombre} entró`);
                    }}
                    className={cx('flex h-9 w-9 shrink-0 items-center justify-center rounded-full ring-2', b.usadoAt ? 'bg-ok-600 text-white ring-ok-600' : 'text-transparent ring-ink-100')}
                    aria-label={b.usadoAt ? `${b.nombre} ya entró (toca para quitar)` : `Marcar que ${b.nombre} entró`}
                    aria-pressed={!!b.usadoAt}
                  >
                    <Check size={18} />
                  </button>
                  <button className="min-w-0 flex-1 text-left" onClick={() => setVenta(b)}>
                    <span className={cx('block truncate font-semibold', !!b.usadoAt && 'text-ink-500')}>{b.nombre}</span>
                    <span className="block font-mono text-xs tracking-wider text-ink-500">{b.codigo}</span>
                  </button>
                  {b.telefono && (
                    <a
                      href={waLink(b.telefono, mensajeBoleto(e, b, academia.nombre)) ?? undefined}
                      target="_blank"
                      rel="noreferrer"
                      // discreto: con 60 boletos, 60 círculos verdes eran mucho ruido; el área de toque sigue de 40 px
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-ink-500 active:bg-ok-50 active:text-ok-600"
                      aria-label={`Mandar boleto a ${b.nombre}`}
                    >
                      <MessageCircle size={18} />
                    </a>
                  )}
                </div>
              ))}
            </Tarjeta>
          </>
        )}
      </Seccion>

      <Seccion
        titulo={`Gastos del evento · ${dinero(r.gastos)}`}
        accion={
          esDueno && (
            <button className="text-sm font-semibold text-brand-600" onClick={() => setGasto(true)}>
              + Gasto
            </button>
          )
        }
      >
        {gastos.filter((g) => !g.deletedAt).length === 0 ? (
          <Tarjeta className="p-4 text-sm text-ink-500">Sin gastos registrados (decoración, DJ, premios…).</Tarjeta>
        ) : (
          <Tarjeta className="divide-y divide-ink-100">
            {gastos
              .filter((g) => !g.deletedAt)
              .map((g) => (
                <div key={g.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                  <span>
                    {g.concepto} <span className="text-ink-500">· {fechaCorta(g.fecha)}</span>
                  </span>
                  <span className="font-bold">{dinero(g.monto)}</span>
                </div>
              ))}
          </Tarjeta>
        )}
      </Seccion>

      {esDueno && e.activo && !pasado && (
        <Boton
          bloque
          variante="fantasma"
          className="mt-6"
          onClick={async () => {
            await cancelarEvento(e);
            avisar('Evento cancelado: el salón queda libre');
          }}
        >
          <span className="text-bad-600">Cancelar evento (libera el salón)</span>
        </Boton>
      )}

      <Hoja abierta={vender} onCerrar={() => setVender(false)} titulo={`Boletos · ${e.nombre}`}>
        {vender && <FormBoletos evento={e} quedan={r.quedan} onHecho={() => setVender(false)} />}
      </Hoja>
      <Hoja abierta={editar} onCerrar={() => setEditar(false)} titulo="Editar evento">
        {editar && <FormEvento evento={e} onHecho={() => setEditar(false)} />}
      </Hoja>
      <Hoja abierta={gasto} onCerrar={() => setGasto(false)} titulo="Gasto del evento">
        {gasto && <FormGastoEvento evento={e} onHecho={() => setGasto(false)} />}
      </Hoja>
      <Hoja abierta={!!venta} onCerrar={() => setVenta(null)} titulo={venta?.nombre}>
        {venta && (
          <div className="space-y-3">
            <p className="text-sm text-ink-500">
              Boleto <b className="font-mono tracking-wider text-ink-900">{venta.codigo}</b>
              {venta.usadoAt ? ' · ya entró' : ''}
            </p>
            {venta.pagoId && (
              <Boton
                bloque
                variante="secundario"
                onClick={async () => {
                  await cancelarVenta(venta.pagoId!, 'Cancelación de boleto', usuario.id);
                  avisar('Venta cancelada: se anuló el cobro y se liberaron los lugares');
                  setVenta(null);
                }}
              >
                <span className="text-bad-600">Cancelar esta venta (devolver dinero)</span>
              </Boton>
            )}
          </div>
        )}
      </Hoja>
    </div>
  );
}

function mensajeBoleto(e: Evento, b: Boleto, academia: string) {
  // si es fuera de la academia, el lugar va en el mensaje (si no, llegarían al estudio)
  const donde = e.lugar ? ` en ${e.lugar}${e.direccion ? ` (${e.direccion})` : ''}` : '';
  const como = e.vestimenta ? ` ${e.vestimenta}.` : '';
  return `Hola ${b.nombre.split(' ')[0]}, este es tu boleto para ${e.nombre} (${academia}) 🎉 ${fechaLarga(e.fecha)} a las ${e.horaInicio}${donde}.${como} Tu código: ${b.codigo}. ¡Te esperamos!`;
}

function Cifra({ titulo, valor, pie, alerta }: { titulo: string; valor: string; pie: string; alerta?: boolean }) {
  return (
    <div className="rounded-2xl bg-superficie p-3 ring-1 ring-ink-100">
      <p className="text-xs font-semibold text-ink-500">{titulo}</p>
      <p className={cx('text-xl font-extrabold', alerta && 'text-bad-600')}>{valor}</p>
      <p className="text-xs text-ink-500">{pie}</p>
    </div>
  );
}

function FormBoletos({ evento, quedan, onHecho }: { evento: Evento; quedan: number | null; onHecho: () => void }) {
  const { usuario, academia } = useSesion();
  const avisar = useAvisos();
  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  const [cantidad, setCantidad] = useState(1);
  const [metodo, setMetodo] = useState<MetodoPago>('efectivo');
  const [ocupado, setOcupado] = useState(false);
  const maximo = Math.min(20, quedan ?? 20);

  const vender = async () => {
    setOcupado(true);
    try {
      const { boletos } = await venderBoletos({ evento, nombre, telefono, cantidad, metodo, usuarioId: usuario.id });
      const wa = waLink(telefono.replace(/\D/g, ''), boletos.length === 1 ? mensajeBoleto(evento, boletos[0], academia.nombre) : `Hola ${nombre.trim().split(' ')[0]}, tus ${boletos.length} boletos para ${evento.nombre} (${academia.nombre}) 🎉 ${fechaLarga(evento.fecha)} a las ${evento.horaInicio}. Códigos: ${boletos.map((b) => b.codigo).join(', ')}. ¡Los esperamos!`);
      avisar(`${cantidad} ${cantidad === 1 ? 'boleto vendido' : 'boletos vendidos'} · ${dinero(evento.precio * cantidad)}`, 'ok', wa ? { texto: 'Mandar boleto', fn: () => void window.open(wa, '_blank', 'noopener') } : undefined);
      onHecho();
    } catch (e) {
      avisar(e instanceof Error ? e.message : 'No se pudo vender', 'error');
    } finally {
      setOcupado(false);
    }
  };

  return (
    <div className="space-y-4">
      <Campo etiqueta="Nombre">
        <Entrada value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="A nombre de…" autoFocus />
      </Campo>
      <Campo etiqueta="WhatsApp (opcional)" ayuda="Para mandarle su boleto con su código.">
        <Entrada inputMode="tel" value={telefono} onChange={(e) => setTelefono(e.target.value)} placeholder="10 dígitos" />
      </Campo>
      <div className="flex items-center justify-between rounded-2xl bg-superficie p-2 ring-1 ring-ink-100">
        <span className="pl-2 text-sm font-medium text-ink-700">Boletos{quedan !== null ? ` (quedan ${quedan})` : ''}</span>
        <div className="flex items-center gap-3">
          <button type="button" className="flex h-10 w-10 items-center justify-center rounded-xl bg-ink-100 text-xl font-bold disabled:opacity-30" disabled={cantidad <= 1} onClick={() => setCantidad(cantidad - 1)} aria-label="Uno menos">
            −
          </button>
          <span className="w-6 text-center text-lg font-bold" aria-live="polite">
            {cantidad}
          </span>
          <button type="button" className="flex h-10 w-10 items-center justify-center rounded-xl bg-ink-100 text-xl font-bold disabled:opacity-30" disabled={cantidad >= maximo} onClick={() => setCantidad(cantidad + 1)} aria-label="Uno más">
            +
          </button>
        </div>
      </div>
      <Segmentos opciones={METODOS} valor={metodo} onChange={setMetodo} />
      <Boton grande bloque onClick={vender} disabled={ocupado || !nombre.trim()}>
        <Wallet size={20} /> Cobrar {dinero(evento.precio * cantidad)}
      </Boton>
    </div>
  );
}

function FormGastoEvento({ evento, onHecho }: { evento: Evento; onHecho: () => void }) {
  const { usuario } = useSesion();
  const avisar = useAvisos();
  const [concepto, setConcepto] = useState('');
  const [monto, setMonto] = useState('');
  const [metodo, setMetodo] = useState<MetodoPago>('efectivo');
  return (
    <div className="space-y-4">
      <Campo etiqueta="Concepto">
        <Entrada value={concepto} onChange={(e) => setConcepto(e.target.value)} placeholder="Ej. Decoración, DJ, premios" autoFocus />
      </Campo>
      <Campo etiqueta="Monto">
        <Entrada inputMode="decimal" value={monto} onChange={(e) => setMonto(e.target.value)} placeholder="$" />
      </Campo>
      <Segmentos opciones={METODOS} valor={metodo} onChange={setMetodo} />
      <Boton
        grande
        bloque
        disabled={!concepto.trim() || aCentavos(monto) <= 0}
        onClick={async () => {
          await registrarGasto({ concepto: `${concepto.trim()} (${evento.nombre})`, categoria: 'otro', monto: aCentavos(monto), fecha: hoy(), metodo, sedeId: evento.sedeId ?? null, eventoId: evento.id, usuarioId: usuario.id });
          avisar('Gasto del evento registrado');
          onHecho();
        }}
      >
        Registrar {aCentavos(monto) > 0 ? dinero(aCentavos(monto)) : 'gasto'}
      </Boton>
    </div>
  );
}
