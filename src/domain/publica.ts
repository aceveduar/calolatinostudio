/** Página pública del estudio (/a/<slug>): lo que ve cualquiera desde Facebook, sin datos personales. */
import type { ID } from '../db/types';

export interface DatosPublica {
  academia: { nombre: string; color: string | null; logo: string | null; whatsapp: string | null; sede_principal: string };
  sedes: { id: ID; nombre: string; color: string }[];
  clases: { id: ID; clase: string; color: string | null; dias: number[]; hora: string; duracion: number; sede_id: ID | null; precio: number | null }[];
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
