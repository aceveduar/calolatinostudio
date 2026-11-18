import { useState } from 'react';
import { useClases, useDisciplinas } from '../../app/datos';
import { Boton, Campo, Entrada, cx } from '../../components/ui';
import { actualizar, borrar, crear } from '../../db/repo';
import { type Disciplina } from '../../db/types';
import { Catalogo } from './Catalogo';

// ---------- Disciplinas ----------
const COLORES = ['#e8445a', '#7c4ddb', '#1f8fd6', '#15924b', '#d97706', '#db2777', '#0d9488', '#3d3a48'];

export function EditorDisciplinas() {
  const disciplinas = useDisciplinas();
  const clases = useClases();
  return (
    <Catalogo
      items={disciplinas}
      textoNuevo="Nueva disciplina"
      titulo={(d) => (d ? d.nombre : 'Nueva disciplina')}
      fila={(d) => (
        <>
          <span className="h-4 w-4 rounded-full" style={{ background: d.color }} />
          <span className="flex-1 font-semibold">{d.nombre}</span>
          <span className="text-sm text-ink-500">{clases.filter((c) => c.disciplinaId === d.id).length} clases</span>
        </>
      )}
      form={(d, cerrar) => <FormDisciplina disciplina={d} enUso={!!d && clases.some((c) => c.disciplinaId === d.id)} onHecho={cerrar} />}
    />
  );
}

export function FormDisciplina({ disciplina, enUso, onHecho }: { disciplina: Disciplina | null; enUso: boolean; onHecho: () => void }) {
  const [nombre, setNombre] = useState(disciplina?.nombre ?? '');
  const [color, setColor] = useState(disciplina?.color ?? COLORES[2]);
  return (
    <div className="space-y-4">
      <Campo etiqueta="Nombre">
        <Entrada value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej. Cumbia, Kizomba" />
      </Campo>
      <Campo etiqueta="Color" grupo>
        <div className="flex flex-wrap gap-3">
          {COLORES.map((c) => (
            <button key={c} type="button" onClick={() => setColor(c)} className={cx('h-10 w-10 rounded-full ring-offset-2', color === c && 'ring-2 ring-ink-900')} style={{ background: c }} aria-label={c} />
          ))}
        </div>
      </Campo>
      <Boton
        grande
        bloque
        disabled={!nombre.trim()}
        onClick={async () => {
          if (disciplina) await actualizar('disciplinas', disciplina.id, { nombre: nombre.trim(), color });
          else await crear('disciplinas', { nombre: nombre.trim(), color });
          onHecho();
        }}
      >
        Guardar
      </Boton>
      {disciplina && !enUso && (
        <Boton bloque variante="peligro" onClick={async () => { await borrar('disciplinas', disciplina.id); onHecho(); }}>
          Eliminar
        </Boton>
      )}
    </div>
  );
}
