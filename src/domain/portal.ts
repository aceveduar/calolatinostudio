import type { DetalleDeEvento } from './publica';
/**
 * Portal del alumno: un enlace personal (/p/<token>) donde ve su QR, su plan y sus clases sin crear cuenta.
 * El token es secreto y largo (≈143 bits): no se puede adivinar, a diferencia del código de 6 letras del QR.
 * Si se comparte por error, se genera uno nuevo y el anterior deja de servir.
 */
import type { ClaseHorario } from './miPortal';

const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
const LARGO = 26;

export function generarTokenPortal(): string {
  // rechazo de sesgo: solo bytes < múltiplo del alfabeto
  const limite = 256 - (256 % ALFABETO.length);
  let t = '';
  while (t.length < LARGO) {
    for (const b of crypto.getRandomValues(new Uint8Array(LARGO * 2))) {
      if (b < limite && t.length < LARGO) t += ALFABETO[b % ALFABETO.length];
    }
  }
  return t;
}

export const enlacePortal = (token: string) => `${location.origin}/p/${token}`;

/** Lo que devuelve la función portal_alumno de la base. */
export interface DatosPortal {
  hoy: string;
  alumno: { nombre: string; codigo: string; foto?: string | null };
  academia: { nombre: string; color: string | null; logo: string | null; whatsapp?: string | null; slug?: string | null };
  /** clases a las que va (base 20261120+; puede faltar en datos guardados por una versión anterior) */
  horario?: ClaseHorario[];
  logros?: { total: number; desde: string | null; semanas: string[] };
  /** invitar a un amigo: su huella y cuántos invitó (base 20261123+) */
  invita?: { de: string; invitados: number; inscritos: number };
  /** Próximos eventos de la academia (socials, talleres). */
  eventos?: ({ nombre: string; fecha: string; hora: string; precio: number; descripcion: string; quedan: number | null } & DetalleDeEvento)[];
  /** su último testimonio (base 20261122+) */
  testimonio?: { texto: string; estado: 'pendiente' | 'aprobado' | 'rechazado' } | null;
  planes: { plan: string; tipo: string; beca: boolean; inicio: string; fin: string; clases: number | null; usadas: number }[];
  clases: { fecha: string; clase: string; color: string | null }[];
  tienda: { id: string; nombre: string; precio: number; emoji: string; foto: string | null; descripcion: string; opciones: string[]; disponibles: number | null; sobre_pedido?: boolean; dias_entrega?: number | null }[];
  pedidos?: { producto: string; emoji: string; foto?: string | null; opcion: string | null; nota?: string | null; cantidad: number; precio: number; anticipo?: number; estado: 'pendiente' | 'pedido' | 'llego' | 'entregado' | 'cancelado'; creado: number }[];
}

/** Los datos guardados antes de 20261130 solo traían el nombre del producto. */
export function fotoPedido(pedido: NonNullable<DatosPortal['pedidos']>[number], tienda: DatosPortal['tienda']): string | null {
  if (pedido.foto !== undefined) return pedido.foto;
  const coincidencias = tienda.filter((p) => p.nombre === pedido.producto);
  return coincidencias.length === 1 ? coincidencias[0].foto : null;
}

export function estadoPedidoPortal(pedido: NonNullable<DatosPortal['pedidos']>[number], tienda: DatosPortal['tienda']) {
  switch (pedido.estado) {
    case 'entregado': return { etiqueta: 'Entregado', detalle: '', listo: false };
    case 'cancelado': return { etiqueta: 'Cancelado', detalle: '', listo: false };
    case 'llego': return { etiqueta: 'Llegó', detalle: 'Recógelo en recepción', listo: true };
    case 'pedido': return { etiqueta: 'En camino', detalle: 'El proveedor lo está preparando', listo: false };
    case 'pendiente': {
      const coincidencias = tienda.filter((p) => p.nombre === pedido.producto);
      if (coincidencias.length !== 1) {
        return { etiqueta: 'Recibido', detalle: 'Confirma en recepción cuándo puedes recogerlo', listo: false };
      }
      return coincidencias[0].sobre_pedido
        ? { etiqueta: 'Encargo recibido', detalle: 'La academia aún debe pedirlo al proveedor', listo: false }
        : { etiqueta: 'Apartado', detalle: 'Recógelo en recepción', listo: true };
    }
  }
}

export const ERRORES_PEDIDO: Record<string, string> = {
  enlace: 'Este enlace ya no funciona. Pide uno nuevo en recepción.',
  cantidad: 'Puedes apartar de 1 a 5 piezas.',
  producto: 'Ese producto ya no está disponible.',
  opcion: 'Elige una talla o color.',
  muchos: 'Ya tienes 5 apartados por recoger. Recógelos en recepción para apartar más.',
  agotado: 'Ya no hay suficientes piezas.',
};

/** Mensajes para el portal según lo que responda la base. */
export const ERRORES_TESTIMONIO: Record<string, string> = {
  enlace: 'Este enlace ya no funciona. Pide uno nuevo en recepción.',
  corto: 'Escribe un poco más (al menos 10 letras).',
  muchos: 'Ya enviaste varios hoy. Inténtalo mañana.',
};

/**
 * Clases que debe llevar antes de pedirle su testimonio: a la primera todavía no tiene qué contar, y un
 * testimonio de alguien que ya viene seguido vale más. Si ya escribió uno, siempre ve en qué va.
 */
export const CLASES_PARA_TESTIMONIO = 4;
export const puedeOpinar = (d: Pick<DatosPortal, 'logros' | 'testimonio'>) => !!d.testimonio || (d.logros?.total ?? 0) >= CLASES_PARA_TESTIMONIO;
