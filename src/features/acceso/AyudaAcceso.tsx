import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { AlertTriangle, ArrowLeft, CloudCheck, KeyRound, RefreshCw, Repeat } from 'lucide-react';
import { useUsuarios } from '../../app/datos';
import { useAvisos } from '../../components/avisos';
import { Avatar, Boton, Campo, Entrada, Tarjeta, cx } from '../../components/ui';
import { db, getMeta } from '../../db/db';
import { actualizar } from '../../db/repo';
import type { Academia, Usuario } from '../../db/types';
import { hashPin } from '../../domain/acceso';
import { quitarAcademiaDelTelefono, sincronizar, useEstadoSync } from '../../sync/engine';
import { verificarCuentaAcademia } from '../../sync/supabase';
import { RespaldoLocal } from '../ajustes/Respaldo';

type Vista = 'menu' | 'pin' | 'otra';

/** Salidas de la pantalla de PIN: olvidé mi PIN, o este teléfono debe usar otra academia. */
export function AyudaAcceso({ academia, onListo }: { academia: Academia; onListo: (u?: Usuario) => void }) {
  const [vista, setVista] = useState<Vista>('menu');
  return (
    <div>
      {vista !== 'menu' && (
        <button onClick={() => setVista('menu')} className="mb-2 -ml-2 rounded-full p-2 active:bg-ink-100" aria-label="Atrás">
          <ArrowLeft size={20} />
        </button>
      )}
      {vista === 'menu' && (
        <div className="overflow-hidden rounded-2xl bg-superficie ring-1 ring-ink-100">
          <Opcion icono={<KeyRound size={20} />} titulo="Olvidé mi PIN" sub="Ponle uno nuevo con la cuenta de la academia" onClick={() => setVista('pin')} />
          <Opcion icono={<Repeat size={20} />} titulo="Es otra academia" sub="Usar este teléfono con otra cuenta" onClick={() => setVista('otra')} />
        </div>
      )}
      {vista === 'pin' && <RestablecerPin academia={academia} onListo={onListo} />}
      {vista === 'otra' && <OtraAcademia />}
    </div>
  );
}

function Opcion({ icono, titulo, sub, onClick }: { icono: React.ReactNode; titulo: string; sub: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex w-full items-center gap-3 border-b border-ink-100 px-4 py-3.5 text-left last:border-0 active:bg-ink-50">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-600">{icono}</span>
      <span>
        <span className="block font-semibold">{titulo}</span>
        <span className="block text-sm text-ink-500">{sub}</span>
      </span>
    </button>
  );
}

function RestablecerPin({ academia, onListo }: { academia: Academia; onListo: (u?: Usuario) => void }) {
  const avisar = useAvisos();
  const usuarios = useUsuarios().filter((u) => u.activo);
  const vinculada = useLiveQuery(() => getMeta<boolean>('nubeVinculada'), [], false);
  const [paso, setPaso] = useState<'cuenta' | 'nuevo'>('cuenta');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [quien, setQuien] = useState<Usuario | null>(null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [ocupado, setOcupado] = useState(false);

  if (!vinculada)
    return (
      <div className="space-y-3 text-sm text-ink-700">
        <p>
          Esta academia no está conectada a la nube, así que el PIN solo lo puede cambiar <b>otro usuario dueño</b> desde Ajustes → Usuarios y PIN.
        </p>
        <p className="text-ink-500">Para que esto no vuelva a pasar, conecta la academia a la nube: así siempre podrás recuperar el acceso con tu correo.</p>
      </div>
    );

  if (paso === 'cuenta')
    return (
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setOcupado(true);
          setError('');
          try {
            await verificarCuentaAcademia(email.trim(), password, academia.id);
            setPaso('nuevo');
          } catch (err) {
            setError(err instanceof Error ? err.message : 'No se pudo verificar');
          } finally {
            setOcupado(false);
          }
        }}
      >
        <p className="text-sm text-ink-700">Confirma con el correo y la contraseña de la cuenta de {academia.nombre}.</p>
        <Campo etiqueta="Correo">
          <Entrada type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </Campo>
        <Campo etiqueta="Contraseña">
          <Entrada type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </Campo>
        {error && <p className="text-sm font-medium text-bad-600">{error}</p>}
        <Boton grande bloque type="submit" disabled={ocupado || !navigator.onLine}>
          {ocupado ? 'Verificando…' : navigator.onLine ? 'Continuar' : 'Necesitas internet'}
        </Boton>
      </form>
    );

  return (
    <div className="space-y-4">
      <p className="text-sm font-medium text-ink-700">¿A quién le cambias el PIN?</p>
      <div className="grid grid-cols-3 gap-2">
        {usuarios.map((u) => (
          <button
            key={u.id}
            onClick={() => setQuien(u)}
            className={cx('flex flex-col items-center gap-1.5 rounded-2xl bg-superficie p-3 ring-1', quien?.id === u.id ? 'ring-2 ring-brand-500' : 'ring-ink-100')}
          >
            <Avatar nombre={u.nombre} tam={44} />
            <span className="w-full truncate text-center text-sm font-semibold">{u.nombre}</span>
          </button>
        ))}
      </div>
      <Campo etiqueta="PIN nuevo (4 dígitos)">
        <Entrada inputMode="numeric" type="password" maxLength={4} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} placeholder="••••" />
      </Campo>
      <Boton
        grande
        bloque
        disabled={!quien || !/^\d{4}$/.test(pin)}
        onClick={async () => {
          const u = await actualizar('usuarios', quien!.id, { pinHash: await hashPin(pin, academia.id) });
          avisar(`PIN de ${u.nombre.split(' ')[0]} actualizado`);
          onListo(u);
        }}
      >
        Guardar y entrar
      </Boton>
    </div>
  );
}

function OtraAcademia() {
  const sync = useEstadoSync();
  const vinculada = useLiveQuery(() => getMeta<boolean>('nubeVinculada'), [], false);
  const pendientes = useLiveQuery(() => db.outbox.count(), [], 0);
  const [respaldado, setRespaldado] = useState(false);
  const [armado, setArmado] = useState(false);

  const seguro = vinculada && pendientes === 0;
  const puede = seguro || (!vinculada && respaldado);

  return (
    <div className="space-y-4">
      {seguro ? (
        <Tarjeta className="flex gap-3 p-4 text-sm">
          <CloudCheck className="shrink-0 text-ok-600" size={22} />
          <p>Todo está respaldado en la nube. Puedes quitar esta academia del teléfono y volver a entrar cuando quieras con su correo.</p>
        </Tarjeta>
      ) : vinculada ? (
        <div className="space-y-3 rounded-2xl bg-warn-50 p-4 text-sm text-warn-600">
          <p className="flex gap-2 font-medium">
            <AlertTriangle size={18} className="shrink-0" /> Hay cobros que aún no se suben a la nube. Conéctate a internet y espera a que se respalden.
          </p>
          <Boton variante="secundario" onClick={() => void sincronizar()} disabled={sync.fase === 'sincronizando'}>
            <RefreshCw size={16} /> Subir ahora
          </Boton>
        </div>
      ) : (
        <div className="space-y-3 rounded-2xl bg-bad-50 p-4 text-sm text-bad-600">
          <p className="flex gap-2 font-medium">
            <AlertTriangle size={18} className="shrink-0" /> Esta academia NO está en la nube. Si la quitas, sus datos se borran de este teléfono. Descarga el respaldo primero.
          </p>
          <RespaldoLocal onDescargado={() => setRespaldado(true)} />
        </div>
      )}
      <Boton
        bloque
        grande
        variante={armado ? 'peligro' : 'secundario'}
        disabled={!puede}
        onClick={() => (armado ? void quitarAcademiaDelTelefono() : setArmado(true))}
      >
        {armado ? 'Toca otra vez para quitarla' : 'Quitar academia de este teléfono'}
      </Boton>
    </div>
  );
}
