import { useState } from 'react';
import { useClases } from '../../app/datos';
import { useSesion } from '../../app/sesion';
import { useAvisos } from '../../components/avisos';
import { Boton, Campo, Entrada, Interruptor, Tarjeta, cx } from '../../components/ui';
import { actualizar, crear } from '../../db/repo';
import { type ID, type Sede } from '../../db/types';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { Catalogo } from './Catalogo';

// ---------- Sedes ----------
const COLORES_SEDE = ['#d6304a', '#7c4ddb', '#1f8fd6', '#15924b', '#d97706', '#0d9488', '#db2777', '#3d3a48'];

export function EditorSedes() {
  const { academia } = useSesion();
  const avisar = useAvisos();
  const sedes = useLiveQuery(async () => (await db.sedes.filter((x) => !x.deletedAt).toArray()).sort((a, b) => a.nombre.localeCompare(b.nombre)), [], [] as Sede[]);
  const clases = useClases();
  const [principal, setPrincipal] = useState(academia.sedePrincipal ?? '');
  const cuenta = (id: ID | null) => clases.filter((c) => (c.sedeId ?? null) === id && c.activo).length;
  const nClases = (id: ID | null) => `${cuenta(id)} ${cuenta(id) === 1 ? 'clase' : 'clases'}`;
  return (
    <>
      <p className="mb-3 text-sm text-ink-500">
        ¿Das clases en más de un lugar? Cada sede tiene sus clases, su precio y su corte de caja. Si solo tienes uno, basta con ponerle nombre a tu sede principal.
      </p>
      <Tarjeta className="mb-3 space-y-2 p-4">
        <p className="text-sm font-semibold">Sede principal</p>
        <div className="flex gap-2">
          <Entrada value={principal} onChange={(e) => setPrincipal(e.target.value)} placeholder={`Ej. ${academia.nombre} Centro`} aria-label="Nombre de la sede principal" />
          <Boton
            variante="secundario"
            disabled={principal.trim() === (academia.sedePrincipal ?? '')}
            onClick={async () => {
              await actualizar('academias', academia.id, { sedePrincipal: principal.trim() || null });
              avisar('Sede principal guardada');
            }}
          >
            Guardar
          </Boton>
        </div>
        <p className="text-xs text-ink-500">{nClases(null)} · {sedes.length ? 'Lo que no es de otra sede queda aquí.' : 'Aquí queda todo mientras no agregues otra sede.'}</p>
      </Tarjeta>
      <Catalogo
        items={sedes}
        textoNuevo="Nueva sede"
        titulo={(x) => (x ? x.nombre : 'Nueva sede')}
        fila={(x) => (
          <>
            <span className="h-4 w-4 rounded-full" style={{ background: x.color }} />
            <span className={cx('flex-1 font-semibold', !x.activo && 'opacity-40')}>{x.nombre}</span>
            <span className="text-sm text-ink-500">{nClases(x.id)}</span>
          </>
        )}
        form={(x, cerrar) => <FormSede sede={x} onHecho={cerrar} />}
      />
    </>
  );
}

export function FormSede({ sede, onHecho }: { sede: Sede | null; onHecho: () => void }) {
  const avisar = useAvisos();
  const [nombre, setNombre] = useState(sede?.nombre ?? '');
  const [color, setColor] = useState(sede?.color ?? COLORES_SEDE[1]);
  const [activo, setActivo] = useState(sede?.activo ?? true);
  return (
    <div className="space-y-4">
      <Campo etiqueta="Nombre">
        <Entrada autoFocus={!sede} value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej. Casa de Cultura" />
      </Campo>
      <Campo etiqueta="Color" grupo>
        <div className="flex flex-wrap gap-3">
          {COLORES_SEDE.map((c) => (
            <button key={c} type="button" onClick={() => setColor(c)} className={cx('h-10 w-10 rounded-full ring-offset-2', color === c && 'ring-2 ring-ink-900')} style={{ background: c }} aria-label={`Color ${c}`} aria-pressed={color === c} />
          ))}
        </div>
      </Campo>
      {sede && <Interruptor valor={activo} onChange={setActivo} texto="Sede activa" />}
      <p className="rounded-xl bg-ink-50 p-3 text-xs text-ink-500">Después: asigna sus clases en “Clases y horarios” y, si su precio es distinto, crea su “Clase suelta” en “Planes y precios”.</p>
      <Boton
        grande
        bloque
        disabled={!nombre.trim()}
        onClick={async () => {
          const datos = { nombre: nombre.trim(), color, activo };
          if (sede) await actualizar('sedes', sede.id, datos);
          else await crear('sedes', datos);
          avisar('Sede guardada');
          onHecho();
        }}
      >
        Guardar
      </Boton>
    </div>
  );
}
