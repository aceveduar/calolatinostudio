import { useState } from 'react';
import { nombreClase, useClases, useDisciplinas, useMaestros } from '../../app/datos';
import { useAvisos } from '../../components/avisos';
import { Avatar, Boton, Campo, Entrada, Etiqueta, Interruptor, cx } from '../../components/ui';
import { actualizar, crear } from '../../db/repo';
import { db } from '../../db/db';
import { type Clase, type Disciplina, type Maestro } from '../../db/types';
import { ChevronDown, Plus, X } from 'lucide-react';
import { DIAS_CORTOS } from '../../domain/fechas';
import { Catalogo } from './Catalogo';

// ---------- Maestros ----------
export function EditorMaestros() {
  const maestros = useMaestros();
  const clases = useClases();
  const disciplinas = useDisciplinas();
  const suyas = (m: Maestro) => clases.filter((c) => c.maestroId === m.id && c.activo).sort((a, b) => nombreClase(a, disciplinas).localeCompare(nombreClase(b, disciplinas)));
  return (
      <Catalogo
        items={maestros}
        textoNuevo="Nuevo maestro"
        arriba={(nuevo) => <Boton className="mb-3" onClick={nuevo}><Plus size={18} aria-hidden="true" /> Nuevo maestro</Boton>}
        titulo={(m) => (m ? m.nombre : 'Nuevo maestro')}
        fila={(m) => {
          const asignadas = suyas(m);
          return (
          <>
            <Avatar nombre={m.nombre} tam={40} />
            <span className={cx('min-w-0 flex-1', !m.activo && 'opacity-40')}>
              <span className="block break-words font-semibold">{m.nombre}</span>
              <span className="block text-sm text-ink-500">
                {asignadas.length ? nombreClase(asignadas[0], disciplinas) : 'Sin clases asignadas'}
                {asignadas.length > 1 && ` · +${asignadas.length - 1}`}
              </span>
            </span>
            {!m.activo && <Etiqueta>Inactivo</Etiqueta>}
          </>
          );
        }}
        vacio="Aún no hay maestros. Agrega al primero y elige qué clases da."
        form={(m, cerrar) => <FormMaestro maestro={m} clases={clases} maestros={maestros} disciplinas={disciplinas} onHecho={cerrar} />}
      />
  );
}

function FormMaestro({ maestro, clases, maestros, disciplinas, onHecho }: { maestro: Maestro | null; clases: Clase[]; maestros: Maestro[]; disciplinas: Disciplina[]; onHecho: () => void }) {
  const avisar = useAvisos();
  const todas = clases
    .filter((c) => c.activo)
    .sort((a, b) => nombreClase(a, disciplinas).localeCompare(nombreClase(b, disciplinas)) || a.horaInicio.localeCompare(b.horaInicio));
  // las clases que da: se eligen aquí mismo (antes había que abrir cada clase en "Clases y horarios")
  const [cambios, setCambios] = useState<Record<string, boolean>>({});
  const asignada = (c: Clase) => !!maestro && c.maestroId === maestro.id;
  const elegidas = todas.filter((c) => cambios[c.id] ?? asignada(c)).map((c) => c.id);
  const cambiar = (id: string) => {
    const clase = todas.find((c) => c.id === id);
    if (!clase) return;
    setCambios((anteriores) => {
      const siguiente = { ...anteriores };
      const original = asignada(clase);
      if (id in siguiente) delete siguiente[id];
      else siguiente[id] = !original;
      return siguiente;
    });
  };
  const [nombre, setNombre] = useState(maestro?.nombre ?? '');
  const [telefono, setTelefono] = useState(maestro?.telefono ?? '');
  const [notas, setNotas] = useState(maestro?.notas ?? '');
  const [activo, setActivo] = useState(maestro?.activo ?? true);
  const [guardando, setGuardando] = useState(false);

  const guardar = async () => {
    setGuardando(true);
    try {
      await db.transaction('rw', [db.maestros, db.clases, db.outbox, db.meta], async () => {
        const datos = { nombre: nombre.trim().replace(/\s+/g, ' '), telefono: telefono.replace(/\D/g, ''), notas: notas.trim(), activo };
        const id = maestro ? (await actualizar('maestros', maestro.id, datos)).id : (await crear('maestros', datos)).id;
        for (const [claseId, asignar] of Object.entries(cambios)) {
          const clase = await db.clases.get(claseId);
          if (!clase?.activo || clase.deletedAt) throw new Error('Una clase cambió mientras editabas. Vuelve a abrir la ficha.');
          if (asignar && clase.maestroId !== id) await actualizar('clases', claseId, { maestroId: id });
          if (!asignar && clase.maestroId === id) await actualizar('clases', claseId, { maestroId: null });
        }
      });
      avisar('Maestro guardado');
      onHecho();
    } catch (error) {
      avisar(error instanceof Error ? error.message : 'No se pudo guardar el maestro', 'error');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="space-y-4">
      <Campo etiqueta="Nombre">
        <Entrada autoFocus={!maestro} value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej. Profe Luis" />
      </Campo>
      {todas.length > 0 && (
        <ElegirClases todas={todas} elegidas={elegidas} onCambiar={cambiar} disciplinas={disciplinas} otroMaestro={(c) => (c.maestroId && c.maestroId !== maestro?.id ? (maestros.find((m) => m.id === c.maestroId)?.nombre ?? null) : null)} />
      )}
      <Campo etiqueta="WhatsApp (opcional)">
        <Entrada type="tel" inputMode="tel" value={telefono} onChange={(e) => setTelefono(e.target.value)} placeholder="10 dígitos" />
      </Campo>
      <Campo etiqueta="Notas (opcional)">
        <Entrada value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Ej. cobra por clase" />
      </Campo>
      {maestro && <Interruptor valor={activo} onChange={setActivo} texto="Sigue dando clases" />}
      <Boton grande bloque onClick={guardar} disabled={!nombre.trim() || guardando}>
        {guardando ? 'Guardando…' : 'Guardar'}
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
 * Las clases asignadas aparecen primero y el resto se puede buscar o abrir por disciplina.
 */
function ElegirClases({
  todas,
  elegidas,
  onCambiar,
  disciplinas,
  otroMaestro,
}: {
  todas: Clase[];
  elegidas: string[];
  onCambiar: (id: string) => void;
  disciplinas: Disciplina[];
  otroMaestro: (c: Clase) => string | null;
}) {
  const [q, setQ] = useState('');
  const [abiertas, setAbiertas] = useState<string[]>([]);
  const horario = (c: Clase) => `${c.dias.map((d) => DIAS_CORTOS[d]).join(' ')} ${c.horaInicio}`;
  const boton = (c: Clase) => {
    const si = elegidas.includes(c.id);
    const otro = !si ? otroMaestro(c) : null;
    return (
      <button
        key={c.id}
        type="button"
        aria-pressed={si}
        onClick={() => onCambiar(c.id)}
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


  const suyas = todas.filter((c) => elegidas.includes(c.id));
  const texto = sinAcentos(q.trim());
  const coincide = (c: Clase) => !texto || sinAcentos(`${nombreClase(c, disciplinas)} ${horario(c)} ${otroMaestro(c) ?? ''}`).includes(texto);
  const grupos = disciplinas
    .map((d) => ({ d, clases: todas.filter((c) => c.disciplinaId === d.id && !elegidas.includes(c.id) && coincide(c)) }))
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
                <button key={c.id} type="button" onClick={() => onCambiar(c.id)} className="flex min-h-11 items-center gap-1.5 rounded-xl bg-brand-50 px-3 py-1.5 text-left text-sm font-semibold text-brand-600" aria-label={`Quitar ${nombreClase(c, disciplinas)} ${horario(c)}`}>
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
