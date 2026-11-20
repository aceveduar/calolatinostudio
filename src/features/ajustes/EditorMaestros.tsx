import { useState } from 'react';
import { nombreClase, useClases, useDisciplinas, useMaestros } from '../../app/datos';
import { useAvisos } from '../../components/avisos';
import { Avatar, Boton, Campo, Entrada, Etiqueta, Interruptor, cx } from '../../components/ui';
import { actualizar, crear } from '../../db/repo';
import { type Disciplina, type Maestro } from '../../db/types';
import { DIAS_CORTOS } from '../../domain/fechas';
import { Catalogo } from './Catalogo';

// ---------- Maestros ----------
export function EditorMaestros() {
  const maestros = useMaestros();
  const clases = useClases();
  const disciplinas = useDisciplinas();
  const suyas = (m: Maestro) => clases.filter((c) => c.maestroId === m.id && c.activo).sort((a, b) => nombreClase(a, disciplinas).localeCompare(nombreClase(b, disciplinas)));
  return (
    <>
      <p className="mb-3 text-sm text-ink-500">Quién da cada clase. Así cada maestro ve su lista y tú ves cuántos alumnos y cuánto dinero deja cada clase.</p>
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
        vacio="Aún no hay maestros. Agrega al primero y elige qué clases da."
        form={(m, cerrar) => <FormMaestro maestro={m} disciplinas={disciplinas} onHecho={cerrar} />}
      />
    </>
  );
}

export function FormMaestro({ maestro, disciplinas, onHecho }: { maestro: Maestro | null; disciplinas: Disciplina[]; onHecho: () => void }) {
  const avisar = useAvisos();
  const maestros = useMaestros();
  const todas = useClases()
    .filter((c) => c.activo)
    .sort((a, b) => nombreClase(a, disciplinas).localeCompare(nombreClase(b, disciplinas)) || a.horaInicio.localeCompare(b.horaInicio));
  // las clases que da: se eligen aquí mismo (antes había que abrir cada clase en "Clases y horarios")
  const [elegidas, setElegidas] = useState<string[]>(() => (maestro ? todas.filter((c) => c.maestroId === maestro.id).map((c) => c.id) : []));
  const [nombre, setNombre] = useState(maestro?.nombre ?? '');
  const [telefono, setTelefono] = useState(maestro?.telefono ?? '');
  const [notas, setNotas] = useState(maestro?.notas ?? '');
  const [activo, setActivo] = useState(maestro?.activo ?? true);

  const guardar = async () => {
    const datos = { nombre: nombre.trim().replace(/\s+/g, ' '), telefono: telefono.replace(/\D/g, ''), notas: notas.trim(), activo };
    const id = maestro ? (await actualizar('maestros', maestro.id, datos)).id : (await crear('maestros', datos)).id;
    // asignar las elegidas y quitarle las que ya no da
    for (const c of todas) {
      const la = elegidas.includes(c.id);
      if (la && c.maestroId !== id) await actualizar('clases', c.id, { maestroId: id });
      else if (!la && c.maestroId === id) await actualizar('clases', c.id, { maestroId: null });
    }
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
      {todas.length > 0 && (
        <Campo etiqueta="¿Qué clases da?" ayuda="Toca las suyas. Si una ya tenía otro maestro, pasa a este." grupo>
          <div className="flex flex-wrap gap-2">
            {todas.map((c) => {
              const si = elegidas.includes(c.id);
              const otro = !si && c.maestroId && c.maestroId !== maestro?.id ? maestros.find((m) => m.id === c.maestroId)?.nombre : null;
              return (
                <button
                  key={c.id}
                  type="button"
                  aria-pressed={si}
                  onClick={() => setElegidas(si ? elegidas.filter((x) => x !== c.id) : [...elegidas, c.id])}
                  className={cx('rounded-xl px-3 py-2 text-left text-sm ring-1', si ? 'bg-brand-500 text-white ring-brand-500' : 'bg-superficie ring-ink-100')}
                >
                  <span className="block font-semibold">{nombreClase(c, disciplinas)}</span>
                  <span className={cx('block text-xs', si ? 'text-white/80' : 'text-ink-500')}>
                    {c.dias.map((d) => DIAS_CORTOS[d]).join(' ')} {c.horaInicio}
                    {otro && ` · ahora ${otro}`}
                  </span>
                </button>
              );
            })}
          </div>
        </Campo>
      )}
      {maestro && <Interruptor valor={activo} onChange={setActivo} texto="Sigue dando clases" />}
      <Boton grande bloque onClick={guardar} disabled={!nombre.trim()}>
        Guardar
      </Boton>
    </div>
  );
}
