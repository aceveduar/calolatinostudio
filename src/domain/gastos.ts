/**
 * Gastos y utilidad. Los gastos fijos (renta, luz, internet) se registran una vez al mes con un toque;
 * la utilidad es lo cobrado en el mes menos lo gastado, por sede o en total.
 */
import { crear } from '../db/repo';
import type { CategoriaGasto, Fecha, Gasto, GastoFijo, ID, MetodoPago, Pago } from '../db/types';
import { conSede } from './sedes';

export const CATEGORIAS: { valor: CategoriaGasto; texto: string; emoji: string }[] = [
  { valor: 'renta', texto: 'Renta', emoji: '🏠' },
  { valor: 'luz', texto: 'Luz', emoji: '💡' },
  { valor: 'agua', texto: 'Agua', emoji: '🚰' },
  { valor: 'internet', texto: 'Internet', emoji: '📶' },
  { valor: 'maestros', texto: 'Maestros', emoji: '💃' },
  { valor: 'limpieza', texto: 'Limpieza', emoji: '🧽' },
  { valor: 'otro', texto: 'Otro', emoji: '🧾' },
];
export const categoria = (c: CategoriaGasto) => CATEGORIAS.find((x) => x.valor === c) ?? CATEGORIAS[CATEGORIAS.length - 1];

/** 'YYYY-MM' */
export type Mes = string;
export const mesDe = (f: Fecha): Mes => f.slice(0, 7);
export function rangoMes(mes: Mes): { desde: Fecha; hasta: Fecha } {
  const [y, m] = mes.split('-').map(Number);
  const ultimo = new Date(y, m, 0).getDate();
  return { desde: `${mes}-01`, hasta: `${mes}-${String(ultimo).padStart(2, '0')}` };
}
export function sumarMes(mes: Mes, n: number): Mes {
  const [y, m] = mes.split('-').map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
export function nombreMes(mes: Mes): string {
  const [y, m] = mes.split('-').map(Number);
  const t = new Date(y, m - 1, 1).toLocaleDateString('es-MX', { month: 'long', year: 'numeric' });
  return t.charAt(0).toUpperCase() + t.slice(1);
}
/** Fecha en que toca pagar un gasto fijo en ese mes. */
export const fechaDeFijo = (f: Pick<GastoFijo, 'dia'>, mes: Mes): Fecha => `${mes}-${String(Math.min(28, Math.max(1, f.dia))).padStart(2, '0')}`;

const vivo = <T extends { deletedAt: number | null }>(x: T) => !x.deletedAt;

export interface EstadoFijo {
  fijo: GastoFijo;
  /** gasto registrado este mes para este fijo (si ya se pagó) */
  pagado: Gasto | null;
  fecha: Fecha;
}

/** Qué gastos fijos ya se registraron en el mes y cuáles faltan. */
export function estadoFijos(fijos: GastoFijo[], gastos: Gasto[], mes: Mes): EstadoFijo[] {
  const { desde, hasta } = rangoMes(mes);
  return fijos
    .filter((f) => vivo(f) && f.activo)
    .map((fijo) => ({
      fijo,
      pagado: gastos.find((g) => vivo(g) && g.fijoId === fijo.id && g.fecha >= desde && g.fecha <= hasta) ?? null,
      fecha: fechaDeFijo(fijo, mes),
    }))
    .sort((a, b) => Number(!!a.pagado) - Number(!!b.pagado) || a.fijo.dia - b.fijo.dia || a.fijo.concepto.localeCompare(b.fijo.concepto));
}

export interface ResumenMes {
  ingresos: number;
  tienda: number;
  gastos: number;
  utilidad: number;
  /** de mayor a menor */
  porCategoria: { categoria: CategoriaGasto; monto: number }[];
  /** gastos fijos del mes que aún no se registran (estimado) */
  pendiente: number;
}

export function resumenMes(p: { mes: Mes; pagos: Pago[]; gastos: Gasto[]; fijos: GastoFijo[] }): ResumenMes {
  const { desde, hasta } = rangoMes(p.mes);
  const enMes = (f: Fecha) => f >= desde && f <= hasta;
  const pagos = p.pagos.filter((x) => vivo(x) && !x.anuladoAt && enMes(x.fecha));
  const gastos = p.gastos.filter((g) => vivo(g) && enMes(g.fecha));
  const ingresos = pagos.reduce((s, x) => s + x.monto, 0);
  const total = gastos.reduce((s, g) => s + g.monto, 0);
  const cats = new Map<CategoriaGasto, number>();
  for (const g of gastos) cats.set(g.categoria, (cats.get(g.categoria) ?? 0) + g.monto);
  return {
    ingresos,
    tienda: pagos.filter((x) => x.productoId).reduce((s, x) => s + x.monto, 0),
    gastos: total,
    utilidad: ingresos - total,
    porCategoria: [...cats.entries()].map(([categoria, monto]) => ({ categoria, monto })).sort((a, b) => b.monto - a.monto),
    pendiente: estadoFijos(p.fijos, p.gastos, p.mes)
      .filter((e) => !e.pagado)
      .reduce((s, e) => s + e.fijo.monto, 0),
  };
}

export function registrarGasto(p: {
  concepto: string;
  categoria: CategoriaGasto;
  monto: number;
  fecha: Fecha;
  metodo: MetodoPago;
  sedeId: ID | null;
  fijoId?: ID | null;
  eventoId?: ID | null;
  maestroId?: ID | null;
  notas?: string;
  usuarioId: ID;
}): Promise<Gasto> {
  if (!(p.monto > 0)) throw new Error('El monto debe ser mayor a cero');
  if (!p.concepto.trim()) throw new Error('Falta el concepto');
  return crear('gastos', {
    ...conSede(p.sedeId),
    concepto: p.concepto.trim(),
    categoria: p.categoria,
    monto: p.monto,
    fecha: p.fecha,
    fijoId: p.fijoId ?? null,
    metodo: p.metodo,
    notas: (p.notas ?? '').trim(),
    usuarioId: p.usuarioId,
    ...(p.eventoId ? { eventoId: p.eventoId } : {}),
    ...(p.maestroId ? { maestroId: p.maestroId } : {}),
  });
}
