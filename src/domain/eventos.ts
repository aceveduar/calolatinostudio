/**
 * Eventos de la academia: cupo, venta de boletos, lista de entrada y su propio dinero
 * (ingresos por boletos − gastos del evento). El evento aparta el salón con una renta interna de $0,
 * así la agenda lo muestra y nadie más puede rentar ese horario.
 */
import { db } from '../db/db';
import { actualizar, crear, enTransaccion } from '../db/repo';
import type { Boleto, Evento, Gasto, ID, MetodoPago, Pago } from '../db/types';
import { diaSemana } from './agenda';
import { hoy } from './fechas';
import { conSede } from './sedes';

const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function codigoBoleto(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) => ALFABETO[b % ALFABETO.length]).join('');
}

const vivo = <T extends { deletedAt: number | null }>(x: T) => !x.deletedAt;
export const boletoValido = (b: Boleto) => vivo(b) && !b.anuladoAt;

export type DatosEvento = Pick<Evento, 'nombre' | 'fecha' | 'horaInicio' | 'duracionMin' | 'cupo' | 'precio' | 'descripcion' | 'enPagina' | 'enPortal' | 'vestimenta' | 'lugar' | 'direccion' | 'foto'> & {
  salonId: ID | null;
  /** en otra sede (null = aquí) */
  sedeId: ID | null;
};

/** El evento es en el salón de la academia (no en otra sede ni en otro lugar): entonces lo aparta en la agenda. */
export const enElSalon = (e: Pick<DatosEvento, 'sedeId' | 'lugar'>) => !e.sedeId && !e.lugar?.trim();

/** Renta interna que aparta el salón ese día y horario. */
function rentaDe(e: DatosEvento) {
  return {
    nombre: e.nombre,
    telefono: '',
    tipo: 'evento' as const,
    dias: [diaSemana(e.fecha)],
    horaInicio: e.horaInicio,
    duracionMin: e.duracionMin,
    desde: e.fecha,
    hasta: e.fecha,
    monto: 0,
    notas: 'Evento de la academia',
    activo: true,
    ...(e.salonId ? { salonId: e.salonId } : {}),
  };
}

/** Lo que se guarda del evento: sin la sede si es aquí (y sin quitarla si antes tenía). */
function campos(e: DatosEvento, anterior?: Evento) {
  const { sedeId, ...resto } = e;
  return { ...resto, ...conSede(sedeId, anterior?.sedeId) };
}

export function crearEvento(e: DatosEvento): Promise<Evento> {
  return enTransaccion(async () => {
    const id = crypto.randomUUID();
    // en otra sede u otro lugar no se aparta el salón de aquí
    const renta = enElSalon(e) ? await crear('rentas', { ...rentaDe(e), eventoId: id }) : null;
    return crear('eventos', { id, ...campos(e), activo: true, rentaId: renta?.id ?? null });
  });
}

export function actualizarEvento(ev: Evento, e: DatosEvento): Promise<void> {
  return enTransaccion(async () => {
    const aqui = enElSalon(e);
    let rentaId = ev.rentaId;
    if (aqui && rentaId) await actualizar('rentas', rentaId, { ...rentaDe(e), activo: true, ...(e.salonId ? {} : { salonId: null }) });
    else if (aqui) rentaId = (await crear('rentas', { ...rentaDe(e), eventoId: ev.id })).id;
    // se cambió a otro lugar: el salón de aquí queda libre
    else if (rentaId) await actualizar('rentas', rentaId, { activo: false });
    await actualizar('eventos', ev.id, { ...campos(e, ev), rentaId: aqui ? rentaId : ev.rentaId });
  });
}

/** Cancelar el evento libera el salón; lo cobrado se conserva (si hay que devolver, se anulan los cobros). */
export function cancelarEvento(ev: Evento): Promise<void> {
  return enTransaccion(async () => {
    await actualizar('eventos', ev.id, { activo: false });
    if (ev.rentaId) await actualizar('rentas', ev.rentaId, { activo: false });
  });
}

export async function venderBoletos(p: {
  evento: Evento;
  nombre: string;
  telefono: string;
  alumnoId?: ID | null;
  cantidad: number;
  metodo: MetodoPago;
  usuarioId: ID;
}): Promise<{ pago: Pago; boletos: Boleto[] }> {
  if (p.cantidad < 1) throw new Error('Al menos un boleto');
  if (!p.nombre.trim()) throw new Error('Falta el nombre');
  return enTransaccion(async () => {
    const vendidos = (await db.boletos.where('eventoId').equals(p.evento.id).toArray()).filter(boletoValido).length;
    if (p.evento.cupo !== null && vendidos + p.cantidad > p.evento.cupo) {
      const quedan = Math.max(0, p.evento.cupo - vendidos);
      throw new Error(quedan ? `Solo quedan ${quedan} lugares` : 'Ya no hay lugares: el cupo está lleno');
    }
    const pago = await crear('pagos', {
      ...conSede(p.evento.sedeId),
      alumnoId: p.alumnoId ?? null,
      planId: null,
      eventoId: p.evento.id,
      cantidad: p.cantidad,
      concepto: `Boleto · ${p.evento.nombre}`,
      monto: p.evento.precio * p.cantidad,
      metodo: p.metodo,
      usuarioId: p.usuarioId,
      fecha: hoy(),
      anuladoAt: null,
      anuladoMotivo: null,
      anuladoPor: null,
    });
    const boletos: Boleto[] = [];
    for (let i = 0; i < p.cantidad; i++) {
      boletos.push(
        await crear('boletos', {
          eventoId: p.evento.id,
          nombre: p.cantidad > 1 ? `${p.nombre.trim()} (${i + 1}/${p.cantidad})` : p.nombre.trim(),
          telefono: p.telefono.replace(/\D/g, ''),
          alumnoId: p.alumnoId ?? null,
          pagoId: pago.id,
          codigo: codigoBoleto(),
          usadoAt: null,
          anuladoAt: null,
        }),
      );
    }
    return { pago, boletos };
  });
}

/** Cancela una venta: anula el cobro y sus boletos (libera los lugares). */
export function cancelarVenta(pagoId: ID, motivo: string, usuarioId: ID): Promise<void> {
  return enTransaccion(async () => {
    const ahora = Date.now();
    await actualizar('pagos', pagoId, { anuladoAt: ahora, anuladoMotivo: motivo, anuladoPor: usuarioId });
    for (const b of await db.boletos.filter((x) => x.pagoId === pagoId && !x.anuladoAt).toArray()) await actualizar('boletos', b.id, { anuladoAt: ahora });
  });
}

export function marcarEntrada(boletoId: ID, entro: boolean) {
  return actualizar('boletos', boletoId, { usadoAt: entro ? Date.now() : null });
}

export interface ResumenEvento {
  vendidos: number;
  entraron: number;
  ingresos: number;
  gastos: number;
  utilidad: number;
  quedan: number | null;
}

export function resumenEvento(ev: Evento, boletos: Boleto[], pagos: Pago[], gastos: Gasto[]): ResumenEvento {
  const validos = boletos.filter(boletoValido);
  const ingresos = pagos.filter((p) => p.eventoId === ev.id && vivo(p) && !p.anuladoAt).reduce((s, p) => s + p.monto, 0);
  const g = gastos.filter((x) => x.eventoId === ev.id && vivo(x)).reduce((s, x) => s + x.monto, 0);
  return {
    vendidos: validos.length,
    entraron: validos.filter((b) => b.usadoAt).length,
    ingresos,
    gastos: g,
    utilidad: ingresos - g,
    quedan: ev.cupo === null ? null : Math.max(0, ev.cupo - validos.length),
  };
}
