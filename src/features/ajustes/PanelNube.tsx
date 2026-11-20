import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { CloudOff, LogOut, RefreshCw } from 'lucide-react';
import { useSesion } from '../../app/sesion';
import { Boton, Campo, Entrada, EntradaClave, Segmentos, Tarjeta } from '../../components/ui';
import { db, getMeta } from '../../db/db';
import { horaDe } from '../../domain/fechas';
import { cerrarSesionEnTodos, sincronizar, useEstadoSync, vincularAcademia } from '../../sync/engine';
import { useAvisos } from '../../components/avisos';
import { nubeConfigurada } from '../../sync/supabase';
import { RespaldoLocal, RestaurarRespaldo } from './Respaldo';

const TEXTO_FASE = {
  'solo-local': 'Solo en este equipo',
  desconectada: 'Este equipo no está respaldando',
  'sin-red': 'Sin internet · se subirá al conectar',
  sincronizando: 'Sincronizando…',
  'al-dia': 'Todo respaldado en la nube',
  error: 'Error al sincronizar',
} as const;

export function PanelNube() {
  const { esDueno } = useSesion();
  const sync = useEstadoSync();
  const pendientes = useLiveQuery(() => db.outbox.count(), [], 0);
  const vinculada = useLiveQuery(() => getMeta<boolean>('nubeVinculada'), [], false);

  return (
    <div className="space-y-4">
      <Tarjeta className="p-4">
        <p className="text-sm text-ink-500">Estado</p>
        <p className="text-lg font-bold">{TEXTO_FASE[sync.fase]}</p>
        <p className="mt-1 text-sm text-ink-500">
          {pendientes} cambio{pendientes === 1 ? '' : 's'} pendiente{pendientes === 1 ? '' : 's'}
          {sync.ultimo && ` · última vez ${horaDe(sync.ultimo)}`}
        </p>
        {sync.error && <p className="mt-2 text-sm text-bad-600">{sync.error}</p>}
        {vinculada && sync.fase !== 'desconectada' && (
          <Boton variante="secundario" className="mt-3" onClick={() => void sincronizar()} disabled={sync.fase === 'sincronizando'}>
            <RefreshCw size={16} /> Sincronizar ahora
          </Boton>
        )}
      </Tarjeta>

      {!nubeConfigurada ? (
        <Tarjeta className="flex gap-3 p-4 text-sm text-ink-700">
          <CloudOff className="shrink-0 text-ink-300" />
          <p>
            Esta instalación funciona solo en el teléfono. Descarga respaldos con regularidad. Para usar varios teléfonos y tener respaldo automático, se
            activa la nube (pídeselo a tu proveedor).
          </p>
        </Tarjeta>
      ) : sync.fase !== 'desconectada' ? (
        <p className="px-1 text-sm text-ink-500">
          Este equipo está conectado: todo se respalda solo cuando hay internet (wifi o datos). No tienes que hacer nada.
        </p>
      ) : esDueno ? (
        <FormVincular reconectar={!!vinculada} />
      ) : (
        <p className="rounded-2xl bg-warn-50 p-4 text-sm font-medium text-warn-600">Este equipo no está respaldando. Pide a la dirección que lo conecte.</p>
      )}

      <div className="space-y-2 pt-2">
        <p className="px-1 text-xs font-bold tracking-wider text-ink-500 uppercase">Respaldo en archivo</p>
        <RespaldoLocal />
        {vinculada && <p className="px-1 text-xs text-ink-500">Lleva lo que hay en este teléfono: alumnos, planes y clases completos, y entradas y cobros de los últimos 18 meses. El historial completo está en la nube.</p>}
        <RestaurarRespaldo />
      </div>

      {esDueno && vinculada && sync.fase !== 'desconectada' && <CerrarEnTodos />}
    </div>
  );
}

/** Para un teléfono perdido o alguien que deja de trabajar en la academia. Pide confirmar. */
function CerrarEnTodos() {
  const avisar = useAvisos();
  const [confirmar, setConfirmar] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  return (
    <div className="space-y-2 pt-2">
      <p className="px-1 text-xs font-bold tracking-wider text-ink-500 uppercase">Seguridad</p>
      {!confirmar ? (
        <Boton bloque variante="secundario" onClick={() => setConfirmar(true)}>
          <LogOut size={18} /> Cerrar sesión en todos los equipos
        </Boton>
      ) : (
        <Tarjeta className="space-y-3 p-4 text-sm">
          <p className="font-semibold">¿Se perdió un teléfono o alguien dejó de trabajar aquí?</p>
          <p className="text-ink-700">Todos los equipos (también este) dejan de respaldar hasta que los vuelvas a conectar con el correo y la contraseña de la academia. Lo guardado en cada equipo no se pierde.</p>
          <p className="text-ink-700">Después, <b>cambia la contraseña de la academia</b> si alguien más la sabía, y el PIN de quien ya no trabaja aquí (Usuarios y PIN).</p>
          <div className="grid grid-cols-2 gap-2">
            <Boton variante="secundario" onClick={() => setConfirmar(false)}>
              Cancelar
            </Boton>
            <Boton
              variante="peligro"
              disabled={ocupado}
              onClick={async () => {
                setOcupado(true);
                try {
                  await cerrarSesionEnTodos();
                  avisar('Sesión cerrada en todos los equipos');
                  setConfirmar(false);
                } catch (e) {
                  avisar(e instanceof Error ? e.message : 'No se pudo', 'error');
                } finally {
                  setOcupado(false);
                }
              }}
            >
              Sí, cerrar en todos
            </Boton>
          </div>
        </Tarjeta>
      )}
    </div>
  );
}

function FormVincular({ reconectar }: { reconectar: boolean }) {
  const [modo, setModo] = useState<'crear' | 'entrar'>(reconectar ? 'entrar' : 'crear');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [ocupado, setOcupado] = useState(false);

  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setOcupado(true);
        setError('');
        try {
          // al reconectar siempre se entra con la cuenta que ya existe (el modo pudo quedar en "crear"
          // si el formulario apareció antes de saber que este equipo ya estaba conectado)
          await vincularAcademia(email.trim(), password, !reconectar && modo === 'crear');
        } catch (err) {
          setError(err instanceof Error ? err.message : 'No se pudo conectar');
        } finally {
          setOcupado(false);
        }
      }}
    >
      <p className="text-sm text-ink-700">
        {reconectar
          ? 'Escribe el correo y la contraseña de la academia para volver a respaldar. No se pierde nada de lo que hay en este equipo.'
          : 'Conecta la academia para respaldar todo automáticamente y usarla en más de un equipo. Se hace una sola vez.'}
      </p>
      {!reconectar && <Segmentos
        opciones={[
          { valor: 'crear', texto: 'Crear cuenta' },
          { valor: 'entrar', texto: 'Ya tengo cuenta' },
        ]}
        valor={modo}
        onChange={setModo}
      />}
      <Campo etiqueta="Correo">
        <Entrada type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </Campo>
      <Campo etiqueta="Contraseña" ayuda="Mínimo 6 caracteres.">
        <EntradaClave autoComplete={modo === 'crear' ? 'new-password' : 'current-password'} value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
      </Campo>
      {error && <p className="text-sm font-medium text-bad-600">{error}</p>}
      <Boton grande bloque type="submit" disabled={ocupado || !navigator.onLine}>
        {ocupado ? 'Conectando…' : navigator.onLine ? 'Conectar' : 'Necesitas internet'}
      </Boton>
    </form>
  );
}
