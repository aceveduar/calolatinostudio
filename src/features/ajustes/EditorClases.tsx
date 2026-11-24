import { useState } from 'react';
import { useRentas } from '../../app/datos';
import { clasesQueChocan, rentasQueChocanConClase } from '../../domain/agenda';
import { colorClase, nombreClase, nombreMaestro, useClases, useDisciplinas, useMaestros, usePlanes } from '../../app/datos';
import { useSesion } from '../../app/sesion';
import { useAvisos } from '../../components/avisos';
import { SEMANAS_PARA_ENTRAR } from '../../domain/cursos';
import { Boton, Campo, Entrada, Etiqueta, Interruptor, Segmentos, Selector, cx } from '../../components/ui';
import { actualizar, crear } from '../../db/repo';
import { type Clase, type Disciplina, type ID } from '../../db/types';
import { aCentavos, aPesosTexto, dinero } from '../../domain/dinero';
import { DIAS_CORTOS } from '../../domain/fechas';
import { nombreSede, useSedes } from '../../app/sedes';
import { conSede, sueltaPara } from '../../domain/sedes';
import { Catalogo, NUEVO } from './Catalogo';
import { colorLibre } from '../../domain/colores';

// ---------- Clases ----------
export function EditorClases() {
  const { academia } = useSesion();
  const sedes = useSedes();
  const clases = useClases();
  const disciplinas = useDisciplinas();
  const maestros = useMaestros();
  const ordenadas = [...clases].sort((a, b) => nombreClase(a, disciplinas).localeCompare(nombreClase(b, disciplinas)) || a.horaInicio.localeCompare(b.horaInicio));
  return (
    <>
    <p className="mb-3 text-sm text-ink-500">Cada clase con sus días, hora y maestro. Con esto, Entrada sabe sola qué clase toca a cada hora.</p>
    <Catalogo
      items={ordenadas}
      vacio="Aún no hay clases. Agrega la primera con sus días y hora."
      textoNuevo="Nueva clase"
      titulo={(c) => (c ? nombreClase(c, disciplinas) : 'Nueva clase')}
      fila={(c) => (
        <>
          <span className="h-3 w-3 rounded-full" style={{ background: colorClase(c, disciplinas) }} />
          <span className={cx('flex-1', !c.activo && 'opacity-40')}>
            <span className="block font-semibold">{nombreClase(c, disciplinas)}</span>
            <span className="block text-sm text-ink-500">
              {sedes.length > 0 && `${nombreSede(c.sedeId, sedes, academia)} · `}
              {c.dias.map((d) => DIAS_CORTOS[d]).join(', ') || 'Sin días'} · {c.horaInicio}
              {nombreMaestro(c, maestros) ? ` · ${nombreMaestro(c, maestros)}` : <span className="text-warn-600"> · sin maestro</span>}
            </span>
          </span>
          {!c.activo && <Etiqueta>Pausada</Etiqueta>}
        </>
      )}
      form={(c, cerrar) => <FormClase clase={c} disciplinas={disciplinas} onHecho={cerrar} />}
    />
    </>
  );
}

export function FormClase({ clase, disciplinas, onHecho }: { clase: Clase | null; disciplinas: Disciplina[]; onHecho: () => void }) {
  const avisar = useAvisos();
  const { academia } = useSesion();
  const [disciplinaId, setDisciplinaId] = useState(clase?.disciplinaId ?? disciplinas[0]?.id ?? '');
  const [nivel, setNivel] = useState(clase?.nivel ?? '');
  const maestros = useMaestros().filter((m) => m.activo || m.id === clase?.maestroId);
  const [maestroId, setMaestroId] = useState<string>(clase?.maestroId ?? '');
  const [maestroNuevo, setMaestroNuevo] = useState('');
  const [discNueva, setDiscNueva] = useState('');
  const coloresUsados = disciplinas.map((d) => d.color);
  const [dias, setDias] = useState<number[]>(clase?.dias ?? []);
  const [hora, setHora] = useState(clase?.horaInicio ?? '19:00');
  const [duracion, setDuracion] = useState(String(clase?.duracionMin ?? 60));
  const [activo, setActivo] = useState(clase?.activo ?? true);
  const sedes = useSedes();
  const [sedeId, setSedeId] = useState<string>(clase?.sedeId ?? '');
  const [precioPropio, setPrecioPropio] = useState(clase?.precioSuelta ? aPesosTexto(clase.precioSuelta) : '');
  const salones = academia.salones ?? [];
  const [salonId, setSalonId] = useState<string>(clase?.salonId ?? '');
  // por curso: solo entran nuevos al inicio (p. ej. Salsa 0 de 3 meses)
  const [porCurso, setPorCurso] = useState(!!clase?.curso?.inicio);
  const [inicio, setInicio] = useState(clase?.curso?.inicio ?? '');
  const [fin, setFin] = useState(clase?.curso?.fin ?? '');
  const [semanas, setSemanas] = useState(String(clase?.curso?.semanas ?? SEMANAS_PARA_ENTRAR));
  const finMal = porCurso && !!fin && !!inicio && fin <= inicio;
  const precioSede = sueltaPara(usePlanes(), sedeId || null)?.precio;
  const rentas = useRentas();
  const clases = useClases();
  const horario = { id: clase?.id, dias, horaInicio: hora, duracionMin: Number(duracion) || 60, sedeId: sedeId || null, salonId: sedeId ? null : salonId || null };
  const chocaCon = activo ? rentasQueChocanConClase(horario, rentas) : [];
  const empalmes = activo ? clasesQueChocan({ ...horario, maestroId: maestroId === NUEVO ? null : maestroId, curso: porCurso && inicio ? { inicio, fin: fin || null } : null }, clases) : [];

  const guardar = async () => {
    let idMaestro: ID | null = maestroId && maestroId !== NUEVO ? maestroId : null;
    if (maestroId === NUEVO && maestroNuevo.trim()) {
      idMaestro = (await crear('maestros', { nombre: maestroNuevo.trim().replace(/\s+/g, ' '), telefono: '', notas: '', activo: true })).id;
    }
    // disciplina nueva desde aquí mismo (antes había que salir a "Disciplinas"), con un color que nadie usa
    const idDisciplina = disciplinaId === NUEVO ? (await crear('disciplinas', { nombre: discNueva.trim().replace(/\s+/g, ' '), color: colorLibre(coloresUsados) })).id : disciplinaId;
    const propio = aCentavos(precioPropio);
    const datos = {
      ...conSede(sedeId, clase?.sedeId),
      disciplinaId: idDisciplina,
      nivel: nivel.trim(),
      maestroId: idMaestro,
      dias: [...dias].sort(),
      horaInicio: hora,
      duracionMin: Number(duracion) || 60,
      activo,
      // solo se manda si tiene precio propio (o si lo tenía y se quitó)
      ...(propio > 0 ? { precioSuelta: propio } : clase?.precioSuelta ? { precioSuelta: null } : {}),
      ...(salonId && !sedeId ? { salonId } : clase?.salonId ? { salonId: null } : {}),
      ...(porCurso && inicio
        ? { curso: { inicio, ...(fin ? { fin } : {}), semanas: Math.min(12, Math.max(0, Number(semanas) || 0)) } }
        : clase?.curso
          ? { curso: null }
          : {}),
    };
    if (clase) await actualizar('clases', clase.id, datos);
    else await crear('clases', datos);
    avisar('Clase guardada');
    onHecho();
  };

  const nombreDisc = disciplinaId === NUEVO ? discNueva.trim() : (disciplinas.find((d) => d.id === disciplinaId)?.nombre ?? '');
  const nombreMaestroSel = maestroId === NUEVO ? maestroNuevo.trim() : (maestros.find((m) => m.id === maestroId)?.nombre ?? '');
  const termina = sumarMinutos(hora, Number(duracion) || 60);
  // lo que falta para guardar, dicho con palabras (antes el botón solo se apagaba)
  const falta =
    disciplinaId === NUEVO && !discNueva.trim()
      ? 'Escribe el nombre de la disciplina'
      : !disciplinaId
        ? 'Elige la disciplina'
        : !dias.length
          ? 'Elige al menos un día'
          : porCurso && !inicio
            ? 'Pon la fecha en que inicia el curso'
            : finMal
              ? 'La fecha de fin debe ser después del inicio'
              : '';

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Campo etiqueta="Disciplina">
          <Selector value={disciplinaId} onChange={(e) => setDisciplinaId(e.target.value)}>
            {disciplinas.map((d) => (
              <option key={d.id} value={d.id}>
                {d.nombre}
              </option>
            ))}
            <option value={NUEVO}>+ Nueva disciplina…</option>
          </Selector>
        </Campo>
        <Campo etiqueta="Nivel (opcional)">
          <Entrada value={nivel} onChange={(e) => setNivel(e.target.value)} placeholder="0, 1, 2…" />
        </Campo>
      </div>
      {disciplinaId === NUEVO && (
        <Campo etiqueta="Nombre de la nueva disciplina">
          <Entrada autoFocus value={discNueva} onChange={(e) => setDiscNueva(e.target.value)} placeholder="Ej. Cumbia" />
        </Campo>
      )}
      <Campo etiqueta="Maestro">
        <Selector value={maestroId} onChange={(e) => setMaestroId(e.target.value)}>
          <option value="">Sin asignar</option>
          {maestros.map((m) => (
            <option key={m.id} value={m.id}>
              {m.nombre}
            </option>
          ))}
          <option value={NUEVO}>+ Nuevo maestro…</option>
        </Selector>
      </Campo>
      {maestroId === NUEVO && (
        <Campo etiqueta="Nombre del nuevo maestro">
          <Entrada autoFocus value={maestroNuevo} onChange={(e) => setMaestroNuevo(e.target.value)} placeholder="Ej. Profe Luis" />
        </Campo>
      )}
      <Campo etiqueta="Días" grupo>
        <div className="grid grid-cols-7 gap-1.5">
          {[1, 2, 3, 4, 5, 6, 0].map((d) => (
            <button
              key={d}
              type="button"
              aria-pressed={dias.includes(d)}
              onClick={() => setDias(dias.includes(d) ? dias.filter((x) => x !== d) : [...dias, d])}
              className={cx('h-11 rounded-xl text-sm font-semibold ring-1', dias.includes(d) ? 'bg-brand-500 text-white ring-brand-500' : 'bg-superficie ring-ink-100')}
            >
              {DIAS_CORTOS[d]}
            </button>
          ))}
        </div>
      </Campo>
      <div className="grid grid-cols-2 gap-3">
        <Campo etiqueta="Empieza">
          <Entrada type="time" value={hora} onChange={(e) => setHora(e.target.value)} />
        </Campo>
        <Campo etiqueta="Dura (minutos)" ayuda={`Termina a las ${termina}`}>
          <Entrada inputMode="numeric" value={duracion} onChange={(e) => setDuracion(e.target.value.replace(/\D/g, ''))} />
        </Campo>
      </div>
      {sedes.length > 0 && (
        <Campo etiqueta="Sede">
          <Selector value={sedeId} onChange={(e) => setSedeId(e.target.value)}>
            <option value="">{nombreSede(null, sedes, academia)}</option>
            {sedes.map((x) => (
              <option key={x.id} value={x.id}>
                {x.nombre}
              </option>
            ))}
          </Selector>
        </Campo>
      )}
      {!sedeId && salones.length > 0 && (
        <Campo etiqueta="Salón">
          <Selector value={salonId} onChange={(e) => setSalonId(e.target.value)}>
            <option value="">Salón principal</option>
            {salones.map((x) => (
              <option key={x.id} value={x.id}>
                {x.nombre}
              </option>
            ))}
          </Selector>
        </Campo>
      )}
      <Campo etiqueta="¿Cuándo pueden entrar alumnos nuevos?" grupo>
        <Segmentos<'siempre' | 'curso'>
          opciones={[
            { valor: 'siempre', texto: 'Cuando sea' },
            { valor: 'curso', texto: 'Por curso' },
          ]}
          valor={porCurso ? 'curso' : 'siempre'}
          onChange={(v) => setPorCurso(v === 'curso')}
        />
      </Campo>
      {porCurso && (
        <div className="space-y-3 rounded-2xl bg-ink-50 p-3 ring-1 ring-ink-100">
          <div className="grid grid-cols-2 gap-3">
            <Campo etiqueta="Inicia">
              <Entrada type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} />
            </Campo>
            <Campo etiqueta="Termina (opcional)">
              <Entrada type="date" value={fin ?? ''} min={inicio || undefined} onChange={(e) => setFin(e.target.value)} />
            </Campo>
          </div>
          <Campo etiqueta="Aún pueden entrar hasta… semanas después de iniciar">
            <Entrada inputMode="numeric" value={semanas} onChange={(e) => setSemanas(e.target.value.replace(/\D/g, '').slice(0, 2))} />
          </Campo>
          <p className="text-xs text-ink-500">
            En la página pública se ve “Nuevo grupo: inicia…”, y después de esas semanas “Grupo en curso”. Quien se inscriba entonces queda en Interesados para avisarle cuando abra el siguiente grupo.
          </p>
        </div>
      )}
      <Campo etiqueta="Precio de clase suelta (opcional)" ayuda={`Solo si esta clase cuesta distinto. Vacío = el precio normal${precioSede ? ` (${dinero(precioSede)})` : ''}.`}>
        <Entrada inputMode="decimal" value={precioPropio} onChange={(e) => setPrecioPropio(e.target.value)} placeholder={precioSede ? aPesosTexto(precioSede) : '$'} />
      </Campo>
      {clase && <Interruptor valor={activo} onChange={setActivo} texto="Se sigue dando" />}
      {chocaCon.length > 0 && (
        <p className="rounded-xl bg-warn-50 px-3 py-2 text-sm font-medium text-warn-600">
          Ojo: a esa hora el salón está rentado a {chocaCon.map((r) => r.nombre).join(', ')}. Revisa la Agenda antes de guardar.
        </p>
      )}
      {empalmes.length > 0 && (
        <div role="status" className="rounded-xl bg-warn-50 p-3 text-sm text-warn-600">
          <p className="font-semibold">Hay clases que coinciden con este horario</p>
          <ul className="mt-1 space-y-1">
            {empalmes.map(({ clase: otra, dias: coinciden, salon, maestro }) => (
              <li key={otra.id}>{nombreClase(otra, disciplinas)} · {coinciden.map((d) => DIAS_CORTOS[d]).join(', ')} {otra.horaInicio} · {salon && maestro ? 'Mismo salón y maestro' : salon ? 'Mismo salón' : 'Mismo maestro'}</li>
            ))}
          </ul>
        </div>
      )}
      {/* cómo queda, en una línea: lo mismo que verá en Entrada y en la página */}
      {nombreDisc && dias.length > 0 && (
        <p className="rounded-2xl bg-brand-50 px-4 py-3 text-sm text-ink-700">
          <b className="text-ink-900">
            {nombreDisc}
            {nivel.trim() && ` ${nivel.trim()}`}
          </b>{' '}
          · {listaDias(dias)} · {hora} a {termina}
          {nombreMaestroSel ? ` · ${nombreMaestroSel}` : ' · sin maestro'}
        </p>
      )}
      <div>
        <Boton grande bloque onClick={guardar} disabled={!!falta}>
          Guardar
        </Boton>
        {falta && <p className="mt-2 text-center text-sm text-ink-500">{falta}</p>}
      </div>
    </div>
  );
}

/** "19:00" + 90 → "20:30" */
function sumarMinutos(hora: string, min: number): string {
  const [h, m] = hora.split(':').map(Number);
  const t = (((h * 60 + m + min) % 1440) + 1440) % 1440;
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
}

/** [1, 3, 5] → "Lun, Mié y Vie" */
function listaDias(dias: number[]): string {
  const t = [1, 2, 3, 4, 5, 6, 0].filter((d) => dias.includes(d)).map((d) => DIAS_CORTOS[d]);
  return t.length > 1 ? `${t.slice(0, -1).join(', ')} y ${t[t.length - 1]}` : (t[0] ?? '');
}
