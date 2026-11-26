import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useMaestros, useUsuarios } from '../../app/datos';
import { useSesion } from '../../app/sesion';
import { useAvisos } from '../../components/avisos';
import { Avatar, Boton, Campo, Entrada, EntradaClave, Etiqueta, Interruptor, Segmentos, Selector } from '../../components/ui';
import { actualizar } from '../../db/repo';
import { NOMBRE_ROL, type Maestro, type Rol, type Usuario } from '../../db/types';
import { useLiveQuery } from 'dexie-react-hooks';
import { getMeta } from '../../db/db';
import { baseTieneColumna } from '../../sync/supabase';
import { LARGO_PIN, crearUsuario, hashPin, largoPin, pinDebil, pinValido } from '../../domain/acceso';
import { Catalogo } from './Catalogo';

// ---------- Usuarios ----------
export function EditorUsuarios() {
  const usuarios = useUsuarios();
  const maestros = useMaestros();
  return (
      <Catalogo
        items={usuarios}
        textoNuevo="Nuevo usuario"
        arriba={(nuevo) => <Boton className="mb-3" onClick={nuevo}><Plus size={18} aria-hidden="true" /> Nuevo usuario</Boton>}
        titulo={(u) => (u ? u.nombre : 'Nuevo usuario')}
        fila={(u) => (
          <>
            <Avatar nombre={u.nombre} tam={36} />
            <span className="min-w-0 flex-1 break-words font-semibold">
              {u.nombre}
              {!u.activo && <span className="block text-xs font-medium text-ink-500">Acceso desactivado</span>}
            </span>
            <Etiqueta tono={u.rol === 'dueno' ? 'marca' : u.rol === 'maestro' ? 'ok' : 'neutro'}>{NOMBRE_ROL[u.rol]}</Etiqueta>
          </>
        )}
        form={(u, cerrar) => <FormUsuario usuario={u} usuarios={usuarios} maestros={maestros} onHecho={cerrar} />}
      />
  );
}

function FormUsuario({ usuario, usuarios, maestros, onHecho }: { usuario: Usuario | null; usuarios: Usuario[]; maestros: Maestro[]; onHecho: () => void }) {
  const { academia, usuario: yo } = useSesion();
  const avisar = useAvisos();
  const [nombre, setNombre] = useState(usuario?.nombre ?? '');
  const [rol, setRol] = useState<Rol>(usuario?.rol ?? 'recepcion');
  const disponibles = maestros.filter((m) => m.activo);
  const maestroVinculado = maestros.find((m) => m.id === usuario?.maestroId);
  const [maestroId, setMaestroId] = useState<string>(usuario?.maestroId ?? '');
  const vinculada = useLiveQuery(() => getMeta<boolean>('nubeVinculada'), [], false);
  // Si usa nube, el rol "maestro" requiere la base actualizada (si no, la sincronización fallaría)
  const baseLista = useLiveQuery(async () => (vinculada ? baseTieneColumna('usuarios', 'maestro_id') : true), [vinculada], true);
  const [pin, setPin] = useState('');
  const [activo, setActivo] = useState(usuario?.activo ?? true);
  const [guardando, setGuardando] = useState(false);
  const esUltimoDueno = usuario?.rol === 'dueno' && usuario.activo && usuarios.filter((u) => u.rol === 'dueno' && u.activo).length === 1;
  const pinOk = pinValido(pin);
  const falta = !nombre.trim()
    ? 'Escribe su nombre'
    : rol === 'maestro' && !maestroId
      ? 'Vincula la ficha del maestro'
      : (!usuario || pin.length > 0) && !pinOk
        ? `Su PIN debe tener ${LARGO_PIN} dígitos sin orden`
        : rol === 'maestro' && !baseLista
          ? 'Falta actualizar la base de datos'
          : '';

  const guardar = async () => {
    setGuardando(true);
    try {
      if (usuario) {
        const rolGuardado = esUltimoDueno ? 'dueno' : rol;
        await actualizar('usuarios', usuario.id, {
          nombre: nombre.trim(),
          rol: rolGuardado,
          maestroId: rolGuardado === 'maestro' ? maestroId || null : null,
          activo: esUltimoDueno || usuario.id === yo.id ? true : activo,
          ...(pinOk ? { pinHash: await hashPin(pin, academia.id) } : {}),
        });
      } else {
        await crearUsuario({ nombre, rol, pin, academiaId: academia.id, maestroId: rol === 'maestro' ? maestroId : null });
      }
      avisar('Usuario guardado');
      onHecho();
    } catch {
      avisar('No se pudo guardar el usuario. Inténtalo de nuevo.', 'error');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="space-y-4">
      <Campo etiqueta="Nombre">
        <Entrada autoFocus={!usuario} value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej. Monse" />
      </Campo>
      {!esUltimoDueno && (
        <Campo etiqueta="Rol y permisos" grupo>
          <Segmentos<Rol>
            opciones={[
              { valor: 'recepcion', texto: 'Recepción' },
              { valor: 'maestro', texto: 'Maestro' },
              { valor: 'dueno', texto: 'Dueño' },
            ]}
            valor={rol}
            onChange={setRol}
          />
        </Campo>
      )}
      {esUltimoDueno && <p className="text-sm font-semibold">Dueño · último acceso de dirección activo</p>}
      <p className="-mt-2 px-1 text-xs text-ink-500">
        {rol === 'dueno'
          ? 'Ve y cambia todo: precios, usuarios, reportes y dinero.'
          : rol === 'recepcion'
            ? 'Cobra, da entradas y hace el corte. No cambia precios ni usuarios.'
            : 'Ve las listas y asistencias de sus clases, sin acceso a cobros ni reportes de dinero.'}
      </p>
      {rol === 'maestro' &&
        (!baseLista ? (
          <p className="rounded-xl bg-warn-50 px-3 py-2 text-sm font-medium text-warn-600">
            Para dar acceso a maestros hay que actualizar la base de datos (correr supabase/schema.sql). Pídeselo a tu proveedor.
          </p>
        ) : (
          <Campo etiqueta="Ficha del maestro" ayuda={disponibles.length ? 'Sus clases se asignan en el catálogo Maestros.' : 'Para vincular un acceso nuevo, agrega primero un maestro activo en Más → Maestros.'}>
            <Selector
              value={maestroId}
              onChange={(e) => {
                setMaestroId(e.target.value);
                const m = maestros.find((x) => x.id === e.target.value);
                if (m && !nombre.trim()) setNombre(m.nombre);
              }}
            >
              <option value="">Elige un maestro</option>
              {maestroVinculado && !maestroVinculado.activo && <option value={maestroVinculado.id}>{maestroVinculado.nombre} (inactivo)</option>}
              {disponibles.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nombre}
                </option>
              ))}
            </Selector>
          </Campo>
        ))}
      <Campo etiqueta={usuario ? `Nuevo PIN de ${LARGO_PIN} dígitos` : `PIN de ${LARGO_PIN} dígitos`} ayuda={usuario && largoPin(usuario) < LARGO_PIN ? `PIN actual de ${largoPin(usuario)} dígitos. Si dejas el campo vacío, se conserva.` : usuario ? 'Déjalo vacío para conservar el PIN actual.' : 'Evita fechas de nacimiento o números seguidos.'}>
        <EntradaClave inputMode="numeric" maxLength={LARGO_PIN} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} placeholder={'•'.repeat(LARGO_PIN)} />
        {pin.length === LARGO_PIN && pinDebil(pin) && <span className="mt-1 block text-xs font-medium text-bad-600">Muy fácil de adivinar: usa números sin orden.</span>}
      </Campo>
      {usuario && !esUltimoDueno && usuario.id !== yo.id && <Interruptor valor={activo} onChange={setActivo} texto="Puede entrar a la app" />}
      <div>
        <Boton grande bloque onClick={guardar} disabled={!!falta || guardando}>
          {guardando ? 'Guardando…' : 'Guardar'}
        </Boton>
        {falta && <p className="mt-2 text-center text-sm text-ink-500">{falta}</p>}
      </div>
    </div>
  );
}
