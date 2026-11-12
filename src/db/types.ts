/**
 * Modelo de datos. Todas las entidades sincronizables comparten `Base`.
 * - IDs UUID generados en el dispositivo (funciona offline sin colisiones).
 * - Montos en centavos (enteros) para evitar errores de punto flotante.
 * - Fechas de negocio como 'YYYY-MM-DD' en hora local; marcas de tiempo en ms.
 */
export type ID = string;
export type Fecha = string; // 'YYYY-MM-DD'

export interface Base {
  id: ID;
  academiaId: ID;
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
}

export interface Academia {
  id: ID;
  nombre: string;
  moneda: 'MXN';
  /** Color de marca elegido por la academia (hex). null = predeterminado */
  color?: string | null;
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
}

export type Rol = 'dueno' | 'recepcion';

export interface Usuario extends Base {
  nombre: string;
  rol: Rol;
  pinHash: string;
  activo: boolean;
}

export interface Disciplina extends Base {
  nombre: string;
  color: string;
}

export interface Maestro extends Base {
  nombre: string;
  telefono: string;
  notas: string;
  activo: boolean;
}

export interface Clase extends Base {
  disciplinaId: ID;
  nivel: string;
  maestroId: ID | null;
  /** @deprecated texto libre de la v1; se migra a `maestroId` */
  maestro?: string;
  /** 0 = domingo … 6 = sábado */
  dias: number[];
  horaInicio: string; // 'HH:mm'
  duracionMin: number;
  activo: boolean;
}

export type TipoPlan = 'suelta' | 'mensual' | 'paquete';

export interface Plan extends Base {
  nombre: string;
  tipo: TipoPlan;
  precio: number; // centavos
  /** null = ilimitadas */
  clases: number | null;
  /** null = no vence (solo aplica a 'suelta') */
  vigenciaDias: number | null;
  /** null = sirve para todas las disciplinas */
  disciplinaId: ID | null;
  activo: boolean;
}

export interface Alumno extends Base {
  nombre: string;
  telefono: string;
  notas: string;
  codigo: string;
  activo: boolean;
}

export interface Membresia extends Base {
  alumnoId: ID;
  planId: ID;
  pagoId: ID;
  disciplinaId: ID | null;
  inicio: Fecha;
  fin: Fecha;
  clasesTotal: number | null;
  anuladaAt: number | null;
}

export type MetodoPago = 'efectivo' | 'transferencia' | 'tarjeta';

export interface Pago extends Base {
  alumnoId: ID | null;
  planId: ID | null;
  concepto: string;
  monto: number; // centavos
  metodo: MetodoPago;
  usuarioId: ID;
  fecha: Fecha;
  anuladoAt: number | null;
  anuladoMotivo: string | null;
  anuladoPor: ID | null;
}

export interface Asistencia extends Base {
  alumnoId: ID | null;
  /** Para visitantes sin registro */
  nombreVisitante: string | null;
  claseId: ID;
  fecha: Fecha;
  membresiaId: ID | null;
  pagoId: ID | null;
  usuarioId: ID;
  anuladaAt: number | null;
}

export interface Corte extends Base {
  fecha: Fecha;
  esperadoEfectivo: number;
  contadoEfectivo: number;
  diferencia: number;
  totalOtros: number;
  usuarioId: ID;
  notas: string;
}

export interface OutboxItem {
  seq?: number;
  table: SyncTable;
  id: ID;
  at: number;
}

export interface Meta {
  key: string;
  value: unknown;
}

export interface TablaMap {
  academias: Academia;
  usuarios: Usuario;
  disciplinas: Disciplina;
  maestros: Maestro;
  clases: Clase;
  planes: Plan;
  alumnos: Alumno;
  membresias: Membresia;
  pagos: Pago;
  asistencias: Asistencia;
  cortes: Corte;
}

export type SyncTable = keyof TablaMap;

export const SYNC_TABLES: SyncTable[] = [
  'academias',
  'usuarios',
  'disciplinas',
  'maestros',
  'clases',
  'planes',
  'alumnos',
  'membresias',
  'pagos',
  'asistencias',
  'cortes',
];
