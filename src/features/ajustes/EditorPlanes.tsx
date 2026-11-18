import { useState } from 'react';
import { useDisciplinas, usePlanes } from '../../app/datos';
import { useSesion } from '../../app/sesion';
import { useAvisos } from '../../components/avisos';
import { Boton, Campo, Entrada, Etiqueta, Interruptor, Segmentos, Selector, Tarjeta, cx } from '../../components/ui';
import { actualizar, crear } from '../../db/repo';
import { type ID, type Plan, type TipoPlan } from '../../db/types';
import { aCentavos, aPesosTexto, dinero } from '../../domain/dinero';
import { describirPlan } from '../alumnos/VenderPlan';
import { PRINCIPAL, nombreSede, useSedes } from '../../app/sedes';
import { conSede } from '../../domain/sedes';
import { VIGENCIA_BECA, esBeca } from '../../domain/becas';
import { Catalogo } from './Catalogo';

// ---------- Planes ----------
export function EditorPlanes() {
  const { academia } = useSesion();
  const sedes = useSedes();
  const planes = usePlanes();
  const orden: Record<TipoPlan, number> = { suelta: 0, mensual: 1, paquete: 2 };
  return (
    <>
    <Recargo />
    <Catalogo
      items={[...planes].sort((a, b) => (esBeca(a) ? 3 : orden[a.tipo]) - (esBeca(b) ? 3 : orden[b.tipo]))}
      textoNuevo="Nuevo plan"
      titulo={(p) => (p ? p.nombre : 'Nuevo plan')}
      fila={(p) => (
        <>
          <span className={cx('flex-1', !p.activo && 'opacity-40')}>
            <span className="block font-semibold">{p.nombre}</span>
            <span className="block text-sm text-ink-500">
              {describirPlan(p)}
              {sedes.length > 0 && ` · ${p.sedeId ? `solo ${p.sedeId === PRINCIPAL ? nombreSede(null, sedes, academia) : nombreSede(p.sedeId, sedes, academia)}` : 'todas las sedes'}`}
            </span>
          </span>
          {esBeca(p) ? <Etiqueta tono="ok">Beca</Etiqueta> : <span className="font-bold">{dinero(p.precio)}</span>}
        </>
      )}
      form={(p, cerrar) => <FormPlan plan={p} onHecho={cerrar} />}
    />
    </>
  );
}

/** Recargo por día de atraso en mensualidades (p. ej. $10). Se sugiere al renovar; se puede quitar en cada cobro. */
export function Recargo() {
  const { academia } = useSesion();
  const avisar = useAvisos();
  const [txt, setTxt] = useState(academia.recargoDiario ? aPesosTexto(academia.recargoDiario) : '');
  const guardar = async () => {
    const v = aCentavos(txt);
    if (v === (academia.recargoDiario ?? 0)) return;
    await actualizar('academias', academia.id, { recargoDiario: v || null });
    avisar(v ? `Recargo: ${dinero(v)} por día de atraso` : 'Sin recargo por atraso');
  };
  return (
    <Tarjeta className="mb-3 p-4">
      <Campo etiqueta="Recargo por día de atraso (mensualidades)" ayuda="Se suma al renovar una mensualidad vencida; en cada cobro se puede quitar. Vacío = sin recargo.">
        <Entrada inputMode="decimal" value={txt} onChange={(e) => setTxt(e.target.value)} onBlur={guardar} placeholder="Ej. 10" />
      </Campo>
    </Tarjeta>
  );
}

export function FormPlan({ plan, onHecho }: { plan: Plan | null; onHecho: () => void }) {
  const avisar = useAvisos();
  const disciplinas = useDisciplinas();
  const [nombre, setNombre] = useState(plan?.nombre ?? '');
  // 'beca' solo existe en el formulario: se guarda como paquete de $0 con clases ilimitadas
  const [tipo, setTipo] = useState<TipoPlan | 'beca'>(esBeca(plan) ? 'beca' : (plan?.tipo ?? 'mensual'));
  const [precio, setPrecio] = useState(plan ? aPesosTexto(plan.precio) : '');
  const [clases, setClases] = useState(String(plan?.clases ?? 8));
  const [vigencia, setVigencia] = useState(String(plan?.vigenciaDias ?? (esBeca(plan) ? VIGENCIA_BECA : 30)));
  const [disciplinaId, setDisciplinaId] = useState<ID | ''>(plan?.disciplinaId ?? '');
  const [activo, setActivo] = useState(plan?.activo ?? true);
  const { academia } = useSesion();
  const sedes = useSedes();
  const [alcance, setAlcance] = useState<string>(plan?.sedeId ?? '');
  const [grupos, setGrupos] = useState<string>(String(plan?.grupos ?? ''));

  const guardar = async () => {
    const g = tipo === 'mensual' ? Number(grupos) || 0 : 0;
    const datos = {
      ...(g ? { grupos: g } : plan?.grupos ? { grupos: null } : {}),
      ...conSede(alcance, plan?.sedeId),
      nombre: nombre.trim(),
      tipo: tipo === 'beca' ? ('paquete' as const) : tipo,
      precio: tipo === 'beca' ? 0 : aCentavos(precio),
      clases: tipo === 'paquete' ? Number(clases) || 1 : tipo === 'suelta' ? 1 : null,
      vigenciaDias: tipo === 'paquete' ? Number(vigencia) || 30 : tipo === 'beca' ? Number(vigencia) || VIGENCIA_BECA : null,
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
      <Segmentos<TipoPlan | 'beca'>
        opciones={[
          { valor: 'suelta', texto: 'Por clase' },
          { valor: 'mensual', texto: 'Mensual' },
          { valor: 'paquete', texto: 'Paquete' },
          { valor: 'beca', texto: 'Beca' },
        ]}
        valor={tipo}
        onChange={(t) => {
          setTipo(t);
          if (t === 'beca' && !plan) setVigencia(String(VIGENCIA_BECA));
          if (t === 'paquete' && !plan) setVigencia('30');
        }}
      />
      {tipo === 'beca' && (
        <p className="rounded-xl bg-ok-50 px-3 py-2 text-sm text-ok-600">
          El alumno becado entra a sus clases sin pagar. Solo la dirección puede dar becas; al terminar la vigencia se renueva desde su ficha.
        </p>
      )}
      <Campo etiqueta="Nombre">
        <Entrada value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder={tipo === 'suelta' ? 'Clase suelta' : tipo === 'mensual' ? 'Mensualidad' : tipo === 'beca' ? 'Beca' : 'Paquete 8 clases'} />
      </Campo>
      {tipo === 'beca' ? (
        <Campo etiqueta="Vigencia (días)" ayuda="180 días ≈ un semestre.">
          <Entrada inputMode="numeric" value={vigencia} onChange={(e) => setVigencia(e.target.value.replace(/\D/g, ''))} />
        </Campo>
      ) : (
        <Campo etiqueta="Precio">
          <Entrada inputMode="decimal" value={precio} onChange={(e) => setPrecio(e.target.value)} placeholder="$" />
        </Campo>
      )}
      {tipo === 'mensual' && (
        <Campo etiqueta="¿Cuántas clases cubre?" ayuda="Para cobrar por clase: p. ej. una clase $300, dos clases $450. Al cobrar se eligen cuáles." grupo>
          <Segmentos<string>
            opciones={[
              { valor: '', texto: 'Todas' },
              { valor: '1', texto: '1 clase' },
              { valor: '2', texto: '2 clases' },
              { valor: '3', texto: '3 clases' },
            ]}
            valor={grupos}
            onChange={setGrupos}
          />
        </Campo>
      )}
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
      {sedes.length > 0 && (
        <Campo
          etiqueta={tipo === 'suelta' ? '¿En qué sede aplica este precio?' : '¿En qué sedes sirve?'}
          ayuda={tipo === 'suelta' ? 'Puedes tener un precio de clase suelta distinto en cada sede.' : undefined}
        >
          <Selector value={alcance} onChange={(e) => setAlcance(e.target.value)}>
            <option value="">Todas las sedes</option>
            <option value={PRINCIPAL}>Solo {nombreSede(null, sedes, academia)}</option>
            {sedes.map((x) => (
              <option key={x.id} value={x.id}>
                Solo {x.nombre}
              </option>
            ))}
          </Selector>
        </Campo>
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
      <Boton grande bloque onClick={guardar} disabled={!nombre.trim() || (tipo === 'beca' ? !(Number(vigencia) > 0) : aCentavos(precio) <= 0)}>
        Guardar
      </Boton>
    </div>
  );
}
