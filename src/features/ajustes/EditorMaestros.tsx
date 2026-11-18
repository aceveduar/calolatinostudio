import { useState } from 'react';
import { nombreClase, useClases, useDisciplinas, useMaestros } from '../../app/datos';
import { useAvisos } from '../../components/avisos';
import { Avatar, Boton, Campo, Entrada, Etiqueta, Interruptor, cx } from '../../components/ui';
import { actualizar, crear } from '../../db/repo';
import { type Clase, type Disciplina, type Maestro } from '../../db/types';
import { DIAS_CORTOS } from '../../domain/fechas';
import { Catalogo } from './Catalogo';

// ---------- Maestros ----------
export function EditorMaestros() {
  const maestros = useMaestros();
  const clases = useClases();
  const disciplinas = useDisciplinas();
  const suyas = (m: Maestro) => clases.filter((c) => c.maestroId === m.id && c.activo);
  return (
    <>
      <p className="mb-3 text-sm text-ink-500">Da de alta a los maestros y asígnalos a sus clases. Así ves cuántos alumnos y cuánto dinero entra en cada clase de cada maestro.</p>
      <Catalogo
        items={maestros}
        textoNuevo="Nuevo maestro"
        titulo={(m) => (m ? m.nombre : 'Nuevo maestro')}
        fila={(m) => (
          <>
            <Avatar nombre={m.nombre} tam={40} />
            <span className={cx('min-w-0 flex-1', !m.activo && 'opacity-40')}>
              <span className="block truncate font-semibold">{m.nombre}</span>
              <span className="block truncate text-sm text-ink-500">
                {suyas(m).map((c) => nombreClase(c, disciplinas)).join(', ') || 'Sin clases asignadas'}
              </span>
            </span>
            {!m.activo && <Etiqueta>Inactivo</Etiqueta>}
          </>
        )}
        form={(m, cerrar) => <FormMaestro maestro={m} clases={m ? suyas(m) : []} disciplinas={disciplinas} onHecho={cerrar} />}
      />
    </>
  );
}

export function FormMaestro({ maestro, clases, disciplinas, onHecho }: { maestro: Maestro | null; clases: Clase[]; disciplinas: Disciplina[]; onHecho: () => void }) {
  const avisar = useAvisos();
  const [nombre, setNombre] = useState(maestro?.nombre ?? '');
  const [telefono, setTelefono] = useState(maestro?.telefono ?? '');
  const [notas, setNotas] = useState(maestro?.notas ?? '');
  const [activo, setActivo] = useState(maestro?.activo ?? true);

  const guardar = async () => {
    const datos = { nombre: nombre.trim().replace(/\s+/g, ' '), telefono: telefono.replace(/\D/g, ''), notas: notas.trim(), activo };
    if (maestro) await actualizar('maestros', maestro.id, datos);
    else await crear('maestros', datos);
    avisar('Maestro guardado');
    onHecho();
  };

  return (
    <div className="space-y-4">
      <Campo etiqueta="Nombre">
        <Entrada autoFocus={!maestro} value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej. Profe Luis" />
      </Campo>
      <Campo etiqueta="WhatsApp (opcional)">
        <Entrada type="tel" inputMode="tel" value={telefono} onChange={(e) => setTelefono(e.target.value)} placeholder="10 dígitos" />
      </Campo>
      <Campo etiqueta="Notas (opcional)">
        <Entrada value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Ej. cobra por clase" />
      </Campo>
      {maestro && (
        <div className="rounded-2xl bg-superficie p-4 text-sm ring-1 ring-ink-100">
          <p className="font-semibold">Clases que da</p>
          <p className="mt-1 text-ink-500">
            {clases.length ? clases.map((c) => `${nombreClase(c, disciplinas)} (${c.dias.map((d) => DIAS_CORTOS[d]).join(' ')} ${c.horaInicio})`).join(' · ') : 'Asígnale clases en “Clases y horarios”.'}
          </p>
        </div>
      )}
      {maestro && <Interruptor valor={activo} onChange={setActivo} texto="Sigue dando clases" />}
      <Boton grande bloque onClick={guardar} disabled={!nombre.trim()}>
        Guardar
      </Boton>
    </div>
  );
}
