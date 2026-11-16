/** Página pública del estudio (/a/<slug>): lo que ve cualquiera desde Facebook, sin datos personales. */
import type { ContenidoPagina, ID } from '../db/types';

export interface DatosPublica {
  academia: { nombre: string; color: string | null; logo: string | null; whatsapp: string | null; sede_principal: string };
  /** puede faltar si la base aún no tiene la columna */
  pagina?: ContenidoPagina;
  sedes: { id: ID; nombre: string; color: string }[];
  clases: { id: ID; clase: string; color: string | null; dias: number[]; hora: string; duracion: number; sede_id: ID | null; precio: number | null; curso?: { inicio: string; fin?: string | null; semanas?: number } | null; disciplina?: string | null }[];
  planes: { nombre: string; tipo: 'suelta' | 'mensual' | 'paquete'; precio: number; clases: number | null; vigencia: number | null; grupos: number | null; sede_id: ID | null }[];
  eventos: { nombre: string; fecha: string; hora: string; precio: number; descripcion: string; quedan: number | null }[];
  tienda: { nombre: string; precio: number; emoji: string; foto: string | null; descripcion: string; opciones: string[]; sobre_pedido: boolean }[];
}

/** "Calo Latino Studio" → "calo-latino-studio" */
export function slugDe(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

export const slugValido = (s: string) => /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/.test(s);
export const enlacePublico = (slug: string) => `${location.origin}/a/${slug}`;

export const ERRORES_INSCRIPCION: Record<string, string> = {
  academia: 'Esta página ya no está disponible.',
  nombre: 'Escribe tu nombre.',
  telefono: 'Escribe tu WhatsApp a 10 dígitos.',
  clase: 'Esa clase ya no está disponible; elige otra.',
  muchos: 'Ya recibimos tu registro; pronto te escribimos.',
  cupo: 'Hoy recibimos muchos registros; escríbenos por WhatsApp.',
};

/** Preguntas sugeridas: la academia las revisa y ajusta antes de publicarlas. */
export const PREGUNTAS_SUGERIDAS: { p: string; r: string }[] = [
  { p: '¿Necesito ir con pareja?', r: 'No. En clase vamos rotando para que todos bailen; puedes venir solo o sola.' },
  { p: 'Nunca he bailado, ¿puedo entrar?', r: 'Claro. Los grupos de nivel 0 son para empezar desde cero; te acompañamos paso a paso.' },
  { p: '¿Qué ropa llevo?', r: 'Ropa cómoda y zapato que gire en el piso (nada de suela de hule que se pegue). Trae agua.' },
  { p: '¿Cómo pago?', r: 'En recepción, antes de tu clase. Puedes pagar por clase o con un paquete o mensualidad, que sale más barato.' },
  { p: '¿Hay clase de prueba?', r: 'Sí. Ven a tu primera clase, conoce al grupo y después decides qué plan te conviene.' },
];

const limpiar = (s: string) => s.trim().replace(/^@/, '').replace(/\/+$/, '');
/** "@calolatino", "calolatino" o una URL → URL de la red social. */
export function urlRed(red: 'instagram' | 'facebook' | 'tiktok', valor: string | undefined): string | null {
  const v = limpiar(valor ?? '');
  if (!v) return null;
  if (/^https?:\/\//i.test(v)) return v;
  const base = { instagram: 'https://instagram.com/', facebook: 'https://facebook.com/', tiktok: 'https://www.tiktok.com/@' }[red];
  return base + v.replace(/^(www\.)?(instagram|facebook|tiktok)\.com\/@?/i, '');
}

/** Mapa de Google sin clave (se muestra en un iframe) y enlace para llegar. */
export const mapaEmbed = (direccion: string) => `https://maps.google.com/maps?q=${encodeURIComponent(direccion)}&z=16&output=embed`;
export const comoLlegar = (direccion: string) => `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(direccion)}`;
