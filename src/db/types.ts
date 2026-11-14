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
  /** Logo de la academia como imagen PNG/JPEG en data URL (reducida a ≤256 px). */
  logo?: string | null;
  /** Textos de WhatsApp personalizados por la academia (clave → plantilla). */
  mensajes?: Record<string, string> | null;
  /** Nombre del lugar principal (las demás sedes están en `sedes`). */
  sedePrincipal?: string | null;
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
}

export type Rol = 'dueno' | 'recepcion' | 'maestro';

export const NOMBRE_ROL: Record<Rol, string> = { dueno: 'Dueño', recepcion: 'Recepción', maestro: 'Maestro' };

export interface Usuario extends Base {
  nombre: string;
  rol: Rol;
  /** Solo rol 'maestro': qué maestro del catálogo es (ve únicamente sus clases). */
  maestroId?: ID | null;
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

/**
 * Lugar donde se dan clases (Estudio, Casa de Cultura…). El lugar principal NO es un registro:
 * `sedeId = null` significa "sede principal". Así una academia de un solo lugar no nota nada.
 */
export interface Sede extends Base {
  nombre: string;
  color: string;
  activo: boolean;
}

export interface Clase extends Base {
  /** null = sede principal */
  sedeId?: ID | null;
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
  /** null = sirve en todas las sedes */
  sedeId?: ID | null;
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

export type CategoriaProducto = 'consumo' | 'articulo';

/**
 * Producto de la tienda. Las existencias no se guardan como "quedan N" (se pisaría entre equipos):
 * se guarda cuántas había en un momento (`inventario` a las `inventarioAt`) y se restan las ventas posteriores.
 */
export interface Producto extends Base {
  nombre: string;
  precio: number; // centavos
  emoji: string;
  foto: string | null;
  categoria: CategoriaProducto;
  descripcion: string;
  /** null = sin control de existencias */
  inventario: number | null;
  inventarioAt: number | null;
  /** avisar cuando queden esta cantidad o menos */
  alerta: number;
  activo: boolean;
  /** visible en la tienda en línea (próximamente) */
  enLinea: boolean;
}

export interface Alumno extends Base {
  nombre: string;
  telefono: string;
  notas: string;
  codigo: string;
  activo: boolean;
}

export interface Membresia extends Base {
  /** copiado del plan al venderlo; null = todas las sedes */
  sedeId?: ID | null;
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
  /** dónde se cobró; null = sede principal */
  sedeId?: ID | null;
  alumnoId: ID | null;
  planId: ID | null;
  /** venta de tienda: qué producto y cuántas piezas */
  productoId?: ID | null;
  cantidad?: number | null;
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
  /** corte de caja de esta sede; null = sede principal */
  sedeId?: ID | null;
  fecha: Fecha;
  esperadoEfectivo: number;
  contadoEfectivo: number;
  diferencia: number;
  totalOtros: number;
  usuarioId: ID;
  notas: string;
}

export type CategoriaGasto = 'renta' | 'luz' | 'agua' | 'internet' | 'maestros' | 'limpieza' | 'otro';

/** Gasto que se repite cada mes (renta, luz, internet). El monto es el estimado; se confirma al registrarlo. */
export interface GastoFijo extends Base {
  /** null = sede principal */
  sedeId?: ID | null;
  concepto: string;
  categoria: CategoriaGasto;
  monto: number;
  /** día del mes en que se paga (1–28) */
  dia: number;
  activo: boolean;
}

/** Salida de dinero de la academia. */
export interface Gasto extends Base {
  /** null = sede principal */
  sedeId?: ID | null;
  concepto: string;
  categoria: CategoriaGasto;
  monto: number;
  fecha: Fecha;
  /** si viene de un gasto fijo, cuál (para saber qué falta pagar en el mes) */
  fijoId: ID | null;
  metodo: MetodoPago;
  notas: string;
  usuarioId: ID;
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
  sedes: Sede;
  usuarios: Usuario;
  disciplinas: Disciplina;
  maestros: Maestro;
  clases: Clase;
  planes: Plan;
  productos: Producto;
  alumnos: Alumno;
  membresias: Membresia;
  pagos: Pago;
  asistencias: Asistencia;
  cortes: Corte;
  gastosFijos: GastoFijo;
  gastos: Gasto;
}

export type SyncTable = keyof TablaMap;

export const SYNC_TABLES: SyncTable[] = [
  'academias',
  'sedes',
  'usuarios',
  'disciplinas',
  'maestros',
  'clases',
  'planes',
  'productos',
  'alumnos',
  'membresias',
  'pagos',
  'asistencias',
  'cortes',
  'gastosFijos',
  'gastos',
];
