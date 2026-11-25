import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Check, ChevronRight, Megaphone, MessageCircle, PackageCheck, PartyPopper, Truck, WalletCards } from 'lucide-react';
import { useSesion } from '../../app/sesion';
import { useAvisos } from '../../components/avisos';
import { Avatar, Encabezado, Seccion, Tarjeta, Vacio, VerMas, Cargando } from '../../components/ui';
import type { Alumno } from '../../db/types';
import { dinero } from '../../domain/dinero';
import { fechaCorta, fechaLarga, hoy } from '../../domain/fechas';
import { nombreMes } from '../../domain/gastos';
import { armarMensaje, plantilla, type ClaveMensaje } from '../../domain/mensajes';
import { DIAS_ENTRE_COBROS, marcarAvisado, quitarAviso, type ClaveAviso } from '../../domain/pendientes';
import { waLink } from '../../domain/reportes';
import { usePendientes } from '../../app/pendientes';

const cuandoVence = (n: number) =>
  n < 0 ? `venció hace ${-n} ${n === -1 ? 'día' : 'días'}` : n === 0 ? 'vence hoy' : n === 1 ? 'vence mañana' : `vence en ${n} días`;

/**
 * "Pendientes": a quién escribirle y qué cobrar hoy, todo junto.
 * WhatsApp abre el mensaje listo. Recepción confirma cuándo avisó.
 */
export function PantallaPendientes() {
  const p = usePendientes();
  if (!p) return <Cargando texto="Revisando pendientes…" />;
  const { renovar, deben, extranar, rentas, interesados, porEntregar, porPedir, total } = p;

  return (
    <div className="px-4 pb-8 lg:mx-auto lg:max-w-3xl">
      <div className="-mx-4">
        <Encabezado titulo="Pendientes" sub={total ? 'Lo que hay que hacer hoy' : fechaLarga(hoy())} />
      </div>

      {total === 0 && deben.length === 0 && (
        <Tarjeta>
          <Vacio icono={<PartyPopper size={36} />} titulo="Todo al día" texto="No hay a quién escribirle ni nada por cobrar. Aquí aparece en cuanto haya algo." />
        </Tarjeta>
      )}

      {(interesados > 0 || porEntregar > 0 || porPedir > 0) && (
        <Tarjeta className="divide-y divide-ink-100">
          {interesados > 0 && <Atajo a="/alumnos/interesados" icono={<Megaphone size={20} />} texto={`${interesados} ${interesados === 1 ? 'interesado nuevo' : 'interesados nuevos'} por contactar`} />}
          {porEntregar > 0 && <Atajo a="/encargos" icono={<PackageCheck size={20} />} texto={`${porEntregar} ${porEntregar === 1 ? 'pedido listo' : 'pedidos listos'} para entregar`} />}
          {porPedir > 0 && <Atajo a="/encargos" icono={<Truck size={20} />} texto={`${porPedir} ${porPedir === 1 ? 'encargo' : 'encargos'} por pedir al proveedor`} />}
        </Tarjeta>
      )}

      {renovar.length > 0 && (
        <Seccion titulo={`Avisar que vence su plan · ${renovar.length}`}>
          <Lista items={renovar} fila={({ alumno, membresia, plan, enDias }) => (
              <FilaAviso
                key={membresia.id}
                alumno={alumno}
                clave={`vence:${membresia.id}`}
                mensaje={enDias < 0 ? 'vencio' : 'vence'}
                datos={{ plan: (plan?.nombre ?? 'plan').toLowerCase(), vence: fechaLarga(membresia.fin) }}
                detalle={`${plan?.nombre ?? 'Plan'} · ${cuandoVence(enDias)}`}
                urgente={enDias < 0}
              />
          )} />
        </Seccion>
      )}

      {deben.length > 0 && (
        <Seccion titulo={`Deben clases · ${deben.length}`}>
          <Lista items={deben} fila={({ alumno, clases, total: monto, avisoReciente }) => (
              <FilaAviso
                key={alumno.id}
                alumno={alumno}
                clave="adeudo"
                mensaje="adeudo"
                datos={{ monto: dinero(monto) }}
                detalle={`${clases} ${clases === 1 ? 'clase' : 'clases'} · ${dinero(monto)}`}
                avisoReciente={avisoReciente}
                urgente
              />
          )} />
          <p className="mt-2 px-1 text-xs text-ink-500">El saldo sigue visible hasta que se cobre. Puedes volver a enviar un recordatorio después de {DIAS_ENTRE_COBROS} días.</p>
        </Seccion>
      )}

      {rentas.length > 0 && (
        <Seccion titulo={`Rentas por cobrar · ${rentas.length}`}>
          <Lista items={rentas} fila={(c) => (
              <Link key={c.renta.id + c.mes} to="/agenda" className="flex items-center gap-3 px-4 py-3 active:bg-ink-50">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600">
                  <WalletCards size={20} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{c.renta.nombre}</span>
                  <span className={c.atrasada ? 'block truncate text-xs font-semibold text-bad-600' : 'block truncate text-xs text-ink-500'}>
                    {c.renta.tipo === 'evento' ? `Evento del ${fechaCorta(c.renta.desde)}` : `${nombreMes(c.mes)} · ${c.detalle}`}
                    {c.atrasada && ' · atrasada'}
                  </span>
                </span>
                <span className="font-bold">{dinero(c.monto)}</span>
                <ChevronRight size={18} className="shrink-0 text-ink-300" />
              </Link>
          )} />
        </Seccion>
      )}

      {extranar.length > 0 && (
        <Seccion titulo={`Dejaron de venir · ${extranar.length}`}>
          <Lista items={extranar} fila={({ alumno, ultima, veces }) => (
              <FilaAviso key={alumno.id} alumno={alumno} clave="extrañamos" mensaje="extrañamos" datos={{}} detalle={`Venía seguido (${veces}) · última vez ${fechaCorta(ultima)}`} />
          )} />
        </Seccion>
      )}

      {total > 0 && (
        <p className="mt-4 px-1 text-center text-xs leading-relaxed text-ink-500">
          Después de avisar por WhatsApp o en persona, toca <Check size={12} className="inline" aria-hidden="true" /> para marcar el aviso.
        </p>
      )}
    </div>
  );
}

/** Tarjeta que muestra los primeros 5 y "Ver los N". */
function Lista<T>({ items, fila }: { items: T[]; fila: (item: T) => ReactNode }) {
  const [todos, setTodos] = useState(false);
  const total = items.length;
  return (
    <Tarjeta className="divide-y divide-ink-100">
      {(todos ? items : items.slice(0, 5)).map(fila)}
      {total > 5 && <VerMas abierto={todos} total={total} onClick={() => setTodos(!todos)} />}
    </Tarjeta>
  );
}

function Atajo({ a, icono, texto }: { a: string; icono: ReactNode; texto: string }) {
  return (
    <Link to={a} className="flex items-center gap-3 px-4 py-3 active:bg-ink-50">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600">{icono}</span>
      <span className="min-w-0 flex-1 font-semibold">{texto}</span>
      <ChevronRight size={18} className="shrink-0 text-ink-300" />
    </Link>
  );
}

/** Un alumno a quien escribirle: WhatsApp con el texto listo, o "ya le avisé". */
function FilaAviso(p: { alumno: Alumno; clave: ClaveAviso; mensaje: ClaveMensaje; datos: Record<string, string>; detalle: string; urgente?: boolean; avisoReciente?: boolean }) {
  const { academia } = useSesion();
  const avisar = useAvisos();
  const esAdeudo = p.clave === 'adeudo';
  const nombre1 = p.alumno.nombre.split(' ')[0];
  const texto = armarMensaje(plantilla(academia, p.mensaje), { nombre: nombre1, academia: academia.nombre, codigo: p.alumno.codigo, ...p.datos });
  const link = waLink(p.alumno.telefono, texto);
  const hecho = async () => {
    await marcarAvisado(p.alumno, p.clave);
    avisar(`Listo: ${nombre1}`, 'ok', { texto: 'Deshacer', fn: () => quitarAviso(p.alumno.id, p.clave) });
  };
  return (
    <div className="flex items-center gap-2 py-2 pr-2 pl-3">
      <Link to={`/alumnos/${p.alumno.id}${esAdeudo ? '#adeudos' : ''}`} className="flex min-w-0 flex-1 items-center gap-3 rounded-xl py-1 text-left active:bg-ink-50">
        <Avatar nombre={p.alumno.nombre} foto={p.alumno.foto} tam={40} />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold">{p.alumno.nombre}</span>
          {/* hasta 2 renglones: con los dos botones al lado se cortaba justo "venció hace 7 días" */}
          <span className={p.urgente ? 'line-clamp-2 text-xs font-semibold text-bad-600' : 'line-clamp-2 text-xs text-ink-500'}>{p.detalle}</span>
          {esAdeudo && <span className="block text-xs font-semibold text-brand-600">Ver adeudo</span>}
          {!link && !p.avisoReciente && <span className="block text-[11px] text-ink-500">Sin teléfono: avísale en persona</span>}
        </span>
      </Link>
      {p.avisoReciente ? (
        <span className="shrink-0 rounded-xl bg-ok-50 px-2 py-1 text-xs font-semibold text-ok-600">Avisado</span>
      ) : (
        <>
          {link && (
            <a
              href={link}
              target="_blank"
              rel="noreferrer"
              className="flex h-11 shrink-0 items-center gap-1.5 rounded-xl bg-ok-600 px-3 text-sm font-bold text-white active:brightness-95"
              aria-label={`Mandar WhatsApp a ${p.alumno.nombre}`}
            >
              <MessageCircle size={18} /> <span className="hidden sm:inline">WhatsApp</span>
            </a>
          )}
          <button onClick={() => void hecho()} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-ink-500 ring-1 ring-ink-100 active:bg-ink-50" aria-label={`Ya le avisé a ${p.alumno.nombre}`}>
            <Check size={20} />
          </button>
        </>
      )}
    </div>
  );
}
