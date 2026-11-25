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
  /** recargo por día de atraso en mensualidades (centavos); vacío o 0 = sin recargo */
  recargoDiario?: number | null;
  /** meta de lo que deben dejar las rentas del salón por día (centavos), p. ej. $500 para cubrir la renta */
  metaDiaria?: number | null;
  /** salones extra del estudio (el principal no se lista); vacío = un solo salón */
  salones?: Salon[] | null;
  /** Nombre del lugar principal (las demás sedes están en `sedes`). */
  sedePrincipal?: string | null;
  /** dirección de la página pública: /a/<slug> (vacío = sin página pública) */
  slug?: string | null;
  /** WhatsApp de contacto que se muestra en la página pública */
  whatsapp?: string | null;
  /** contenido de la página pública (portada, frase, ubicación, preguntas, redes) */
  pagina?: ContenidoPagina | null;
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
}

/** Lo que la academia escribe para su página pública; todo es opcional. */
export interface ContenidoPagina {
  /** frase grande de la portada, p. ej. "Aprende a bailar salsa y bachata" */
  frase?: string;
  /** texto corto debajo de la frase */
  intro?: string;
  /** foto de portada: JPEG en data URL (reducida a ≤1280 px) */
  portada?: string | null;
  /** oferta de la primera clase, p. ej. "Tu primera clase es gratis" (vacío = precio de clase suelta) */
  primera?: string;
  /** dirección y referencias por sede ("principal" = el lugar principal) */
  ubicaciones?: Record<string, { direccion: string; referencias?: string }>;
  preguntas?: { p: string; r: string }[];
  redes?: { instagram?: string; facebook?: string; tiktok?: string; youtube?: string };
  /** fotos de clases y eventos (JPEG en data URL, ≤900 px) */
  galeria?: string[];
  /** crédito de las fotos si no son propias (p. ej. licencias Creative Commons) */
  creditos?: string;
  /** lo que dicen los alumnos */
  testimonios?: { texto: string; nombre: string; detalle?: string }[];
  /** aviso de privacidad propio (vacío = la base general de domain/privacidad.ts) */
  privacidad?: string;
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
export interface Salon {
  id: ID;
  nombre: string;
}

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
  /** precio de clase suelta propio (cada maestro pone su tarifa); vacío = el de la sede */
  precioSuelta?: number | null;
  /** salón del estudio; vacío = salón principal */
  salonId?: ID | null;
  /** clase por curso: desde cuándo y hasta cuándo, y cuántas semanas después de iniciar aún entran nuevos. Vacío = se entra cuando sea */
  curso?: { inicio: Fecha; fin?: Fecha | null; semanas?: number } | null;
  excepciones?: Record<Fecha, ExcepcionClase> | null;
}

export type ExcepcionClase = { cancelada: true } | { hora: string; sede: ID | null; salon: ID | null };

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
  /** mensual por clase: cuántas clases (grupos) cubre, p. ej. 1 = $300, 2 = $450; vacío = todas */
  grupos?: number | null;
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
  /** visible en el portal de alumnos, donde lo pueden apartar */
  enLinea: boolean;
  /** tallas o colores a elegir al apartar (vacío = sin opciones) */
  opciones?: string[] | null;
  /** código de barras (EAN/UPC) para cobrarlo escaneando */
  codigo?: string | null;
  /** sobre pedido: no hay existencias, se encarga al proveedor (p. ej. zapatillas por número y diseño) */
  sobrePedido?: boolean | null;
  /** días aproximados que tarda en llegar un encargo */
  diasEntrega?: number | null;
  /** lo que le cuesta a la academia cada pieza (centavos); solo lo ve la dirección */
  costo?: number | null;
}

/**
 * Evento de la academia (p. ej. fiesta de Día de Muertos, baile de diciembre): cupo, boletos y su propio dinero.
 * Aparta el salón con una renta interna (`rentaId`) para que la agenda y los empalmes lo tomen en cuenta.
 */
export interface Evento extends Base {
  sedeId?: ID | null;
  salonId?: ID | null;
  nombre: string;
  fecha: Fecha;
  horaInicio: string;
  duracionMin: number;
  /** null = sin límite */
  cupo: number | null;
  /** precio del boleto (centavos) */
  precio: number;
  descripcion: string;
  activo: boolean;
  rentaId: ID | null;
  /** dónde se anuncia (null/undefined = sí): la página pública y el portal de los alumnos. Un social avanzado
   *  puede no anunciarse a todos; recepción igual vende boletos a quien quiera. */
  enPagina?: boolean | null;
  enPortal?: boolean | null;
  /** cómo venir, si importa: "Ven disfrazado", "De blanco" (se ve resaltado en la página y el portal) */
  vestimenta?: string | null;
  /** en otro lugar (salón de fiestas, terraza…): nombre y dirección. Vacío = en la academia o en su sede. */
  lugar?: string | null;
  direccion?: string | null;
  /** flyer o foto del evento (WebP/JPEG en data URL, ≤1080 px): lo que más lo "vende" en la página y el portal */
  foto?: string | null;
}

/** Un boleto = una persona. Se venden juntos en un cobro (pagoId) y se marcan al entrar. */
export interface Boleto extends Base {
  eventoId: ID;
  nombre: string;
  telefono: string;
  alumnoId: ID | null;
  pagoId: ID | null;
  /** código corto para buscarlo en la entrada */
  codigo: string;
  usadoAt: number | null;
  anuladoAt: number | null;
}

/**
 * Apartado de algo en existencia: pendiente → entregado.
 * Encargo sobre pedido: pendiente (solicitado) → pedido (al proveedor) → llego → entregado.
 */
export type EstadoInteresado = 'nuevo' | 'contactado' | 'inscrito' | 'descartado';

/** Persona que se inscribió en la página pública (o que anotó recepción) y quiere entrar a una clase. */
export interface Interesado extends Base {
  nombre: string;
  telefono: string;
  /** clase que le interesa (vacío = cualquiera) */
  claseId: ID | null;
  mensaje: string;
  estado: EstadoInteresado;
  /** cuándo se le escribió por última vez */
  contactadoAt: number | null;
  /** alumno con que quedó registrado */
  alumnoId: ID | null;
  /** alumno que lo invitó (se inscribió desde su enlace de invitación); lo pone la base */
  invitoAlumnoId?: ID | null;
  /** de dónde llegó a la página: "facebook · navidad", "instagram", "google · anuncio"… (null = directo) */
  origen?: string | null;
}

export type EstadoTestimonio = 'pendiente' | 'aprobado' | 'rechazado';

/**
 * Lo que un alumno escribió desde su portal sobre la academia. Lo crea la base (función portal_testimonio),
 * nunca un equipo; la academia solo lo aprueba (se copia a la página pública) o no.
 */
export interface Testimonio extends Base {
  alumnoId: ID;
  texto: string;
  estado: EstadoTestimonio;
  revisadoAt: number | null;
  revisadoPor: ID | null;
}

export type EstadoPedido = 'pendiente' | 'pedido' | 'llego' | 'entregado' | 'cancelado';

/**
 * Apartado desde el portal del alumno: se paga y se entrega en recepción.
 * Lo crea la base (función portal_pedir), nunca un equipo; los equipos solo lo entregan o cancelan.
 * Mientras está pendiente, aparta existencias.
 */
export interface Pedido extends Base {
  alumnoId: ID;
  productoId: ID;
  opcion: string | null;
  cantidad: number;
  /** precio por pieza al apartar (centavos) */
  precio: number;
  estado: EstadoPedido;
  /** venta con la que se entregó */
  pagoId: ID | null;
  /** detalles del encargo: color, diseño, nombre bordado… */
  nota?: string | null;
  /** anticipo cobrado (centavos) y su cobro; al entregar se cobra el resto */
  anticipo?: number | null;
  anticipoPagoId?: ID | null;
}

export interface Alumno extends Base {
  nombre: string;
  telefono: string;
  notas: string;
  codigo: string;
  activo: boolean;
  /** token secreto de su portal (/p/<token>); se crea al enviarle el enlace */
  portal?: string | null;
  /** foto pequeña (JPEG en data URL, ~10 KB) para que recepción y maestros lo reconozcan */
  foto?: string | null;
  /** cuándo se le mandó cada recordatorio desde Pendientes ("vence:<membresiaId>", "adeudo", "extrañamos") → ms */
  avisos?: Record<string, number> | null;
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
  /** clases que cubre (planes por clase); vacío = todas las que permita el plan */
  claseIds?: ID[] | null;
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
  /** venta de boletos de un evento */
  eventoId?: ID | null;
  /** venta de tienda: costo total de lo vendido al momento de venderlo (para la ganancia) */
  costo?: number | null;
  /** cobro de renta del salón: qué renta y de qué mes ('YYYY-MM') */
  rentaId?: ID | null;
  periodo?: string | null;
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
  /** entró sin pagar (fiado). Queda saldada cuando se le liga un pago (pagoId). */
  debe?: boolean | null;
  /** SOLO LOCAL (índice): 1 si debe esta clase. Lo calcula la base del teléfono; nunca se sube. */
  deuda?: 1;
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
  /** feria con la que abrió la caja (se queda en el cajón); null en cortes anteriores a 20261127 */
  fondo?: number | null;
  /** efectivo que salió del cajón ese día (gastos con deCaja) */
  salidas?: number | null;
}

export type TipoRenta = 'mensual' | 'evento';
/** Cómo paga el maestro externo: cuota fija al mes, por hora usada, o comisión por alumno que llega a sus clases. */
export type CobroRenta = 'fijo' | 'hora' | 'alumno';

/**
 * Renta del salón a un maestro externo. Ocupa el salón los `dias` de la semana a `horaInicio`
 * durante `duracionMin`, entre `desde` y `hasta`. Un evento es una renta de un solo día (desde = hasta).
 */
export interface Renta extends Base {
  /** null = sede principal (el estudio) */
  sedeId?: ID | null;
  nombre: string;
  telefono: string;
  tipo: TipoRenta;
  /** 0 = domingo … 6 = sábado */
  dias: number[];
  horaInicio: string;
  duracionMin: number;
  desde: Fecha;
  /** null = sin fecha de fin (mensual) */
  hasta: Fecha | null;
  /** cuota mensual o precio del evento, en centavos */
  monto: number;
  notas: string;
  activo: boolean;
  /** vacío = fijo */
  cobro?: CobroRenta | null;
  /** por hora: $ por hora · por alumno: $ por alumno (centavos) */
  tarifa?: number | null;
  /** maestro de la academia al que corresponde (por alumno: se cuentan los alumnos de sus clases) */
  maestroId?: ID | null;
  /** salón del estudio; vacío = salón principal */
  salonId?: ID | null;
  /** renta interna que aparta el salón para un evento de la academia */
  eventoId?: ID | null;
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
  /** pago a un maestro: a quién (para saber cuánto deja cada clase) */
  maestroId?: ID | null;
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
  /** gasto de un evento (decoración, DJ…): cuenta para la utilidad del evento */
  eventoId?: ID | null;
  /** pago a un maestro: a quién (para saber cuánto deja cada clase) */
  maestroId?: ID | null;
  metodo: MetodoPago;
  notas: string;
  /** salió del cajón de recepción (garrafón, pago a un maestro): se descuenta en el corte de caja */
  deCaja?: boolean | null;
  usuarioId: ID;
}

export interface OutboxItem {
  seq?: number;
  table: SyncTable;
  id: ID;
  at: number;
  /** campos que cambió este registro; vacío/ausente = registro completo (alta o cambio sin detalle) */
  campos?: string[] | null;
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
  rentas: Renta;
  pedidos: Pedido;
  eventos: Evento;
  boletos: Boleto;
  interesados: Interesado;
  testimonios: Testimonio;
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
  'rentas',
  'pedidos',
  'eventos',
  'boletos',
  'interesados',
  'testimonios',
];
