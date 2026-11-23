import { useRef, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Building2, ChevronRight, Cloud, LockKeyhole, Music2, Tags, Users, CalendarClock, GraduationCap, MessageCircle, ShoppingBag, MapPin, Globe, LifeBuoy } from 'lucide-react';
import { useSesion } from '../../app/sesion';
import { useAvisos } from '../../components/avisos';
import { Boton, Campo, Encabezado, Entrada, Tarjeta } from '../../components/ui';
import { actualizar } from '../../db/repo';
import { RespaldoLocal } from './Respaldo';
import { NOMBRE_ROL } from '../../db/types';
import { LogoAcademia } from '../../components/LogoAcademia';
import { prepararLogo } from '../../app/fotos';
import { EditorClases } from './EditorClases';
import { EditorDisciplinas } from './EditorDisciplinas';
import { EditorMaestros } from './EditorMaestros';
import { EditorPlanes } from './EditorPlanes';
import { EditorProductos } from './EditorProductos';
import { EditorSedes } from './EditorSedes';
import { EditorUsuarios } from './EditorUsuarios';
import { PanelNube } from './PanelNube';
import { EditorMensajes } from './EditorMensajes';
import { EditorPagina } from './EditorPagina';
import { AyudaErrores } from './AyudaErrores';

const SECCIONES = {
  sedes: { titulo: 'Sedes', icono: MapPin, comp: EditorSedes },
  clases: { titulo: 'Clases y horarios', icono: CalendarClock, comp: EditorClases },
  maestros: { titulo: 'Maestros', icono: GraduationCap, comp: EditorMaestros },
  planes: { titulo: 'Planes y precios', icono: Tags, comp: EditorPlanes },
  productos: { titulo: 'Productos (tienda)', icono: ShoppingBag, comp: EditorProductos },
  disciplinas: { titulo: 'Disciplinas', icono: Music2, comp: EditorDisciplinas },
  usuarios: { titulo: 'Usuarios y PIN', icono: Users, comp: EditorUsuarios },
  academia: { titulo: 'Academia', icono: Building2, comp: EditorAcademia },
  mensajes: { titulo: 'Mensajes de WhatsApp', icono: MessageCircle, comp: EditorMensajes },
  pagina: { titulo: 'Página pública e inscripciones', icono: Globe, comp: EditorPagina },
  nube: { titulo: 'Nube y respaldo', icono: Cloud, comp: PanelNube },
  ayuda: { titulo: 'Ayuda y errores', icono: LifeBuoy, comp: AyudaErrores },
} as const;
type Clave = keyof typeof SECCIONES;

export function PantallaAjustes() {
  const { seccion } = useParams();
  const { esDueno, bloquear, usuario } = useSesion();
  const nav = useNavigate();

  const visibles: Clave[] = esDueno ? ['sedes', 'clases', 'maestros', 'planes', 'productos', 'disciplinas', 'usuarios', 'academia', 'mensajes', 'pagina', 'nube', 'ayuda'] : ['nube', 'ayuda'];
  // Permiso por sección: también si se llega por enlace directo
  if (seccion && !visibles.includes(seccion as Clave)) return <Navigate to="/ajustes" replace />;

  if (seccion && seccion in SECCIONES) {
    const s = SECCIONES[seccion as Clave];
    const Comp = s.comp;
    return (
      <div className="px-4 pb-8 lg:mx-auto lg:max-w-3xl">
        <div className="flex items-center gap-2 pt-4 pb-3">
          <button onClick={() => nav('/mas')} className="-ml-2.5 rounded-full p-2.5 active:bg-ink-100" aria-label="Volver a Más">
            <ArrowLeft size={22} />
          </button>
          <h1 className="flex-1 text-2xl font-extrabold tracking-tight">{s.titulo}</h1>
        </div>
        <Comp />
      </div>
    );
  }

  return (
    <div className="px-4 pb-8 lg:mx-auto lg:max-w-3xl">
      <div className="-mx-4">
        <Encabezado titulo="Ajustes" sub={`${usuario.nombre} · ${NOMBRE_ROL[usuario.rol]}`} />
      </div>
      <Tarjeta className="divide-y divide-ink-100">
        {visibles.map((k) => {
          const s = SECCIONES[k];
          const Icono = s.icono;
          return (
            <Link key={k} to={`/ajustes/${k}`} className="flex items-center gap-3 px-4 py-3.5 active:bg-ink-50">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                <Icono size={18} />
              </span>
              <span className="flex-1 font-semibold">{s.titulo}</span>
              <ChevronRight size={18} className="text-ink-300" />
            </Link>
          );
        })}
      </Tarjeta>
      {!esDueno && <p className="mt-3 px-1 text-sm text-ink-500">Los precios, clases y usuarios los administra el dueño.</p>}
      <Boton bloque grande variante="secundario" className="mt-6" onClick={bloquear}>
        <LockKeyhole size={20} /> Bloquear / cambiar usuario
      </Boton>
      <p className="mt-6 text-center text-xs text-ink-300">Compás v{__APP_VERSION__}</p>
    </div>
  );
}

/** Paleta curada: todos contrastan con texto blanco (≥ 4.5:1), así ningún botón queda ilegible. */
const COLORES_MARCA = [
  { hex: '#d6304a', nombre: 'Rojo salsa' },
  { hex: '#c2185b', nombre: 'Fucsia' },
  { hex: '#9333ea', nombre: 'Morado' },
  { hex: '#4f46e5', nombre: 'Índigo' },
  { hex: '#0369a1', nombre: 'Azul' },
  { hex: '#0f766e', nombre: 'Turquesa' },
  { hex: '#b45309', nombre: 'Ámbar' },
  { hex: '#3f3a4d', nombre: 'Grafito' },
];

function EditorAcademia() {
  const { academia } = useSesion();
  const avisar = useAvisos();
  const [nombre, setNombre] = useState(academia.nombre);
  const actual = academia.color ?? COLORES_MARCA[0].hex;
  return (
    <div className="space-y-4">
      <Campo etiqueta="Nombre de la academia">
        <Entrada value={nombre} onChange={(e) => setNombre(e.target.value)} />
      </Campo>
      {/* solo si se cambió el nombre (el logo y el color se guardan solos): antes estaba siempre, como si faltara algo */}
      {nombre.trim() !== academia.nombre && (
        <Boton
          bloque
          disabled={!nombre.trim()}
          onClick={async () => {
            await actualizar('academias', academia.id, { nombre: nombre.trim() });
            avisar('Guardado');
          }}
        >
          Guardar nombre
        </Boton>
      )}
      <SubirLogo />
      <Campo grupo etiqueta="Color de la academia" ayuda="Se aplica al instante en toda la app.">
        <div className="grid grid-cols-4 gap-3">
          {COLORES_MARCA.map((c) => (
            <button
              key={c.hex}
              type="button"
              onClick={() => actualizar('academias', academia.id, { color: c.hex })}
              className="flex flex-col items-center gap-1.5"
              aria-label={c.nombre}
              aria-pressed={actual === c.hex}
            >
              <span
                className={`h-12 w-12 rounded-2xl ring-offset-2 ring-offset-ink-50 transition ${actual === c.hex ? 'scale-110 ring-2 ring-ink-900' : ''}`}
                style={{ background: c.hex }}
              />
              <span className="text-[11px] font-medium text-ink-500">{c.nombre}</span>
            </button>
          ))}
        </div>
      </Campo>
      <RespaldoLocal />
    </div>
  );
}

function SubirLogo() {
  const { academia } = useSesion();
  const avisar = useAvisos();
  const input = useRef<HTMLInputElement>(null);
  return (
    <Campo grupo etiqueta="Logo de la academia" ayuda="Mejor un PNG sin fondo. Aparece al entrar y en el menú.">
      <div className="flex items-center gap-4 rounded-2xl bg-superficie p-3 ring-1 ring-ink-100">
        <span className="flex h-20 w-20 items-center justify-center rounded-xl bg-ink-50">
          <LogoAcademia academia={academia} tam={64} />
        </span>
        <div className="flex flex-1 flex-wrap gap-2">
          <Boton variante="secundario" onClick={() => input.current?.click()}>
            {academia.logo ? 'Cambiar' : 'Subir logo'}
          </Boton>
          {academia.logo && (
            <Boton
              variante="fantasma"
              onClick={async () => {
                const antes = academia.logo;
                await actualizar('academias', academia.id, { logo: null });
                avisar('Logo quitado', 'ok', { texto: 'Deshacer', fn: () => actualizar('academias', academia.id, { logo: antes }).then(() => undefined) });
              }}
            >
              Quitar
            </Boton>
          )}
        </div>
        <input
          ref={input}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (!f) return;
            try {
              await actualizar('academias', academia.id, { logo: await prepararLogo(f) });
              avisar('Logo actualizado');
            } catch (err) {
              avisar(err instanceof Error ? err.message : 'No se pudo usar esa imagen', 'error');
            }
          }}
        />
      </div>
    </Campo>
  );
}
