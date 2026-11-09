import { useState, type ReactNode } from 'react';
import { Plus } from 'lucide-react';
import { colorClase, nombreClase, useClases, useDisciplinas, usePlanes, useUsuarios } from '../../app/datos';
import { useSesion } from '../../app/sesion';
import { useAvisos } from '../../components/avisos';
import { Avatar, Boton, Campo, Entrada, Etiqueta, Hoja, Segmentos, Selector, Tarjeta, cx } from '../../components/ui';
import { actualizar, borrar, crear } from '../../db/repo';
import type { Clase, Disciplina, ID, Plan, Rol, TipoPlan, Usuario } from '../../db/types';
import { crearUsuario, hashPin } from '../../domain/acceso';
import { aCentavos, aPesosTexto, dinero } from '../../domain/dinero';
import { DIAS_CORTOS } from '../../domain/fechas';
import { describirPlan } from '../alumnos/VenderPlan';

/** Lista + hoja de edición: patrón común de todos los catálogos. */
function Catalogo<T extends { id: ID }>({
  items,
  fila,
  titulo,
  form,
  textoNuevo,
}: {
  items: T[];
  fila: (x: T) => ReactNode;
  titulo: (x: T | null) => string;
  form: (x: T | null, cerrar: () => void) => ReactNode;
  textoNuevo: string;
}) {
  const [sel, setSel] = useState<T | null | 'nuevo'>(null);
  const cerrar = () => setSel(null);
  const actual = sel === 'nuevo' ? null : sel;
  return (
    <>
      <Tarjeta className="divide-y divide-ink-100">
        {items.map((x) => (
          <button key={x.id} onClick={() => setSel(x)} className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-ink-50">
            {fila(x)}
          </button>
        ))}
      </Tarjeta>
      <Boton bloque variante="secundario" className="mt-3" onClick={() => setSel('nuevo')}>
        <Plus size={18} /> {textoNuevo}
      </Boton>
      <Hoja abierta={sel !== null} onCerrar={cerrar} titulo={sel !== null ? titulo(actual) : ''}>
        {sel !== null && form(actual, cerrar)}
      </Hoja>
    </>
  );
}

// ---------- Clases ----------
export function EditorClases() {
  const clases = useClases();
  const disciplinas = useDisciplinas();
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
              {c.dias.map((d) => DIAS_CORTOS[d]).join(', ') || 'Sin días'} · {c.horaInicio}
              {c.maestro && ` · ${c.maestro}`}
            </span>
          </span>
          {!c.activo && <Etiqueta>Pausada</Etiqueta>}
        </>
      )}
      form={(c, cerrar) => <FormClase clase={c} disciplinas={disciplinas} onHecho={cerrar} />}
    />
  );
}

function FormClase({ clase, disciplinas, onHecho }: { clase: Clase | null; disciplinas: Disciplina[]; onHecho: () => void }) {
  const avisar = useAvisos();
  const [disciplinaId, setDisciplinaId] = useState(clase?.disciplinaId ?? disciplinas[0]?.id ?? '');
  const [nivel, setNivel] = useState(clase?.nivel ?? '');
  const [maestro, setMaestro] = useState(clase?.maestro ?? '');
  const [dias, setDias] = useState<number[]>(clase?.dias ?? []);
  const [hora, setHora] = useState(clase?.horaInicio ?? '19:00');
  const [duracion, setDuracion] = useState(String(clase?.duracionMin ?? 60));
  const [activo, setActivo] = useState(clase?.activo ?? true);

  const guardar = async () => {
    const datos = { disciplinaId, nivel: nivel.trim(), maestro: maestro.trim(), dias: [...dias].sort(), horaInicio: hora, duracionMin: Number(duracion) || 60, activo };
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
      <Campo etiqueta="Días">
        <div className="grid grid-cols-7 gap-1.5">
          {[1, 2, 3, 4, 5, 6, 0].map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDias(dias.includes(d) ? dias.filter((x) => x !== d) : [...dias, d])}
              className={cx('h-11 rounded-xl text-sm font-semibold ring-1', dias.includes(d) ? 'bg-brand-500 text-white ring-brand-500' : 'bg-white ring-ink-100')}
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
      <Campo etiqueta="Maestro (opcional)">
        <Entrada value={maestro} onChange={(e) => setMaestro(e.target.value)} />
      </Campo>
      <Interruptor valor={activo} onChange={setActivo} texto="Clase activa" />
      <Boton grande bloque onClick={guardar} disabled={!disciplinaId || !dias.length}>
        Guardar
      </Boton>
    </div>
  );
}

// ---------- Planes ----------
export function EditorPlanes() {
  const planes = usePlanes();
  const orden: Record<TipoPlan, number> = { suelta: 0, mensual: 1, paquete: 2 };
  return (
    <Catalogo
      items={[...planes].sort((a, b) => orden[a.tipo] - orden[b.tipo])}
      textoNuevo="Nuevo plan"
      titulo={(p) => (p ? p.nombre : 'Nuevo plan')}
      fila={(p) => (
        <>
          <span className={cx('flex-1', !p.activo && 'opacity-40')}>
            <span className="block font-semibold">{p.nombre}</span>
            <span className="block text-sm text-ink-500">{describirPlan(p)}</span>
          </span>
          <span className="font-bold">{dinero(p.precio)}</span>
        </>
      )}
      form={(p, cerrar) => <FormPlan plan={p} onHecho={cerrar} />}
    />
  );
}

function FormPlan({ plan, onHecho }: { plan: Plan | null; onHecho: () => void }) {
  const avisar = useAvisos();
  const disciplinas = useDisciplinas();
  const [nombre, setNombre] = useState(plan?.nombre ?? '');
  const [tipo, setTipo] = useState<TipoPlan>(plan?.tipo ?? 'mensual');
  const [precio, setPrecio] = useState(plan ? aPesosTexto(plan.precio) : '');
  const [clases, setClases] = useState(String(plan?.clases ?? 8));
  const [vigencia, setVigencia] = useState(String(plan?.vigenciaDias ?? 30));
  const [disciplinaId, setDisciplinaId] = useState<ID | ''>(plan?.disciplinaId ?? '');
  const [activo, setActivo] = useState(plan?.activo ?? true);

  const guardar = async () => {
    const datos = {
      nombre: nombre.trim(),
      tipo,
      precio: aCentavos(precio),
      clases: tipo === 'paquete' ? Number(clases) || 1 : tipo === 'suelta' ? 1 : null,
      vigenciaDias: tipo === 'paquete' ? Number(vigencia) || 30 : null,
      disciplinaId: disciplinaId || null,
      activo,
    };
    if (plan) await actualizar('planes', plan.id, datos);
    else await crear('planes', datos);
    avisar('Plan guardado');
    onHecho();
  };

  return (
    <div className="space-y-4">
      <Segmentos<TipoPlan>
        opciones={[
          { valor: 'suelta', texto: 'Por clase' },
          { valor: 'mensual', texto: 'Mensual' },
          { valor: 'paquete', texto: 'Paquete' },
        ]}
        valor={tipo}
        onChange={setTipo}
      />
      <Campo etiqueta="Nombre">
        <Entrada value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder={tipo === 'suelta' ? 'Clase suelta' : tipo === 'mensual' ? 'Mensualidad' : 'Paquete 8 clases'} />
      </Campo>
      <Campo etiqueta="Precio">
        <Entrada inputMode="decimal" value={precio} onChange={(e) => setPrecio(e.target.value)} placeholder="$" />
      </Campo>
      {tipo === 'paquete' && (
        <div className="grid grid-cols-2 gap-3">
          <Campo etiqueta="Clases">
            <Entrada inputMode="numeric" value={clases} onChange={(e) => setClases(e.target.value.replace(/\D/g, ''))} />
          </Campo>
          <Campo etiqueta="Vigencia (días)">
            <Entrada inputMode="numeric" value={vigencia} onChange={(e) => setVigencia(e.target.value.replace(/\D/g, ''))} />
          </Campo>
        </div>
      )}
      {tipo !== 'suelta' && (
        <Campo etiqueta="¿Para qué clases sirve?">
          <Selector value={disciplinaId} onChange={(e) => setDisciplinaId(e.target.value)}>
            <option value="">Todas las disciplinas</option>
            {disciplinas.map((d) => (
              <option key={d.id} value={d.id}>
                Solo {d.nombre}
              </option>
            ))}
          </Selector>
        </Campo>
      )}
      <Interruptor valor={activo} onChange={setActivo} texto="Disponible para vender" />
      <Boton grande bloque onClick={guardar} disabled={!nombre.trim() || aCentavos(precio) <= 0}>
        Guardar
      </Boton>
    </div>
  );
}

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

function FormDisciplina({ disciplina, enUso, onHecho }: { disciplina: Disciplina | null; enUso: boolean; onHecho: () => void }) {
  const [nombre, setNombre] = useState(disciplina?.nombre ?? '');
  const [color, setColor] = useState(disciplina?.color ?? COLORES[2]);
  return (
    <div className="space-y-4">
      <Campo etiqueta="Nombre">
        <Entrada value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej. Cumbia, Kizomba" />
      </Campo>
      <Campo etiqueta="Color">
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

// ---------- Usuarios ----------
export function EditorUsuarios() {
  const usuarios = useUsuarios();
  return (
    <>
      <p className="mb-3 text-sm text-ink-500">Cada persona que cobra tiene su PIN. Así cada cobro queda registrado con su nombre.</p>
      <Catalogo
        items={usuarios}
        textoNuevo="Nuevo usuario"
        titulo={(u) => (u ? u.nombre : 'Nuevo usuario')}
        fila={(u) => (
          <>
            <Avatar nombre={u.nombre} tam={36} />
            <span className={cx('flex-1 font-semibold', !u.activo && 'opacity-40')}>{u.nombre}</span>
            <Etiqueta tono={u.rol === 'dueno' ? 'marca' : 'neutro'}>{u.rol === 'dueno' ? 'Dueño' : 'Recepción'}</Etiqueta>
          </>
        )}
        form={(u, cerrar) => <FormUsuario usuario={u} onHecho={cerrar} />}
      />
    </>
  );
}

function FormUsuario({ usuario, onHecho }: { usuario: Usuario | null; onHecho: () => void }) {
  const { academia, usuario: yo } = useSesion();
  const avisar = useAvisos();
  const usuarios = useUsuarios();
  const [nombre, setNombre] = useState(usuario?.nombre ?? '');
  const [rol, setRol] = useState<Rol>(usuario?.rol ?? 'recepcion');
  const [pin, setPin] = useState('');
  const [activo, setActivo] = useState(usuario?.activo ?? true);
  const esUltimoDueno = usuario?.rol === 'dueno' && usuarios.filter((u) => u.rol === 'dueno' && u.activo).length === 1;
  const pinValido = /^\d{4}$/.test(pin);

  const guardar = async () => {
    if (usuario) {
      await actualizar('usuarios', usuario.id, {
        nombre: nombre.trim(),
        rol: esUltimoDueno ? 'dueno' : rol,
        activo: esUltimoDueno || usuario.id === yo.id ? true : activo,
        ...(pinValido ? { pinHash: await hashPin(pin, academia.id) } : {}),
      });
    } else {
      await crearUsuario({ nombre, rol, pin, academiaId: academia.id });
    }
    avisar('Usuario guardado');
    onHecho();
  };

  return (
    <div className="space-y-4">
      <Campo etiqueta="Nombre">
        <Entrada value={nombre} onChange={(e) => setNombre(e.target.value)} />
      </Campo>
      {!esUltimoDueno && (
        <Segmentos<Rol>
          opciones={[
            { valor: 'recepcion', texto: 'Recepción' },
            { valor: 'dueno', texto: 'Dueño' },
          ]}
          valor={rol}
          onChange={setRol}
        />
      )}
      <Campo etiqueta={usuario ? 'Nuevo PIN (déjalo vacío para no cambiarlo)' : 'PIN de 4 dígitos'}>
        <Entrada inputMode="numeric" type="password" maxLength={4} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} placeholder="••••" />
      </Campo>
      {usuario && !esUltimoDueno && usuario.id !== yo.id && <Interruptor valor={activo} onChange={setActivo} texto="Puede entrar a la app" />}
      <Boton grande bloque onClick={guardar} disabled={!nombre.trim() || (!usuario && !pinValido) || (pin.length > 0 && !pinValido)}>
        Guardar
      </Boton>
    </div>
  );
}

function Interruptor({ valor, onChange, texto }: { valor: boolean; onChange: (v: boolean) => void; texto: string }) {
  return (
    <button type="button" onClick={() => onChange(!valor)} className="flex w-full items-center justify-between rounded-xl bg-white px-4 py-3 ring-1 ring-ink-100">
      <span className="font-medium">{texto}</span>
      <span className={cx('relative h-7 w-12 rounded-full transition', valor ? 'bg-ok-600' : 'bg-ink-300')}>
        <span className={cx('absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all', valor ? 'left-[22px]' : 'left-0.5')} />
      </span>
    </button>
  );
}
