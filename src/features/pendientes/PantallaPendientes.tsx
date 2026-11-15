import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { Check, ChevronRight, Megaphone, MessageCircle, PackageCheck, PartyPopper, Truck, WalletCards } from 'lucide-react';
import { useClases, usePedidosPendientes, usePlanes } from '../../app/datos';
import { useSesion } from '../../app/sesion';
import { useAvisos } from '../../components/avisos';
import { Avatar, Encabezado, Seccion, Tarjeta, Vacio, VerMas } from '../../components/ui';
import { db } from '../../db/db';
import type { Alumno } from '../../db/types';
import { dinero } from '../../domain/dinero';
import { fechaCorta, fechaLarga, hoy, sumarDias } from '../../domain/fechas';
import { nombreMes, rangoMes, sumarMes, mesDe } from '../../domain/gastos';
import { armarMensaje, plantilla, type ClaveMensaje } from '../../domain/mensajes';
import { DIAS_ENTRE_COBROS, deudores, marcarAvisado, porExtranar, porRenovar, quitarAviso, rentasPorCobrar, type ClaveAviso } from '../../domain/pendientes';
import { waLink } from '../../domain/reportes';
import { useContadores } from '../../app/contadores';

/** Lee de la base lo necesario para calcular los pendientes. */
async function cargar(dia: string) {
  const inicioMesPasado = rangoMes(sumarMes(mesDe(dia), -1)).desde;
  const desde = [sumarDias(dia, -90), inicioMesPasado].sort()[0];
  const [mems, alumnos, asistencias, fiados, rentas, pagosRenta] = await Promise.all([
    db.membresias.where('fin').aboveOrEqual(sumarDias(dia, -7)).toArray(),
    db.alumnos.toArray(),
    db.asistencias.where('fecha').aboveOrEqual(desde).toArray(),
    // lo fiado puede ser de hace meses
    db.asistencias.filter((a) => !!a.debe && !a.pagoId).toArray(),
    db.rentas.toArray(),
    db.pagos.where('fecha').aboveOrEqual(inicioMesPasado).filter((p) => !!p.rentaId).toArray(),
  ]);
  return { mems, alumnos, asistencias, fiados, rentas, pagosRenta };
}

/**
 * Todo lo pendiente de hoy, para la pantalla y para el número en Entrada y en "Más".
 * `vivo`: se recalcula con cada cambio (pantalla de Pendientes). Si no, cada minuto y al volver a la app:
 * en Entrada no debe frenar los cobros (cada venta volvería a leer cientos de registros).
 */
export function usePendientes(vivo = true) {
  const dia = hoy();
  const clases = useClases();
  const planes = usePlanes();
  const porEntregar = usePedidosPendientes().length;
  const { interesados, encargos: porPedir } = useContadores();
  const enVivo = useLiveQuery(() => (vivo ? cargar(dia) : undefined), [dia, vivo]);
  const [foto, setFoto] = useState<Awaited<ReturnType<typeof cargar>>>();
  useEffect(() => {
    if (vivo) return;
    let activo = true;
    const leer = () => void cargar(dia).then((d) => activo && setFoto(d));
    leer();
    const t = setInterval(leer, 60_000);
    const alVolver = () => document.visibilityState === 'visible' && leer();
    document.addEventListener('visibilitychange', alVolver);
    return () => {
      activo = false;
      clearInterval(t);
      document.removeEventListener('visibilitychange', alVolver);
    };
  }, [dia, vivo]);
  const datos = vivo ? enVivo : foto;

  return useMemo(() => {
    if (!datos) return null;
    const porId = new Map(datos.alumnos.map((a) => [a.id, a]));
    const renovar = porRenovar({ mems: datos.mems, alumnos: porId, planes, hoy: dia });
    const deben = deudores({ asistencias: datos.fiados, alumnos: porId, clases, planes });
    const extranar = porExtranar({ asistencias: datos.asistencias, alumnos: porId, hoy: dia });
    const rentas = rentasPorCobrar({ rentas: datos.rentas, pagos: datos.pagosRenta, asistencias: datos.asistencias, clases, hoy: dia });
    const total = renovar.length + deben.length + extranar.length + rentas.length + interesados + porEntregar + porPedir;
    return { renovar, deben, extranar, rentas, interesados, porEntregar, porPedir, total };
  }, [datos, planes, clases, dia, interesados, porEntregar, porPedir]);
}

const cuandoVence = (n: number) =>
  n < 0 ? `venció hace ${-n} ${n === -1 ? 'día' : 'días'}` : n === 0 ? 'vence hoy' : n === 1 ? 'vence mañana' : `vence en ${n} días`;

/**
 * "Pendientes": a quién escribirle y qué cobrar hoy, todo junto.
 * Cada recordatorio se manda con un toque (WhatsApp con el texto listo) y sale de la lista.
 */
export function PantallaPendientes() {
  const p = usePendientes();
  if (!p) return null;
  const { renovar, deben, extranar, rentas, interesados, porEntregar, porPedir, total } = p;

  return (
    <div className="px-4 pb-8 lg:mx-auto lg:max-w-3xl">
      <div className="-mx-4">
        <Encabezado titulo="Pendientes" sub={total ? 'Lo que hay que hacer hoy' : fechaLarga(hoy())} />
      </div>

      {total === 0 && (
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
          <Lista total={renovar.length}>
            {renovar.map(({ alumno, membresia, plan, enDias }) => (
              <FilaAviso
                key={membresia.id}
                alumno={alumno}
                clave={`vence:${membresia.id}`}
                mensaje={enDias < 0 ? 'vencio' : 'vence'}
                datos={{ plan: (plan?.nombre ?? 'plan').toLowerCase(), vence: fechaLarga(membresia.fin) }}
                detalle={`${plan?.nombre ?? 'Plan'} · ${cuandoVence(enDias)}`}
                urgente={enDias < 0}
              />
            ))}
          </Lista>
        </Seccion>
      )}

      {deben.length > 0 && (
        <Seccion titulo={`Deben clases · ${deben.length}`}>
          <Lista total={deben.length}>
            {deben.map(({ alumno, clases, total: monto }) => (
              <FilaAviso
                key={alumno.id}
                alumno={alumno}
                clave="adeudo"
                mensaje="adeudo"
                datos={{ monto: dinero(monto) }}
                detalle={`${clases} ${clases === 1 ? 'clase' : 'clases'} · ${dinero(monto)}`}
                urgente
              />
            ))}
          </Lista>
          <p className="mt-2 px-1 text-xs text-ink-500">Se cobra en su ficha o cuando vuelva a entrar. Si ya le escribiste, vuelve a salir en {DIAS_ENTRE_COBROS} días.</p>
        </Seccion>
      )}

      {rentas.length > 0 && (
        <Seccion titulo={`Rentas por cobrar · ${rentas.length}`}>
          <Lista total={rentas.length}>
            {rentas.map((c) => (
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
            ))}
          </Lista>
        </Seccion>
      )}

      {extranar.length > 0 && (
        <Seccion titulo={`Dejaron de venir · ${extranar.length}`}>
          <Lista total={extranar.length}>
            {extranar.map(({ alumno, ultima, veces }) => (
              <FilaAviso key={alumno.id} alumno={alumno} clave="extrañamos" mensaje="extrañamos" datos={{}} detalle={`Venía seguido (${veces}) · última vez ${fechaCorta(ultima)}`} />
            ))}
          </Lista>
        </Seccion>
      )}

      {total > 0 && (
        <p className="mt-4 px-1 text-center text-xs leading-relaxed text-ink-500">
          Al mandar el WhatsApp (o tocar <Check size={12} className="inline" /> si ya le avisaste en persona) sale de la lista en todos los equipos.
        </p>
      )}
    </div>
  );
}

/** Tarjeta que muestra los primeros 5 y "Ver los N". */
function Lista({ total, children }: { total: number; children: ReactNode[] }) {
  const [todos, setTodos] = useState(false);
  return (
    <Tarjeta className="divide-y divide-ink-100">
      {todos ? children : children.slice(0, 5)}
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
function FilaAviso(p: { alumno: Alumno; clave: ClaveAviso; mensaje: ClaveMensaje; datos: Record<string, string>; detalle: string; urgente?: boolean }) {
  const { academia } = useSesion();
  const nav = useNavigate();
  const avisar = useAvisos();
  const nombre1 = p.alumno.nombre.split(' ')[0];
  const texto = armarMensaje(plantilla(academia, p.mensaje), { nombre: nombre1, academia: academia.nombre, codigo: p.alumno.codigo, ...p.datos });
  const link = waLink(p.alumno.telefono, texto);
  const hecho = async () => {
    await marcarAvisado(p.alumno, p.clave);
    avisar(`Listo: ${nombre1}`, 'ok', { texto: 'Deshacer', fn: () => quitarAviso(p.alumno.id, p.clave) });
  };
  return (
    <div className="flex items-center gap-2 py-2 pr-2 pl-3">
      <button onClick={() => nav(`/alumnos/${p.alumno.id}`)} className="flex min-w-0 flex-1 items-center gap-3 rounded-xl py-1 text-left active:bg-ink-50">
        <Avatar nombre={p.alumno.nombre} foto={p.alumno.foto} tam={40} />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold">{p.alumno.nombre}</span>
          <span className={p.urgente ? 'block truncate text-xs font-semibold text-bad-600' : 'block truncate text-xs text-ink-500'}>{p.detalle}</span>
        </span>
      </button>
      {link ? (
        <a
          href={link}
          target="_blank"
          rel="noreferrer"
          onClick={() => void hecho()}
          className="flex h-11 shrink-0 items-center gap-1.5 rounded-xl bg-ok-600 px-3 text-sm font-bold text-white active:brightness-95"
          aria-label={`Mandar WhatsApp a ${p.alumno.nombre}`}
        >
          <MessageCircle size={18} /> <span className="hidden sm:inline">WhatsApp</span>
        </a>
      ) : (
        <span className="shrink-0 px-1 text-[11px] leading-tight text-ink-500">sin teléfono</span>
      )}
      <button onClick={() => void hecho()} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-ink-500 ring-1 ring-ink-100 active:bg-ink-50" aria-label={`Ya le avisé a ${p.alumno.nombre}`}>
        <Check size={20} />
      </button>
    </div>
  );
}
