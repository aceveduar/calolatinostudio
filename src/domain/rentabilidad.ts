/**
 * Cuánto deja cada clase en el mes: lo que entra contra lo que se le paga al maestro.
 * Funciones puras, sin UI.
 *
 * Lo que entra por clase:
 *  · clase suelta (o fiado ya pagado): lo cobrado en esa entrada;
 *  · con plan: el precio del plan repartido entre sus clases (paquete: entre las clases que incluye;
 *    mensualidad: entre las que de verdad tomó), así cada clase recibe su parte de la mensualidad;
 *  · maestros que rentan el salón: su renta del mes, repartida entre sus clases.
 * Lo que cuesta: los pagos a maestros registrados en Gastos (con el maestro elegido), repartidos
 * entre sus clases del mes según las veces que se dieron. Renta del local, luz, etc. no se reparten.
 */
import type { Asistencia, Clase, Gasto, GastoFijo, ID, Membresia, Pago, Renta } from '../db/types';
import { montoDelMes } from './agenda';
import { rangoMes, type Mes } from './gastos';

export interface FilaRentable {
  clase: Clase;
  /** días distintos en que se dio (con al menos una entrada) */
  sesiones: number;
  asistencias: number;
  ingresos: number;
  /** renta del maestro que da la clase (si renta el salón) */
  renta: number;
  costo: number;
  ganancia: number;
  /** su maestro no tiene pagos registrados ni fijos este mes */
  sinCosto: boolean;
  /** el pago al maestro aún no se registra este mes: se usa su gasto fijo */
  estimado: boolean;
}

export interface Rentabilidad {
  filas: FilaRentable[];
  /** pagos a maestros sin maestro elegido: no se pueden repartir */
  sinAsignar: number;
}

const viva = (a: Asistencia) => !a.anuladaAt && !a.deletedAt;

export function rentabilidadPorClase(p: {
  mes: Mes;
  clases: Clase[];
  /** asistencias del mes y de meses previos (para saber cuántas clases cubrió cada mensualidad) */
  asistencias: Asistencia[];
  membresias: Membresia[];
  /** los pagos de esas asistencias y membresías */
  pagos: Pago[];
  gastos: Gasto[];
  /** pagos fijos a maestros: si aún no se registra el de este mes, se estima con él */
  fijos?: GastoFijo[];
  rentas: Renta[];
}): Rentabilidad {
  const { desde, hasta } = rangoMes(p.mes);
  const enMes = (f: string) => f >= desde && f <= hasta;
  const monto = new Map(p.pagos.filter((x) => !x.anuladoAt && !x.deletedAt).map((x) => [x.id, x.monto]));
  const asis = p.asistencias.filter(viva);

  // valor de una clase tomada con cada plan
  const usadas = new Map<ID, number>();
  for (const a of asis) if (a.membresiaId) usadas.set(a.membresiaId, (usadas.get(a.membresiaId) ?? 0) + 1);
  const valorClase = new Map<ID, number>();
  for (const m of p.membresias) {
    if (m.anuladaAt || m.deletedAt) continue;
    const divisor = m.clasesTotal ?? usadas.get(m.id) ?? 0;
    valorClase.set(m.id, divisor ? (monto.get(m.pagoId) ?? 0) / divisor : 0);
  }

  const delMes = asis.filter((a) => enMes(a.fecha));
  const porClase = new Map<ID, { fechas: Set<string>; n: number; ingresos: number }>();
  for (const a of delMes) {
    const v = porClase.get(a.claseId) ?? { fechas: new Set<string>(), n: 0, ingresos: 0 };
    v.fechas.add(a.fecha);
    v.n++;
    v.ingresos += a.membresiaId ? (valorClase.get(a.membresiaId) ?? 0) : a.pagoId ? (monto.get(a.pagoId) ?? 0) : 0;
    porClase.set(a.claseId, v);
  }
  const dadas = p.clases.filter((c) => porClase.has(c.id));

  // reparto por maestro según las sesiones de sus clases
  const sesionesMaestro = new Map<ID, number>();
  for (const c of dadas) if (c.maestroId) sesionesMaestro.set(c.maestroId, (sesionesMaestro.get(c.maestroId) ?? 0) + porClase.get(c.id)!.fechas.size);

  const pagoMaestro = new Map<ID, number>();
  let sinAsignar = 0;
  for (const g of p.gastos) {
    if (g.deletedAt || g.categoria !== 'maestros' || !enMes(g.fecha)) continue;
    if (g.maestroId) pagoMaestro.set(g.maestroId, (pagoMaestro.get(g.maestroId) ?? 0) + g.monto);
    else sinAsignar += g.monto;
  }

  // aún no se le paga este mes (p. ej. se le paga el 15): se estima con su pago fijo
  const estimados = new Set<ID>();
  for (const f of p.fijos ?? []) {
    if (f.deletedAt || !f.activo || f.categoria !== 'maestros' || !f.maestroId || pagoMaestro.has(f.maestroId)) continue;
    if (p.gastos.some((g) => !g.deletedAt && g.fijoId === f.id && enMes(g.fecha))) continue;
    estimados.add(f.maestroId);
    pagoMaestro.set(f.maestroId, f.monto);
  }

  const rentaMaestro = new Map<ID, number>();
  const ctx = { asistencias: delMes, clases: p.clases };
  for (const r of p.rentas) {
    if (r.deletedAt || !r.maestroId || r.tipo !== 'mensual' || r.desde > hasta || (r.hasta && r.hasta < desde)) continue;
    rentaMaestro.set(r.maestroId, (rentaMaestro.get(r.maestroId) ?? 0) + montoDelMes(r, p.mes, ctx).monto);
  }

  const filas = dadas.map((clase) => {
    const v = porClase.get(clase.id)!;
    const sesiones = v.fechas.size;
    const parte = clase.maestroId ? sesiones / (sesionesMaestro.get(clase.maestroId) || 1) : 0;
    // en pesos cerrados: es para decidir, no para cuadrar centavos
    const pesos = (c: number) => Math.round(c / 100) * 100;
    const costo = pesos((clase.maestroId ? (pagoMaestro.get(clase.maestroId) ?? 0) : 0) * parte);
    const renta = pesos((clase.maestroId ? (rentaMaestro.get(clase.maestroId) ?? 0) : 0) * parte);
    const ingresos = pesos(v.ingresos) + renta;
    return {
      clase,
      sesiones,
      asistencias: v.n,
      ingresos,
      renta,
      costo,
      ganancia: ingresos - costo,
      sinCosto: !!clase.maestroId && !pagoMaestro.has(clase.maestroId) && !rentaMaestro.has(clase.maestroId),
      estimado: !!clase.maestroId && estimados.has(clase.maestroId),
    };
  });
  return { filas: filas.sort((a, b) => b.ganancia - a.ganancia), sinAsignar };
}
