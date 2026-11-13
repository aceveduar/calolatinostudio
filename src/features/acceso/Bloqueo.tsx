import { useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useUsuarios } from '../../app/datos';
import { Avatar, Hoja } from '../../components/ui';
import { AyudaAcceso } from './AyudaAcceso';
import { TecladoPin } from '../../components/Teclado';
import { verificarPin } from '../../domain/acceso';
import type { Academia, Usuario } from '../../db/types';
import { LogoAcademia } from '../../components/LogoAcademia';

export function Bloqueo({ academia, onAbrir }: { academia: Academia; onAbrir: (u: Usuario) => void }) {
  // Orden fijo: dueños, recepción y maestros; dentro de cada grupo, por nombre
  const ORDEN = { dueno: 0, recepcion: 1, maestro: 2 } as const;
  const usuarios = useUsuarios()
    .filter((u) => u.activo)
    .sort((a, b) => ORDEN[a.rol] - ORDEN[b.rol] || a.nombre.localeCompare(b.nombre));
  const [elegido, setElegido] = useState<Usuario | null>(null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const [ayuda, setAyuda] = useState(false);
  // Contra adivinar el PIN: tras 5 intentos fallidos, espera de 30 s que crece en cada ronda
  const [fallos, setFallos] = useState(0);
  const [bloqueadoHasta, setBloqueadoHasta] = useState(0);
  const [, setTick] = useState(0);
  const espera = Math.max(0, Math.ceil((bloqueadoHasta - Date.now()) / 1000));
  useEffect(() => {
    if (!espera) return;
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [espera]);

  const usuario = elegido ?? (usuarios.length === 1 ? usuarios[0] : null);

  const alPin = async (v: string) => {
    setPin(v);
    if (v.length < 4 || !usuario) return;
    if (await verificarPin(usuario, v)) return onAbrir(usuario);
    const n = fallos + 1;
    setFallos(n);
    if (n % 5 === 0) setBloqueadoHasta(Date.now() + 30_000 * (n / 5));
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
        {!academia.logo && <LogoAcademia academia={academia} tam={44} />}
        <span className="truncate text-lg font-bold">{academia.nombre}</span>
      </div>

      {!usuario ? (
        <div className="flex flex-1 flex-col justify-center pb-10">
          {academia.logo && <img src={academia.logo} alt="" className="mx-auto mb-8 h-36 w-auto max-w-[70%] object-contain drop-shadow-sm" />}
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
            <p className={error || espera ? 'font-medium text-bad-600' : 'text-ink-500'}>
              {espera ? `Demasiados intentos. Espera ${espera} s` : error ? 'PIN incorrecto' : 'Escribe tu PIN'}
            </p>
          </div>
          <div className={espera ? 'pointer-events-none opacity-40' : undefined}>
            <TecladoPin valor={pin} onChange={alPin} error={error} />
          </div>
        </div>
      )}

      <button onClick={() => setAyuda(true)} className="mx-auto mb-4 rounded-full px-4 py-2 text-sm font-semibold text-ink-500 active:bg-ink-100">
        ¿Olvidaste tu PIN o es otra academia?
      </button>
      <Hoja abierta={ayuda} onCerrar={() => setAyuda(false)} titulo="¿Necesitas ayuda para entrar?">
        {ayuda && (
          <AyudaAcceso
            academia={academia}
            onListo={(u) => {
              setAyuda(false);
              if (u) onAbrir(u);
            }}
          />
        )}
      </Hoja>
    </div>
  );
}
