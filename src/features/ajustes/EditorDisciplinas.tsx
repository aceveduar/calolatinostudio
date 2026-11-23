import { useState } from 'react';
import { useClases, useDisciplinas } from '../../app/datos';
import { useAvisos } from '../../components/avisos';
import { Boton, Campo, Entrada, cx } from '../../components/ui';
import { actualizar, borrar, crear } from '../../db/repo';
import { type Disciplina } from '../../db/types';
import { Catalogo } from './Catalogo';

import { COLORES, colorLibre } from '../../domain/colores';

// ---------- Disciplinas ----------

export function EditorDisciplinas() {
  const disciplinas = useDisciplinas();
  const clases = useClases();
  const cuantas = (d: Disciplina) => clases.filter((c) => c.disciplinaId === d.id).length;
  return (
    <>
    <p className="mb-3 text-sm text-ink-500">Los estilos que enseñas. Su color identifica sus clases en Entrada, la agenda y tu página.</p>
    <Catalogo
      items={disciplinas}
      textoNuevo="Nueva disciplina"
      titulo={(d) => (d ? d.nombre : 'Nueva disciplina')}
      fila={(d) => (
        <>
          <span className="h-4 w-4 rounded-full" style={{ background: d.color }} />
          <span className="flex-1 font-semibold">{d.nombre}</span>
          <span className="text-sm text-ink-500">
            {cuantas(d)} {cuantas(d) === 1 ? 'clase' : 'clases'}
          </span>
        </>
      )}
      vacio="Aún no hay disciplinas. Agrega la primera: salsa, bachata…"
      form={(d, cerrar) => <FormDisciplina disciplina={d} enUso={!!d && clases.some((c) => c.disciplinaId === d.id)} onHecho={cerrar} />}
    />
    </>
  );
}

export function FormDisciplina({ disciplina, enUso, onHecho }: { disciplina: Disciplina | null; enUso: boolean; onHecho: () => void }) {
  const usados = useDisciplinas().map((d) => d.color);
  const avisar = useAvisos();
  const [nombre, setNombre] = useState(disciplina?.nombre ?? '');
  const [color, setColor] = useState(disciplina?.color ?? colorLibre(usados));
  return (
    <div className="space-y-4">
      <Campo etiqueta="Nombre">
        <Entrada autoFocus={!disciplina} value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej. Cumbia, Kizomba" />
      </Campo>
      <Campo etiqueta="Color" grupo>
        <div className="flex flex-wrap gap-3">
          {COLORES.map((c) => (
            <button key={c} type="button" onClick={() => setColor(c)} className={cx('h-10 w-10 rounded-full ring-offset-2', color === c && 'ring-2 ring-ink-900')} style={{ background: c }} aria-label={`Color ${c}`} aria-pressed={color === c} />
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
        <Boton
          bloque
          variante="peligro"
          onClick={async () => {
            await borrar('disciplinas', disciplina.id);
            // deshacer en vez de "¿seguro?": igual que en cobros, gastos y rentas
            avisar(`${disciplina.nombre} eliminada`, 'ok', { texto: 'Deshacer', fn: () => actualizar('disciplinas', disciplina.id, { deletedAt: null }).then(() => undefined) });
            onHecho();
          }}
        >
          Eliminar
        </Boton>
      )}
    </div>
  );
}
