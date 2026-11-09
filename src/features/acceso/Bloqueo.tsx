import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useUsuarios } from '../../app/datos';
import { Avatar } from '../../components/ui';
import { TecladoPin } from '../../components/Teclado';
import { verificarPin } from '../../domain/acceso';
import type { Academia, Usuario } from '../../db/types';
import { Logo } from '../../components/Logo';

export function Bloqueo({ academia, onAbrir }: { academia: Academia; onAbrir: (u: Usuario) => void }) {
  const usuarios = useUsuarios().filter((u) => u.activo);
  const [elegido, setElegido] = useState<Usuario | null>(null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);

  const usuario = elegido ?? (usuarios.length === 1 ? usuarios[0] : null);

  const alPin = async (v: string) => {
    setPin(v);
    if (v.length < 4 || !usuario) return;
    if (await verificarPin(usuario, v)) return onAbrir(usuario);
    setError(true);
    navigator.vibrate?.([60, 40, 60]);
    setTimeout(() => {
      setPin('');
      setError(false);
    }, 600);
  };

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col px-6 pt-safe pb-safe">
      <div className="flex items-center gap-3 pt-6">
        <Logo tam={36} />
        <span className="truncate text-lg font-bold">{academia.nombre}</span>
      </div>

      {!usuario ? (
        <div className="flex flex-1 flex-col justify-center pb-10">
          <h1 className="mb-8 text-center text-2xl font-extrabold">¿Quién eres?</h1>
          <div className="grid grid-cols-3 gap-4">
            {usuarios.map((u) => (
              <button key={u.id} onClick={() => setElegido(u)} className="flex flex-col items-center gap-2 rounded-2xl p-3 active:bg-ink-100">
                <Avatar nombre={u.nombre} tam={64} />
                <span className="w-full truncate text-center text-sm font-semibold">{u.nombre}</span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex flex-1 flex-col justify-center pb-10">
          {usuarios.length > 1 && (
            <button onClick={() => { setElegido(null); setPin(''); }} className="-ml-2 mb-4 self-start rounded-full p-2 active:bg-ink-100" aria-label="Cambiar usuario">
              <ArrowLeft />
            </button>
          )}
          <div className="mb-8 flex flex-col items-center">
            <Avatar nombre={usuario.nombre} tam={72} />
            <p className="mt-3 text-xl font-bold">Hola, {usuario.nombre.split(' ')[0]}</p>
            <p className={error ? 'font-medium text-bad-600' : 'text-ink-500'}>{error ? 'PIN incorrecto' : 'Escribe tu PIN'}</p>
          </div>
          <TecladoPin valor={pin} onChange={alPin} error={error} />
        </div>
      )}
    </div>
  );
}
