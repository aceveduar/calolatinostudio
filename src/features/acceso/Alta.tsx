import { useState } from 'react';
import { ArrowLeft, CloudDownload, Sparkles } from 'lucide-react';
import { Boton, Campo, Entrada } from '../../components/ui';
import { TecladoPin } from '../../components/Teclado';
import { crearAcademia } from '../../domain/acceso';
import { entrarEnDispositivoNuevo } from '../../sync/engine';
import { nubeConfigurada } from '../../sync/supabase';
import type { Usuario } from '../../db/types';
import { Logo } from '../../components/Logo';
import { RestaurarRespaldo } from '../ajustes/Respaldo';

type Paso = 'inicio' | 'datos' | 'pin' | 'confirmar' | 'nube';

export function Alta({ onListo }: { onListo: (u: Usuario) => void }) {
  const [paso, setPaso] = useState<Paso>('inicio');
  const [academia, setAcademia] = useState('');
  const [nombre, setNombre] = useState('');
  const [pin, setPin] = useState('');
  const [pin2, setPin2] = useState('');
  const [error, setError] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [ocupado, setOcupado] = useState(false);

  const alPin = (v: string) => {
    setPin(v);
    if (v.length === 4) setTimeout(() => setPaso('confirmar'), 150);
  };
  const alConfirmar = async (v: string) => {
    setPin2(v);
    if (v.length < 4) return;
    if (v !== pin) {
      setError('Los PIN no coinciden');
      setTimeout(() => {
        setPin('');
        setPin2('');
        setError('');
        setPaso('pin');
      }, 700);
      return;
    }
    const u = await crearAcademia({ nombre: academia, duenoNombre: nombre, pin });
    onListo(u);
  };

  const entrarNube = async () => {
    setOcupado(true);
    setError('');
    try {
      await entrarEnDispositivoNuevo(email.trim(), password);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo entrar');
    } finally {
      setOcupado(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col px-6 pt-safe pb-safe">
      {paso !== 'inicio' && (
        <button onClick={() => setPaso(paso === 'confirmar' ? 'pin' : paso === 'pin' ? 'datos' : 'inicio')} className="mt-4 -ml-2 self-start rounded-full p-2 active:bg-ink-100" aria-label="Atrás">
          <ArrowLeft />
        </button>
      )}

      {paso === 'inicio' && (
        <div className="flex flex-1 flex-col justify-center">
          <Logo tam={64} />
          <h1 className="mt-6 text-4xl font-extrabold tracking-tight">Compás</h1>
          <p className="mt-2 text-lg text-ink-500">Cobros y asistencia de tu academia de baile. Funciona sin internet.</p>
          <div className="mt-10 space-y-3">
            <Boton grande bloque onClick={() => setPaso('datos')}>
              <Sparkles size={20} /> Configurar mi academia
            </Boton>
            {nubeConfigurada && (
              <Boton grande bloque variante="secundario" onClick={() => setPaso('nube')}>
                <CloudDownload size={20} /> Ya la uso en otro teléfono
              </Boton>
            )}
            <div className="pt-4 [&_button]:text-ink-500 [&_button]:ring-0 [&_button]:bg-transparent">
              <RestaurarRespaldo />
            </div>
          </div>
        </div>
      )}

      {paso === 'datos' && (
        <form
          className="flex flex-1 flex-col pt-6"
          onSubmit={(e) => {
            e.preventDefault();
            setPaso('pin');
          }}
        >
          <h1 className="text-3xl font-extrabold tracking-tight">Tu academia</h1>
          <p className="mt-1 text-ink-500">Lo puedes cambiar después.</p>
          <div className="mt-8 space-y-5">
            <Campo etiqueta="Nombre de la academia">
              <Entrada autoFocus value={academia} onChange={(e) => setAcademia(e.target.value)} placeholder="Ej. Academia Son de Barrio" required />
            </Campo>
            <Campo etiqueta="Tu nombre" ayuda="Serás el dueño: puedes cambiar precios, clases y usuarios.">
              <Entrada value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej. Eduardo" required />
            </Campo>
          </div>
          <div className="mt-auto pt-8">
            <Boton grande bloque type="submit" disabled={!academia.trim() || !nombre.trim()}>
              Continuar
            </Boton>
          </div>
        </form>
      )}

      {(paso === 'pin' || paso === 'confirmar') && (
        <div className="flex flex-1 flex-col justify-center pb-10">
          <h1 className="text-center text-2xl font-extrabold">{paso === 'pin' ? 'Crea tu PIN de 4 dígitos' : 'Repite tu PIN'}</h1>
          <p className="mt-1 mb-10 text-center text-ink-500">{error || 'Lo usarás para entrar a la app.'}</p>
          {paso === 'pin' ? <TecladoPin valor={pin} onChange={alPin} /> : <TecladoPin valor={pin2} onChange={alConfirmar} error={!!error} />}
        </div>
      )}

      {paso === 'nube' && (
        <form
          className="flex flex-1 flex-col pt-6"
          onSubmit={(e) => {
            e.preventDefault();
            void entrarNube();
          }}
        >
          <h1 className="text-3xl font-extrabold tracking-tight">Conectar teléfono</h1>
          <p className="mt-1 text-ink-500">Entra con la cuenta de la academia para descargar sus datos.</p>
          <div className="mt-8 space-y-5">
            <Campo etiqueta="Correo">
              <Entrada type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </Campo>
            <Campo etiqueta="Contraseña">
              <Entrada type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </Campo>
            {error && <p className="text-sm font-medium text-bad-600">{error}</p>}
          </div>
          <div className="mt-auto pt-8">
            <Boton grande bloque type="submit" disabled={ocupado}>
              {ocupado ? 'Descargando…' : 'Entrar'}
            </Boton>
          </div>
        </form>
      )}
    </div>
  );
}
