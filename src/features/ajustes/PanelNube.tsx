import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { CloudOff, RefreshCw } from 'lucide-react';
import { useSesion } from '../../app/sesion';
import { Boton, Campo, Entrada, Segmentos, Tarjeta } from '../../components/ui';
import { db, getMeta } from '../../db/db';
import { horaDe } from '../../domain/fechas';
import { cerrarSesionNube, sincronizar, useEstadoSync, vincularAcademia } from '../../sync/engine';
import { nubeConfigurada } from '../../sync/supabase';
import { RespaldoLocal } from './PantallaAjustes';

const TEXTO_FASE = {
  'solo-local': 'Solo en este teléfono',
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
        {vinculada && (
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
      ) : vinculada ? (
        esDueno && (
          <BotonDoble texto="Desconectar de la nube" confirmar="Toca otra vez para desconectar (tus datos se quedan en el teléfono)" onConfirmar={() => void cerrarSesionNube()} />
        )
      ) : esDueno ? (
        <FormVincular />
      ) : (
        <p className="text-sm text-ink-500">Pide al dueño que conecte la academia a la nube.</p>
      )}

      <RespaldoLocal />
    </div>
  );
}

/** Acción delicada sin ventanas del sistema: el primer toque arma, el segundo confirma. */
function BotonDoble({ texto, confirmar, onConfirmar }: { texto: string; confirmar: string; onConfirmar: () => void }) {
  const [armado, setArmado] = useState(false);
  useEffect(() => {
    if (!armado) return;
    const t = setTimeout(() => setArmado(false), 4000);
    return () => clearTimeout(t);
  }, [armado]);
  return (
    <Boton bloque variante={armado ? 'peligro' : 'fantasma'} onClick={() => (armado ? onConfirmar() : setArmado(true))}>
      {armado ? confirmar : texto}
    </Boton>
  );
}

function FormVincular() {
  const [modo, setModo] = useState<'crear' | 'entrar'>('crear');
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
          await vincularAcademia(email.trim(), password, modo === 'crear');
        } catch (err) {
          setError(err instanceof Error ? err.message : 'No se pudo conectar');
        } finally {
          setOcupado(false);
        }
      }}
    >
      <p className="text-sm text-ink-700">Conecta la academia para respaldar todo automáticamente y usarla en más de un teléfono.</p>
      <Segmentos
        opciones={[
          { valor: 'crear', texto: 'Crear cuenta' },
          { valor: 'entrar', texto: 'Ya tengo cuenta' },
        ]}
        valor={modo}
        onChange={setModo}
      />
      <Campo etiqueta="Correo">
        <Entrada type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </Campo>
      <Campo etiqueta="Contraseña" ayuda="Mínimo 6 caracteres.">
        <Entrada type="password" autoComplete={modo === 'crear' ? 'new-password' : 'current-password'} value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
      </Campo>
      {error && <p className="text-sm font-medium text-bad-600">{error}</p>}
      <Boton grande bloque type="submit" disabled={ocupado || !navigator.onLine}>
        {ocupado ? 'Conectando…' : navigator.onLine ? 'Conectar' : 'Necesitas internet'}
      </Boton>
    </form>
  );
}
