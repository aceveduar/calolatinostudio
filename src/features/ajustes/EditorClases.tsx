import { useState } from 'react';
import { useRentas } from '../../app/datos';
import { rentasQueChocanConClase } from '../../domain/agenda';
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

// ---------- Clases ----------
export function EditorClases() {
  const { academia } = useSesion();
  const sedes = useSedes();
  const clases = useClases();
  const disciplinas = useDisciplinas();
  const maestros = useMaestros();
  const ordenadas = [...clases].sort((a, b) => nombreClase(a, disciplinas).localeCompare(nombreClase(b, disciplinas)) || a.horaInicio.localeCompare(b.horaInicio));
  return (
    <Catalogo
      items={ordenadas}
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
              {nombreMaestro(c, maestros) && ` · ${nombreMaestro(c, maestros)}`}
            </span>
          </span>
          {!c.activo && <Etiqueta>Pausada</Etiqueta>}
        </>
      )}
      form={(c, cerrar) => <FormClase clase={c} disciplinas={disciplinas} onHecho={cerrar} />}
    />
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
  const chocaCon = rentasQueChocanConClase({ id: clase?.id, dias, horaInicio: hora, duracionMin: Number(duracion) || 60, sedeId: sedeId || null, salonId: salonId || null }, rentas);

  const guardar = async () => {
    let idMaestro: ID | null = maestroId && maestroId !== NUEVO ? maestroId : null;
    if (maestroId === NUEVO && maestroNuevo.trim()) {
      idMaestro = (await crear('maestros', { nombre: maestroNuevo.trim().replace(/\s+/g, ' '), telefono: '', notas: '', activo: true })).id;
    }
    const propio = aCentavos(precioPropio);
    const datos = {
      ...conSede(sedeId, clase?.sedeId),
      disciplinaId,
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
          </Selector>
        </Campo>
        <Campo etiqueta="Nivel">
          <Entrada value={nivel} onChange={(e) => setNivel(e.target.value)} placeholder="0, 1, 2…" />
        </Campo>
      </div>
      <Campo etiqueta="Días" grupo>
        <div className="grid grid-cols-7 gap-1.5">
          {[1, 2, 3, 4, 5, 6, 0].map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDias(dias.includes(d) ? dias.filter((x) => x !== d) : [...dias, d])}
              className={cx('h-11 rounded-xl text-sm font-semibold ring-1', dias.includes(d) ? 'bg-brand-500 text-white ring-brand-500' : 'bg-superficie ring-ink-100')}
            >
              {DIAS_CORTOS[d]}
            </button>
          ))}
        </div>
      </Campo>
      <div className="grid grid-cols-2 gap-3">
        <Campo etiqueta="Hora">
          <Entrada type="time" value={hora} onChange={(e) => setHora(e.target.value)} />
        </Campo>
        <Campo etiqueta="Duración (min)">
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
      <Campo etiqueta="Precio de clase suelta (opcional)" ayuda={`Si el maestro pone su propia tarifa. Vacío = el de la sede${precioSede ? ` (${dinero(precioSede)})` : ''}.`}>
        <Entrada inputMode="decimal" value={precioPropio} onChange={(e) => setPrecioPropio(e.target.value)} placeholder={precioSede ? aPesosTexto(precioSede) : '$'} />
      </Campo>
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
          {finMal && <p className="text-sm font-medium text-bad-600">La fecha de fin debe ser después del inicio.</p>}
          <p className="text-xs text-ink-500">
            En la página pública se ve “Nuevo grupo: inicia…”, y después de esas semanas “Grupo en curso”. Quien se inscriba entonces queda en Interesados para avisarle cuando abra el siguiente grupo.
          </p>
        </div>
      )}
      <Interruptor valor={activo} onChange={setActivo} texto="Clase activa" />
      {chocaCon.length > 0 && (
        <p className="rounded-xl bg-warn-50 px-3 py-2 text-sm font-medium text-warn-600">
          Ojo: a esa hora el salón está rentado a {chocaCon.map((r) => r.nombre).join(', ')}. Revisa la Agenda antes de guardar.
        </p>
      )}
      <Boton grande bloque onClick={guardar} disabled={!disciplinaId || !dias.length || (porCurso && !inicio) || finMal}>
        Guardar
      </Boton>
    </div>
  );
}
