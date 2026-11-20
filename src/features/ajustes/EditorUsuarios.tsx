import { useState } from 'react';
import { useMaestros, useUsuarios } from '../../app/datos';
import { useSesion } from '../../app/sesion';
import { useAvisos } from '../../components/avisos';
import { Avatar, Boton, Campo, Entrada, EntradaClave, Etiqueta, Interruptor, Segmentos, Selector, cx } from '../../components/ui';
import { actualizar } from '../../db/repo';
import { NOMBRE_ROL, type Rol, type Usuario } from '../../db/types';
import { useLiveQuery } from 'dexie-react-hooks';
import { getMeta } from '../../db/db';
import { baseTieneColumna } from '../../sync/supabase';
import { LARGO_PIN, crearUsuario, hashPin, largoPin, pinDebil, pinValido } from '../../domain/acceso';
import { Catalogo } from './Catalogo';

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
            <Etiqueta tono={u.rol === 'dueno' ? 'marca' : u.rol === 'maestro' ? 'ok' : 'neutro'}>{NOMBRE_ROL[u.rol]}</Etiqueta>
          </>
        )}
        form={(u, cerrar) => <FormUsuario usuario={u} onHecho={cerrar} />}
      />
    </>
  );
}

export function FormUsuario({ usuario, onHecho }: { usuario: Usuario | null; onHecho: () => void }) {
  const { academia, usuario: yo } = useSesion();
  const avisar = useAvisos();
  const usuarios = useUsuarios();
  const [nombre, setNombre] = useState(usuario?.nombre ?? '');
  const [rol, setRol] = useState<Rol>(usuario?.rol ?? 'recepcion');
  const maestros = useMaestros().filter((m) => m.activo);
  const [maestroId, setMaestroId] = useState<string>(usuario?.maestroId ?? '');
  const vinculada = useLiveQuery(() => getMeta<boolean>('nubeVinculada'), [], false);
  // Si usa nube, el rol "maestro" requiere la base actualizada (si no, la sincronización fallaría)
  const baseLista = useLiveQuery(async () => (vinculada ? baseTieneColumna('usuarios', 'maestro_id') : true), [vinculada], true);
  const [pin, setPin] = useState('');
  const [activo, setActivo] = useState(usuario?.activo ?? true);
  const esUltimoDueno = usuario?.rol === 'dueno' && usuarios.filter((u) => u.rol === 'dueno' && u.activo).length === 1;
  const pinOk = pinValido(pin);
  const falta = !nombre.trim()
    ? 'Escribe su nombre'
    : rol === 'maestro' && !maestroId
      ? 'Elige qué maestro es'
      : (!usuario || pin.length > 0) && !pinOk
        ? `Su PIN debe tener ${LARGO_PIN} dígitos sin orden`
        : rol === 'maestro' && !baseLista
          ? 'Falta actualizar la base de datos'
          : '';

  const guardar = async () => {
    if (usuario) {
      await actualizar('usuarios', usuario.id, {
        nombre: nombre.trim(),
        rol: esUltimoDueno ? 'dueno' : rol,
        maestroId: rol === 'maestro' ? maestroId || null : null,
        activo: esUltimoDueno || usuario.id === yo.id ? true : activo,
        ...(pinOk ? { pinHash: await hashPin(pin, academia.id) } : {}),
      });
    } else {
      await crearUsuario({ nombre, rol, pin, academiaId: academia.id, maestroId: maestroId || null });
    }
    avisar('Usuario guardado');
    onHecho();
  };

  return (
    <div className="space-y-4">
      <Campo etiqueta="Nombre">
        <Entrada autoFocus={!usuario} value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej. Monse" />
      </Campo>
      {!esUltimoDueno && (
        <Campo etiqueta="¿Qué hace en la academia?" grupo>
        <Segmentos<Rol>
          opciones={[
            { valor: 'recepcion', texto: 'Recepción' },
            { valor: 'maestro', texto: 'Maestro' },
            { valor: 'dueno', texto: 'Dueño' },
          ]}
          valor={rol}
          onChange={(r) => {
            setRol(r);
            if (r === 'maestro' && !nombre.trim() && maestros.length === 1) setNombre(maestros[0].nombre);
          }}
        />
        </Campo>
      )}
      <p className="-mt-2 px-1 text-xs text-ink-500">
        {rol === 'dueno'
          ? 'Ve y cambia todo: precios, usuarios, reportes y dinero.'
          : rol === 'recepcion'
            ? 'Cobra, da entradas y hace el corte. No cambia precios ni usuarios.'
            : 'Solo ve sus clases: quién llegó, quién es nuevo y sus números. Nunca ve dinero.'}
      </p>
      {rol === 'maestro' &&
        (!baseLista ? (
          <p className="rounded-xl bg-warn-50 px-3 py-2 text-sm font-medium text-warn-600">
            Para dar acceso a maestros hay que actualizar la base de datos (correr supabase/schema.sql). Pídeselo a tu proveedor.
          </p>
        ) : (
          <Campo etiqueta="¿Qué maestro es?">
            <Selector
              value={maestroId}
              onChange={(e) => {
                setMaestroId(e.target.value);
                const m = maestros.find((x) => x.id === e.target.value);
                if (m && !nombre.trim()) setNombre(m.nombre);
              }}
            >
              <option value="">Elige…</option>
              {maestros.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nombre}
                </option>
              ))}
            </Selector>
          </Campo>
        ))}
      <Campo etiqueta={usuario ? `Nuevo PIN de ${LARGO_PIN} dígitos (déjalo vacío para no cambiarlo)` : `PIN de ${LARGO_PIN} dígitos`} ayuda={usuario && largoPin(usuario) < LARGO_PIN ? `Su PIN actual es de ${largoPin(usuario)} dígitos: cámbialo por uno de ${LARGO_PIN} para más seguridad.` : 'Evita fechas de nacimiento o números seguidos (123456).'}>
        <EntradaClave inputMode="numeric" maxLength={LARGO_PIN} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} placeholder={'•'.repeat(LARGO_PIN)} />
        {pin.length === LARGO_PIN && pinDebil(pin) && <span className="mt-1 block text-xs font-medium text-bad-600">Muy fácil de adivinar: usa números sin orden.</span>}
      </Campo>
      {usuario && !esUltimoDueno && usuario.id !== yo.id && <Interruptor valor={activo} onChange={setActivo} texto="Puede entrar a la app" />}
      <div>
        <Boton grande bloque onClick={guardar} disabled={!!falta}>
          Guardar
        </Boton>
        {falta && <p className="mt-2 text-center text-sm text-ink-500">{falta}</p>}
      </div>
    </div>
  );
}
