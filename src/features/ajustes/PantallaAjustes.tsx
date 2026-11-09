import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Building2, ChevronRight, Cloud, Download, LockKeyhole, Music2, Tags, Users, CalendarClock } from 'lucide-react';
import { useSesion } from '../../app/sesion';
import { useAvisos } from '../../components/avisos';
import { Boton, Campo, Encabezado, Entrada, Tarjeta } from '../../components/ui';
import { actualizar } from '../../db/repo';
import { db } from '../../db/db';
import { SYNC_TABLES } from '../../db/types';
import { hoy } from '../../domain/fechas';
import { EditorClases, EditorDisciplinas, EditorPlanes, EditorUsuarios } from './Editores';
import { PanelNube } from './PanelNube';

const SECCIONES = {
  clases: { titulo: 'Clases y horarios', icono: CalendarClock, comp: EditorClases },
  planes: { titulo: 'Planes y precios', icono: Tags, comp: EditorPlanes },
  disciplinas: { titulo: 'Disciplinas', icono: Music2, comp: EditorDisciplinas },
  usuarios: { titulo: 'Usuarios y PIN', icono: Users, comp: EditorUsuarios },
  academia: { titulo: 'Academia', icono: Building2, comp: EditorAcademia },
  nube: { titulo: 'Nube y respaldo', icono: Cloud, comp: PanelNube },
} as const;
type Clave = keyof typeof SECCIONES;

export function PantallaAjustes() {
  const { seccion } = useParams();
  const { esDueno, bloquear, usuario } = useSesion();
  const nav = useNavigate();

  if (seccion && seccion in SECCIONES) {
    const s = SECCIONES[seccion as Clave];
    const Comp = s.comp;
    return (
      <div className="px-4 pb-8">
        <button onClick={() => nav('/ajustes')} className="mt-3 -ml-2 flex items-center gap-1 rounded-full p-2 font-semibold text-ink-700 active:bg-ink-100">
          <ArrowLeft size={20} /> Ajustes
        </button>
        <h1 className="mt-1 mb-4 text-2xl font-extrabold">{s.titulo}</h1>
        <Comp />
      </div>
    );
  }

  const visibles: Clave[] = esDueno ? ['clases', 'planes', 'disciplinas', 'usuarios', 'academia', 'nube'] : ['nube'];

  return (
    <div className="px-4 pb-8">
      <div className="-mx-4">
        <Encabezado titulo="Ajustes" sub={`${usuario.nombre} · ${usuario.rol === 'dueno' ? 'Dueño' : 'Recepción'}`} />
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

function EditorAcademia() {
  const { academia } = useSesion();
  const avisar = useAvisos();
  const [nombre, setNombre] = useState(academia.nombre);
  return (
    <div className="space-y-4">
      <Campo etiqueta="Nombre de la academia">
        <Entrada value={nombre} onChange={(e) => setNombre(e.target.value)} />
      </Campo>
      <Boton
        bloque
        disabled={!nombre.trim() || nombre === academia.nombre}
        onClick={async () => {
          await actualizar('academias', academia.id, { nombre: nombre.trim() });
          avisar('Guardado');
        }}
      >
        Guardar
      </Boton>
      <RespaldoLocal />
    </div>
  );
}

export function RespaldoLocal() {
  return (
    <Boton
      bloque
      variante="secundario"
      onClick={async () => {
        const datos: Record<string, unknown[]> = {};
        for (const t of SYNC_TABLES) datos[t] = await db.table(t).toArray();
        const blob = new Blob([JSON.stringify({ version: 1, exportado: new Date().toISOString(), datos }, null, 1)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `compas-respaldo-${hoy()}.json`;
        a.click();
        URL.revokeObjectURL(a.href);
      }}
    >
      <Download size={18} /> Descargar respaldo
    </Boton>
  );
}
