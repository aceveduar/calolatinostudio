import { useState } from 'react';
import { nombreClase, useClases, useDisciplinas, useMaestros } from '../../app/datos';
import { useAvisos } from '../../components/avisos';
import { Avatar, Boton, Campo, Entrada, Etiqueta, Interruptor, cx } from '../../components/ui';
import { actualizar, crear } from '../../db/repo';
import { type Clase, type Disciplina, type Maestro } from '../../db/types';
import { ChevronDown, X } from 'lucide-react';
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
        <ElegirClases todas={todas} elegidas={elegidas} onChange={setElegidas} disciplinas={disciplinas} otroMaestro={(c) => (c.maestroId && c.maestroId !== maestro?.id ? (maestros.find((m) => m.id === c.maestroId)?.nombre ?? null) : null)} />
      )}
      {maestro && <Interruptor valor={activo} onChange={setActivo} texto="Sigue dando clases" />}
      <Boton grande bloque onClick={guardar} disabled={!nombre.trim()}>
        Guardar
      </Boton>
    </div>
  );
}

const sinAcentos = (t: string) =>
  t
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

/**
 * Las clases que da un maestro. Pocas (hasta 12): todas a la vista como botones. Muchas: arriba las suyas
 * (para quitarlas), un buscador ("salsa", "lun", "19:00") y el resto agrupado por disciplina, plegado
 * (antes, con 60 clases, era una pared de botones).
 */
function ElegirClases({
  todas,
  elegidas,
  onChange,
  disciplinas,
  otroMaestro,
}: {
  todas: Clase[];
  elegidas: string[];
  onChange: (ids: string[]) => void;
  disciplinas: Disciplina[];
  otroMaestro: (c: Clase) => string | null;
}) {
  const [q, setQ] = useState('');
  const [abiertas, setAbiertas] = useState<string[]>([]);
  const cambiar = (id: string) => onChange(elegidas.includes(id) ? elegidas.filter((x) => x !== id) : [...elegidas, id]);
  const horario = (c: Clase) => `${c.dias.map((d) => DIAS_CORTOS[d]).join(' ')} ${c.horaInicio}`;
  const boton = (c: Clase) => {
    const si = elegidas.includes(c.id);
    const otro = !si ? otroMaestro(c) : null;
    return (
      <button
        key={c.id}
        type="button"
        aria-pressed={si}
        onClick={() => cambiar(c.id)}
        className={cx('rounded-xl px-3 py-2 text-left text-sm ring-1', si ? 'bg-brand-500 text-white ring-brand-500' : 'bg-superficie ring-ink-100')}
      >
        <span className="block font-semibold">{nombreClase(c, disciplinas)}</span>
        <span className={cx('block text-xs', si ? 'text-white/80' : 'text-ink-500')}>
          {horario(c)}
          {otro && ` · ahora ${otro}`}
        </span>
      </button>
    );
  };

  if (todas.length <= 12)
    return (
      <Campo etiqueta="¿Qué clases da?" ayuda="Toca las suyas. Si una ya tenía otro maestro, pasa a este." grupo>
        <div className="flex flex-wrap gap-2">{todas.map(boton)}</div>
      </Campo>
    );

  const suyas = todas.filter((c) => elegidas.includes(c.id));
  const texto = sinAcentos(q.trim());
  const coincide = (c: Clase) => !texto || sinAcentos(`${nombreClase(c, disciplinas)} ${horario(c)} ${otroMaestro(c) ?? ''}`).includes(texto);
  const grupos = disciplinas
    .map((d) => ({ d, clases: todas.filter((c) => c.disciplinaId === d.id && coincide(c)) }))
    .filter((g) => g.clases.length > 0);
  return (
    <Campo etiqueta="¿Qué clases da?" ayuda="Si una ya tenía otro maestro, pasa a este." grupo>
      <div className="space-y-3">
        <div className="rounded-2xl bg-ink-50 p-3 ring-1 ring-ink-100">
          <p className="mb-2 text-xs font-bold tracking-wider text-ink-500 uppercase">
            Las que da · {suyas.length}
          </p>
          {suyas.length ? (
            <div className="flex flex-wrap gap-2">
              {suyas.map((c) => (
                <button key={c.id} type="button" onClick={() => cambiar(c.id)} className="flex items-center gap-1.5 rounded-full bg-brand-500 py-1.5 pr-2 pl-3 text-sm font-semibold text-white" aria-label={`Quitar ${nombreClase(c, disciplinas)} ${horario(c)}`}>
                  {nombreClase(c, disciplinas)} <span className="font-normal text-white/80">{horario(c)}</span> <X size={14} aria-hidden="true" />
                </button>
              ))}
            </div>
          ) : (
            <p className="text-sm text-ink-500">Aún ninguna: búscalas o ábrelas abajo.</p>
          )}
        </div>
        <Entrada value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar: salsa, lun, 19:00…" aria-label="Buscar clase" />
        <div className="divide-y divide-ink-100 overflow-hidden rounded-2xl bg-superficie ring-1 ring-ink-100">
          {grupos.map(({ d, clases }) => {
            const abierta = !!texto || abiertas.includes(d.id);
            const marcadas = clases.filter((c) => elegidas.includes(c.id)).length;
            return (
              <div key={d.id}>
                <button
                  type="button"
                  aria-expanded={abierta}
                  onClick={() => setAbiertas(abierta ? abiertas.filter((x) => x !== d.id) : [...abiertas, d.id])}
                  className="flex min-h-12 w-full items-center gap-3 px-4 text-left active:bg-ink-50"
                >
                  <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: d.color }} aria-hidden="true" />
                  <span className="flex-1 font-semibold">{d.nombre}</span>
                  <span className="text-sm text-ink-500">
                    {clases.length} {clases.length === 1 ? 'clase' : 'clases'}
                    {marcadas > 0 && <b className="text-brand-600"> · {marcadas} suya{marcadas === 1 ? '' : 's'}</b>}
                  </span>
                  <ChevronDown size={18} className={cx('shrink-0 text-ink-300 transition', abierta && 'rotate-180')} aria-hidden="true" />
                </button>
                {abierta && <div className="flex flex-wrap gap-2 px-4 pb-3">{clases.map(boton)}</div>}
              </div>
            );
          })}
          {grupos.length === 0 && <p className="px-4 py-4 text-sm text-ink-500">Ninguna clase coincide con “{q}”.</p>}
        </div>
      </div>
    </Campo>
  );
}
