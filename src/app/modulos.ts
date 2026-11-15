/**
 * Registro de módulos de la app: UNA lista que define la navegación.
 * Para agregar una función nueva: su pantalla + su ruta en App.tsx + una entrada aquí.
 * La barra de abajo (celular), la barra lateral (PC) y la pantalla "Más" se arman solas desde esta lista,
 * según el rol de quien entra. Así la app crece sin reacomodar menús a mano.
 */
import {
  Building2,
  CalendarClock,
  CalendarDays,
  ChartColumn,
  ClipboardList,
  Cloud,
  DoorOpen,
  Globe,
  GraduationCap,
  LayoutGrid,
  ListChecks,
  MapPin,
  Megaphone,
  MessageCircle,
  Music2,
  PartyPopper,
  ShoppingBag,
  Tags,
  Truck,
  Users,
  Wallet,
  WalletCards,
  type LucideIcon,
} from 'lucide-react';
import type { Rol } from '../db/types';

export type Grupo = 'negocio' | 'alumnos' | 'config' | 'cuenta';

export const GRUPOS: { id: Grupo; titulo: string }[] = [
  { id: 'negocio', titulo: 'El negocio' },
  { id: 'alumnos', titulo: 'Alumnos y ventas' },
  { id: 'config', titulo: 'Configuración' },
  { id: 'cuenta', titulo: 'Cuenta' },
];

/** Contadores que la pantalla "Más" sabe calcular (ver PantallaMas). */
export type Contador = 'interesados' | 'encargos' | 'pendientes';

export interface Modulo {
  id: string;
  titulo: string;
  /** texto corto debajo del título en "Más" */
  ayuda?: string;
  icono: LucideIcon;
  ruta: string;
  para: Rol[];
  /** posición en la barra de abajo del celular, por rol (sin número = va en "Más") */
  pestana?: Partial<Record<Rol, number>>;
  /** texto corto en la barra de abajo */
  corto?: string;
  /** dónde aparece en "Más" (sin grupo = solo pestaña) */
  grupo?: Grupo;
  contador?: Contador;
}

export const MODULOS: Modulo[] = [
  // ---------- pestañas principales ----------
  { id: 'entrada', titulo: 'Entrada', icono: DoorOpen, ruta: '/', para: ['dueno', 'recepcion'], pestana: { dueno: 0, recepcion: 0 } },
  { id: 'mis-clases', titulo: 'Mis clases', icono: GraduationCap, ruta: '/', para: ['maestro'], pestana: { maestro: 0 } },
  { id: 'alumnos', titulo: 'Alumnos', icono: Users, ruta: '/alumnos', para: ['dueno', 'recepcion'], pestana: { dueno: 1, recepcion: 1 } },
  { id: 'caja', titulo: 'Caja', icono: Wallet, ruta: '/caja', para: ['dueno', 'recepcion'], pestana: { dueno: 2, recepcion: 2 } },
  { id: 'reportes', titulo: 'Reportes', icono: ChartColumn, ruta: '/reportes', para: ['dueno'], pestana: { dueno: 3 } },
  // ---------- el negocio ----------
  { id: 'pendientes', titulo: 'Pendientes', ayuda: 'A quién escribir y qué cobrar', icono: ListChecks, ruta: '/pendientes', para: ['dueno', 'recepcion'], grupo: 'negocio', contador: 'pendientes' },
  { id: 'agenda', titulo: 'Agenda del salón', corto: 'Agenda', ayuda: 'Clases, rentas y huecos libres', icono: CalendarDays, ruta: '/agenda', para: ['dueno', 'recepcion'], pestana: { recepcion: 3 }, grupo: 'negocio' },
  { id: 'eventos', titulo: 'Eventos', ayuda: 'Boletos, cupo y entrada', icono: PartyPopper, ruta: '/agenda/eventos', para: ['dueno', 'recepcion'], grupo: 'negocio' },
  { id: 'gastos', titulo: 'Gastos y utilidad', ayuda: 'Renta, luz y lo que queda', icono: WalletCards, ruta: '/reportes/gastos', para: ['dueno'], grupo: 'negocio' },
  // ---------- alumnos y ventas ----------
  { id: 'interesados', titulo: 'Interesados', ayuda: 'Quien se inscribió en la página', icono: Megaphone, ruta: '/alumnos/interesados', para: ['dueno', 'recepcion'], grupo: 'alumnos', contador: 'interesados' },
  { id: 'listas', titulo: 'Listas del mes', ayuda: 'Quién vino y quién debe', icono: ClipboardList, ruta: '/alumnos/listas', para: ['dueno', 'recepcion'], grupo: 'alumnos' },
  { id: 'encargos', titulo: 'Encargos', ayuda: 'Pedidos al proveedor', icono: Truck, ruta: '/encargos', para: ['dueno', 'recepcion'], grupo: 'alumnos', contador: 'encargos' },
  { id: 'pagina', titulo: 'Página pública', ayuda: 'Para compartir en Facebook', icono: Globe, ruta: '/ajustes/pagina', para: ['dueno'], grupo: 'alumnos' },
  // ---------- configuración (dirección) ----------
  { id: 'clases', titulo: 'Clases y horarios', icono: CalendarClock, ruta: '/ajustes/clases', para: ['dueno'], grupo: 'config' },
  { id: 'planes', titulo: 'Planes y precios', icono: Tags, ruta: '/ajustes/planes', para: ['dueno'], grupo: 'config' },
  { id: 'productos', titulo: 'Productos', ayuda: 'Tienda, costos y códigos', icono: ShoppingBag, ruta: '/ajustes/productos', para: ['dueno'], grupo: 'config' },
  { id: 'maestros', titulo: 'Maestros', icono: GraduationCap, ruta: '/ajustes/maestros', para: ['dueno'], grupo: 'config' },
  { id: 'sedes', titulo: 'Sedes', icono: MapPin, ruta: '/ajustes/sedes', para: ['dueno'], grupo: 'config' },
  { id: 'disciplinas', titulo: 'Disciplinas', icono: Music2, ruta: '/ajustes/disciplinas', para: ['dueno'], grupo: 'config' },
  { id: 'usuarios', titulo: 'Usuarios y PIN', icono: Users, ruta: '/ajustes/usuarios', para: ['dueno'], grupo: 'config' },
  { id: 'mensajes', titulo: 'Mensajes de WhatsApp', icono: MessageCircle, ruta: '/ajustes/mensajes', para: ['dueno'], grupo: 'config' },
  { id: 'academia', titulo: 'Academia', ayuda: 'Nombre, logo y color', icono: Building2, ruta: '/ajustes/academia', para: ['dueno'], grupo: 'config' },
  // ---------- cuenta ----------
  { id: 'nube', titulo: 'Nube y respaldo', icono: Cloud, ruta: '/ajustes/nube', para: ['dueno', 'recepcion'], grupo: 'cuenta' },
  // "Más" siempre es la última pestaña
  { id: 'mas', titulo: 'Más', icono: LayoutGrid, ruta: '/mas', para: ['dueno', 'recepcion'], pestana: { dueno: 9, recepcion: 9 } },
];

export const modulosDe = (rol: Rol) => MODULOS.filter((m) => m.para.includes(rol));

/** Pestañas de la barra de abajo, en orden. */
export const pestanasDe = (rol: Rol) =>
  modulosDe(rol)
    .filter((m) => m.pestana?.[rol] !== undefined)
    .sort((a, b) => a.pestana![rol]! - b.pestana![rol]!);

/**
 * Qué pestaña se marca para una ruta: la de la ruta más larga que coincide; si la pantalla vive en "Más"
 * (p. ej. /encargos o /ajustes/planes), se marca "Más".
 */
export function pestanaActiva(rol: Rol, ruta: string): string | null {
  const coincide = (r: string) => (r === '/' ? ruta === '/' : ruta === r || ruta.startsWith(r + '/'));
  const mejor = modulosDe(rol)
    .filter((m) => coincide(m.ruta))
    .sort((a, b) => b.ruta.length - a.ruta.length)[0];
  if (!mejor) return pestanasDe(rol).some((m) => m.id === 'mas') ? 'mas' : null;
  if (mejor.pestana?.[rol] !== undefined) return mejor.id;
  // pantalla de "Más": si su ruta cuelga de una pestaña (p. ej. /alumnos/listas → Alumnos), se marca esa
  const padre = pestanasDe(rol).filter((m) => m.ruta !== '/' && coincide(m.ruta)).sort((a, b) => b.ruta.length - a.ruta.length)[0];
  return padre?.id ?? 'mas';
}
