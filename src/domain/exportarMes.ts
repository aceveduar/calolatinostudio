/**
 * El mes en Excel, para el contador: Resumen, Cobros, Gastos y Cortes de caja.
 * Puro: arma las hojas (filas y celdas con su tipo); app/xlsxEscribir.ts las convierte en el archivo.
 * El dinero va como número (pesos) con formato de moneda y las fechas como fecha de Excel, para que el
 * contador pueda sumar, filtrar y ordenar.
 */
import type { Corte, Gasto, ID, MetodoPago, Pago } from '../db/types';
import { CATEGORIAS, nombreMes, rangoMes, type Mes } from './gastos';
import { horaDe } from './fechas';

export type Celda =
  | string
  | number
  | null
  | { t: 'dinero'; v: number } // centavos
  | { t: 'total'; v: number } // centavos, en negritas
  | { t: 'fecha'; v: string } // YYYY-MM-DD
  | { t: 'negrita'; v: string }
  | { t: 'titulo'; v: string };

export interface HojaXlsx {
  nombre: string;
  /** ancho de cada columna, en caracteres */
  anchos: number[];
  filas: Celda[][];
  /** la primera fila son títulos de columna: se fija al bajar y lleva filtros */
  conEncabezado: boolean;
}

const METODO: Record<MetodoPago, string> = { efectivo: 'Efectivo', transferencia: 'Transferencia', tarjeta: 'Tarjeta' };
const dinero = (v: number): Celda => ({ t: 'dinero', v });
const fecha = (v: string): Celda => ({ t: 'fecha', v });
const vivo = (x: { deletedAt?: number | null }) => !x.deletedAt;

export interface DatosMes {
  academia: string;
  mes: Mes;
  /** "Sede Centro" si se exporta una sola sede; null = todas */
  sede: string | null;
  pagos: Pago[];
  gastos: Gasto[];
  cortes: Corte[];
  nombres: {
    alumno: (id: ID | null) => string;
    usuario: (id: ID) => string;
    /** null = no hay sedes: no se agrega la columna */
    sede: ((id: ID | null | undefined) => string) | null;
  };
  generado: number;
}

export function hojasDelMes(d: DatosMes): HojaXlsx[] {
  const { desde, hasta } = rangoMes(d.mes);
  const enMes = (f: string) => f >= desde && f <= hasta;
  const porFecha = <T extends { fecha: string; createdAt: number }>(a: T, b: T) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : a.createdAt - b.createdAt);
  const todos = d.pagos.filter((p) => vivo(p) && enMes(p.fecha));
  const pagos = todos.filter((p) => !p.anuladoAt).sort(porFecha);
  const anulados = todos.filter((p) => p.anuladoAt);
  const gastos = d.gastos.filter((g) => vivo(g) && enMes(g.fecha)).sort(porFecha);
  const cortes = d.cortes.filter((c) => vivo(c) && enMes(c.fecha)).sort(porFecha);
  const sede = d.nombres.sede;
  const conSede = (fila: Celda[], id: ID | null | undefined): Celda[] => (sede ? [...fila, sede(id)] : fila);
  const titulos = (t: string[]): Celda[] => (sede ? [...t, 'Sede'] : t);
  /** fila de total: "Total" en la primera columna y la suma en la columna `col` */
  const filaTotal = (ancho: number, col: number, v: number): Celda[] => Array.from({ length: ancho + (sede ? 1 : 0) }, (_, i) => (i === 0 ? { t: 'negrita', v: 'Total' } : i === col ? { t: 'total', v } : null));
  const suma = (xs: { monto: number }[]) => xs.reduce((s, x) => s + x.monto, 0);

  // ---------- Resumen ----------
  const ingresos = suma(pagos);
  const totalGastos = suma(gastos);
  const resumen: Celda[][] = [
    [{ t: 'titulo', v: `${d.academia} · ${nombreMes(d.mes)}` }],
    [d.sede ? `Solo ${d.sede}` : null],
    [],
    [{ t: 'negrita', v: 'Ingresos' }],
    ...(['efectivo', 'transferencia', 'tarjeta'] as const).map((m) => [METODO[m], dinero(suma(pagos.filter((p) => p.metodo === m)))]),
    [{ t: 'negrita', v: 'Total de ingresos' }, { t: 'total', v: ingresos }],
    [],
    [{ t: 'negrita', v: 'Gastos' }],
    ...CATEGORIAS.map((c) => ({ c, monto: suma(gastos.filter((g) => g.categoria === c.valor)) }))
      .filter((x) => x.monto > 0)
      .map((x) => [x.c.texto, dinero(x.monto)]),
    [{ t: 'negrita', v: 'Total de gastos' }, { t: 'total', v: totalGastos }],
    [],
    [{ t: 'negrita', v: 'Utilidad (ingresos − gastos)' }, { t: 'total', v: ingresos - totalGastos }],
    [],
    [`${pagos.length} cobros · ${gastos.length} gastos · ${cortes.length} cortes de caja`],
  ];
  if (anulados.length) resumen.push([`${anulados.length} cobro${anulados.length === 1 ? '' : 's'} anulado${anulados.length === 1 ? '' : 's'} (no se cuentan)`, dinero(suma(anulados))]);
  resumen.push([`Generado el ${new Date(d.generado).toLocaleDateString('es-MX')} a las ${horaDe(d.generado)} con Compás`]);

  // ---------- Cobros ----------
  const cobros: Celda[][] = [
    titulos(['Fecha', 'Hora', 'Alumno', 'Concepto', 'Método', 'Monto', 'Cobró']),
    ...pagos.map((p) => conSede([fecha(p.fecha), horaDe(p.createdAt), d.nombres.alumno(p.alumnoId), p.concepto, METODO[p.metodo], dinero(p.monto), d.nombres.usuario(p.usuarioId)], p.sedeId)),
    filaTotal(7, 5, ingresos),
  ];

  // ---------- Gastos ----------
  const cat = (v: string) => CATEGORIAS.find((c) => c.valor === v)?.texto ?? v;
  const gastosH: Celda[][] = [
    titulos(['Fecha', 'Concepto', 'Categoría', 'Método', 'Monto', 'Salió del cajón', 'Notas']),
    ...gastos.map((g) => conSede([fecha(g.fecha), g.concepto, cat(g.categoria), METODO[g.metodo], dinero(g.monto), g.deCaja ? 'Sí' : '', g.notas || ''], g.sedeId)),
    filaTotal(7, 4, totalGastos),
  ];

  // ---------- Cortes ----------
  const cortesH: Celda[][] = [
    titulos(['Fecha', 'Feria al abrir', 'Debía haber', 'Se contó', 'Diferencia', 'Salidas de efectivo', 'Otros métodos', 'Hizo el corte', 'Notas']),
    ...cortes.map((c) =>
      conSede(
        [fecha(c.fecha), c.fondo == null ? null : dinero(c.fondo), dinero(c.esperadoEfectivo), dinero(c.contadoEfectivo), dinero(c.diferencia), c.salidas == null ? null : dinero(c.salidas), dinero(c.totalOtros), d.nombres.usuario(c.usuarioId), c.notas || ''],
        c.sedeId,
      ),
    ),
  ];

  const extra = sede ? [16] : [];
  return [
    { nombre: 'Resumen', anchos: [34, 16], filas: resumen, conEncabezado: false },
    { nombre: 'Cobros', anchos: [11, 7, 28, 30, 14, 12, 14, ...extra], filas: cobros, conEncabezado: true },
    { nombre: 'Gastos', anchos: [11, 30, 12, 14, 12, 14, 30, ...extra], filas: gastosH, conEncabezado: true },
    { nombre: 'Cortes de caja', anchos: [11, 13, 13, 12, 12, 16, 14, 14, 30, ...extra], filas: cortesH, conEncabezado: true },
  ];
}

/** "Calo Latino Studio" + "2026-11" → "Calo-Latino-Studio-2026-11.xlsx" */
export function nombreArchivoMes(academia: string, mes: Mes): string {
  const base = academia
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `${base || 'Academia'}-${mes}.xlsx`;
}
