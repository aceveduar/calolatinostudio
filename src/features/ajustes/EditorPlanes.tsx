import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useDisciplinas, usePlanes } from '../../app/datos';
import { useSesion } from '../../app/sesion';
import { useAvisos } from '../../components/avisos';
import { Boton, Campo, Entrada, Etiqueta, Interruptor, Segmentos, Selector, Tarjeta } from '../../components/ui';
import { actualizar, crear } from '../../db/repo';
import { type ID, type Plan, type TipoPlan } from '../../db/types';
import { aCentavos, aPesosTexto, dinero } from '../../domain/dinero';
import { describirPlan } from '../../domain/planes';
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
    <Catalogo
      items={[...planes].sort((a, b) => (esBeca(a) ? 3 : orden[a.tipo]) - (esBeca(b) ? 3 : orden[b.tipo]))}
      textoNuevo="Nuevo plan"
      arriba={(nuevo) => <Boton className="mb-3" onClick={nuevo}><Plus size={18} aria-hidden="true" /> Nuevo plan</Boton>}
      titulo={(p) => (p ? p.nombre : 'Nuevo plan')}
      fila={(p) => (
        <>
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">{p.nombre}</span>
            <span className="block text-sm text-ink-500">
              {describirPlan(p)}
              {sedes.length > 0 && ` · ${p.sedeId ? `solo ${p.sedeId === PRINCIPAL ? nombreSede(null, sedes, academia) : nombreSede(p.sedeId, sedes, academia)}` : 'todas las sedes'}`}
            </span>
            {!p.activo && <Etiqueta>Inactivo</Etiqueta>}
          </span>
          <span className="shrink-0 text-sm font-bold">{esBeca(p) ? 'Sin costo' : dinero(p.precio)}</span>
        </>
      )}
      vacio="Aún no hay planes. Empieza por la clase suelta y la mensualidad."
      form={(p, cerrar) => <FormPlan plan={p} onHecho={cerrar} />}
    />
    <h2 className="mt-6 mb-2 px-1 text-xs font-bold tracking-wider text-ink-500 uppercase">Ajustes de cobro</h2>
    <Recargo />
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
    <Tarjeta className="p-4">
      <Campo etiqueta="Recargo por día de atraso (mensualidades)" ayuda="Se suma al renovar una mensualidad vencida; en cada cobro se puede quitar. Vacío = sin recargo.">
        <Entrada inputMode="decimal" value={txt} onChange={(e) => setTxt(e.target.value)} placeholder="Ej. 10" />
      </Campo>
      {aCentavos(txt) !== (academia.recargoDiario ?? 0) && (
        <Boton variante="secundario" className="mt-3" onClick={guardar}>Guardar recargo</Boton>
      )}
    </Tarjeta>
  );
}

type TipoEditable = TipoPlan | 'beca';

export function FormPlan({ plan, onHecho }: { plan: Plan | null; onHecho: () => void }) {
  const avisar = useAvisos();
  const disciplinas = useDisciplinas();
  // 'beca' solo existe en el formulario: se guarda como paquete de $0 con clases ilimitadas
  const tipoOriginal: TipoEditable = esBeca(plan) ? 'beca' : (plan?.tipo ?? 'mensual');
  const [tipo, setTipo] = useState(tipoOriginal);
  const [nombres, setNombres] = useState<Partial<Record<TipoEditable, string>>>(() => ({ [tipoOriginal]: plan?.nombre ?? '' }));
  const [precios, setPrecios] = useState<Partial<Record<TipoEditable, string>>>(() => ({ [tipoOriginal]: plan ? aPesosTexto(plan.precio) : '' }));
  const [clases, setClases] = useState(String(tipoOriginal === 'paquete' ? plan?.clases ?? 8 : 8));
  const [vigencias, setVigencias] = useState<Partial<Record<TipoEditable, string>>>(() => ({
    paquete: String(tipoOriginal === 'paquete' ? plan?.vigenciaDias ?? 30 : 30),
    beca: String(tipoOriginal === 'beca' ? plan?.vigenciaDias ?? VIGENCIA_BECA : VIGENCIA_BECA),
  }));
  const nombre = nombres[tipo] ?? '';
  const precio = precios[tipo] ?? '';
  const vigencia = vigencias[tipo] ?? '';
  const [disciplinaId, setDisciplinaId] = useState<ID | ''>(plan?.disciplinaId ?? '');
  const [activo, setActivo] = useState(plan?.activo ?? true);
  const { academia } = useSesion();
  const sedes = useSedes();
  const [alcance, setAlcance] = useState<string>(plan?.sedeId ?? '');
  const [grupos, setGrupos] = useState<string>(String(plan?.grupos ?? ''));

  const g = tipo === 'mensual' ? Number(grupos) || 0 : 0;
  // si no le pone nombre, se usa uno claro según lo elegido
  const cantidad = Number(clases) || 1;
  const sugerido =
    tipo === 'suelta' ? 'Clase suelta' : tipo === 'beca' ? 'Beca' : tipo === 'paquete' ? `Paquete ${cantidad} ${cantidad === 1 ? 'clase' : 'clases'}` : g ? `Mensual ${g} ${g === 1 ? 'grupo' : 'grupos'}` : 'Mensualidad';
  const vista: Plan = {
    ...(plan ?? ({} as Plan)),
    nombre: nombre.trim() || sugerido,
    tipo: tipo === 'beca' ? 'paquete' : tipo,
    precio: tipo === 'beca' ? 0 : aCentavos(precio),
    clases: tipo === 'paquete' ? cantidad : tipo === 'suelta' ? 1 : null,
    vigenciaDias: tipo === 'paquete' ? Number(vigencia) || 30 : tipo === 'beca' ? Number(vigencia) || VIGENCIA_BECA : null,
    grupos: g || null,
  };
  const falta = tipo !== 'beca' && vista.precio <= 0 ? 'Escribe el precio'
    : tipo === 'paquete' && Number(clases) <= 0 ? 'Escribe cuántas clases incluye'
      : (tipo === 'beca' || tipo === 'paquete') && Number(vigencia) <= 0 ? 'Escribe cuántos días dura' : '';

  const guardar = async () => {
    const datos = {
      ...(g ? { grupos: g } : plan?.grupos ? { grupos: null } : {}),
      ...conSede(alcance, plan?.sedeId),
      nombre: vista.nombre,
      tipo: vista.tipo,
      precio: vista.precio,
      clases: vista.clases,
      vigenciaDias: vista.vigenciaDias,
      disciplinaId: tipo === 'suelta' ? (tipoOriginal === 'suelta' ? plan?.disciplinaId ?? null : null) : disciplinaId || null,
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
          { valor: 'suelta', texto: 'Clase suelta' },
          { valor: 'mensual', texto: 'Mensual' },
          { valor: 'paquete', texto: 'Paquete' },
          { valor: 'beca', texto: 'Beca' },
        ]}
        valor={tipo}
        onChange={setTipo}
      />
      {tipo !== 'beca' && (
        <p className="-mt-2 px-1 text-xs text-ink-500">
          {tipo === 'suelta' ? 'Pago por una clase.' : tipo === 'mensual' ? 'Un mes de clases por cada vigencia.' : 'Las clases se descuentan conforme el alumno asiste.'}
        </p>
      )}
      {tipo === 'beca' && (
        <p className="rounded-xl bg-ok-50 px-3 py-2 text-sm text-ok-600">
          Dirección puede otorgar la beca desde la ficha del alumno.
        </p>
      )}
      <Campo etiqueta="Nombre (opcional)" ayuda={nombre.trim() ? undefined : `Si lo dejas vacío se llamará “${sugerido}”.`}>
        <Entrada value={nombre} onChange={(e) => setNombres({ ...nombres, [tipo]: e.target.value })} placeholder={sugerido} />
      </Campo>
      {tipo === 'beca' ? (
        <Campo etiqueta="Vigencia (días)" ayuda="180 días ≈ un semestre.">
          <Entrada inputMode="numeric" value={vigencia} onChange={(e) => setVigencias({ ...vigencias, [tipo]: e.target.value.replace(/\D/g, '') })} />
        </Campo>
      ) : (
        <Campo etiqueta="Precio">
          <Entrada inputMode="decimal" value={precio} onChange={(e) => setPrecios({ ...precios, [tipo]: e.target.value })} placeholder="$" />
        </Campo>
      )}
      {tipo === 'mensual' && (
        <Campo etiqueta="Grupos que cubre" ayuda="Si eliges un límite, recepción selecciona los grupos al vender el plan." grupo>
          <Segmentos<string>
            opciones={[
              { valor: '', texto: 'Todos' },
              { valor: '1', texto: '1 grupo' },
              { valor: '2', texto: '2 grupos' },
              { valor: '3', texto: '3 grupos' },
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
            <Entrada inputMode="numeric" value={vigencia} onChange={(e) => setVigencias({ ...vigencias, [tipo]: e.target.value.replace(/\D/g, '') })} />
          </Campo>
        </div>
      )}
      {sedes.length > 0 && (
        <Campo
          etiqueta={tipo === 'suelta' ? 'Sede de la tarifa' : 'Sedes que cubre'}
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
        <Campo etiqueta="Disciplina que cubre">
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
      {plan && <Interruptor valor={activo} onChange={setActivo} texto={tipo === 'beca' ? 'Disponible para otorgar' : 'Disponible para vender'} />}
      {plan && tipo !== tipoOriginal && <p className="rounded-xl bg-warn-50 px-3 py-2 text-sm text-warn-600">Estás cambiando el tipo de un plan existente. Crea otro plan si quieres conservar esta opción para seguir vendiéndola.</p>}
      {/* cómo se verá al cobrar */}
      {!falta && (
        <p className="flex items-center justify-between gap-3 rounded-2xl bg-brand-50 px-4 py-3 text-sm">
          <span className="min-w-0">
            <b className="block">{vista.nombre}</b>
            <span className="text-ink-700">{describirPlan(vista)}</span>
          </span>
          <b className="shrink-0 text-base">{tipo === 'beca' ? 'Sin costo' : dinero(vista.precio)}</b>
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
