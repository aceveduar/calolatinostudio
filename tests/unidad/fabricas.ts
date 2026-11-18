// Registros de ejemplo con lo mínimo; cada prueba cambia solo lo que le importa.
import type { Alumno, Asistencia, Clase, Gasto, GastoFijo, Membresia, Pago, Plan } from '../../src/db/types';

const base = (id: string) => ({ id, academiaId: 'a1', createdAt: 0, updatedAt: 0, deletedAt: null });

export const clase = (id: string, x: Partial<Clase> = {}): Clase => ({
  ...base(id),
  disciplinaId: 'salsa',
  nivel: '1',
  maestroId: null,
  dias: [1, 3],
  horaInicio: '19:00',
  duracionMin: 60,
  activo: true,
  ...x,
});

export const plan = (id: string, x: Partial<Plan> = {}): Plan => ({
  ...base(id),
  nombre: id,
  tipo: 'suelta',
  precio: 6000,
  clases: 1,
  vigenciaDias: 1,
  disciplinaId: null,
  activo: true,
  ...x,
});

export const alumno = (id: string, x: Partial<Alumno> = {}): Alumno =>
  ({ ...base(id), nombre: id, telefono: '5512345678', activo: true, avisos: null, ...x }) as Alumno;

export const pago = (id: string, monto: number, x: Partial<Pago> = {}): Pago => ({
  ...base(id),
  alumnoId: null,
  planId: null,
  concepto: 'Clase suelta',
  monto,
  metodo: 'efectivo',
  usuarioId: 'u1',
  fecha: '2026-11-10',
  anuladoAt: null,
  anuladoMotivo: null,
  anuladoPor: null,
  ...x,
});

export const asistencia = (id: string, x: Partial<Asistencia> = {}): Asistencia => ({
  ...base(id),
  alumnoId: null,
  nombreVisitante: null,
  claseId: 'c1',
  fecha: '2026-11-10',
  membresiaId: null,
  pagoId: null,
  usuarioId: 'u1',
  anuladaAt: null,
  ...x,
});

export const membresia = (id: string, x: Partial<Membresia> = {}): Membresia => ({
  ...base(id),
  alumnoId: 'al1',
  planId: 'mensual',
  pagoId: 'p-' + id,
  disciplinaId: null,
  inicio: '2026-11-01',
  fin: '2026-11-30',
  clasesTotal: null,
  anuladaAt: null,
  ...x,
});

export const gasto = (id: string, monto: number, x: Partial<Gasto> = {}): Gasto => ({
  ...base(id),
  concepto: 'Pago maestro',
  categoria: 'maestros',
  monto,
  fecha: '2026-11-15',
  fijoId: null,
  metodo: 'efectivo',
  notas: '',
  usuarioId: 'u1',
  ...x,
});

export const fijo = (id: string, monto: number, x: Partial<GastoFijo> = {}): GastoFijo => ({
  ...base(id),
  concepto: 'Pago maestro',
  categoria: 'maestros',
  monto,
  dia: 15,
  activo: true,
  ...x,
});
