import { useState } from 'react';
import { ArrowLeft, CloudDownload, Sparkles } from 'lucide-react';
import { Boton, Campo, Entrada, EntradaClave } from '../../components/ui';
import { TecladoPin } from '../../components/Teclado';
import { LARGO_PIN, crearAcademia, pinDebil } from '../../domain/acceso';
import { academiasEnDispositivoNuevo, descargarAcademiaEnDispositivoNuevo, descartarDescargaProvisional, useProgresoDescarga } from '../../sync/engine';
import { PantallaDescarga } from './PantallaDescarga';
import { nubeConfigurada } from '../../sync/supabase';
import type { Usuario } from '../../db/types';
import { Logo } from '../../components/Logo';
import { RestaurarRespaldo } from '../ajustes/Respaldo';
import { anotarError } from '../../app/errores';

type Paso = 'inicio' | 'datos' | 'pin' | 'confirmar' | 'nube' | 'elegir';

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
  const [descargaPendiente, setDescargaPendiente] = useState(false);
  const [academias, setAcademias] = useState<Awaited<ReturnType<typeof academiasEnDispositivoNuevo>>>([]);
  const progreso = useProgresoDescarga();

  const alPin = (v: string) => {
    setPin(v);
    if (v.length !== LARGO_PIN) return;
    if (pinDebil(v)) {
      setError('Muy fácil de adivinar: usa números sin orden');
      setTimeout(() => {
        setPin('');
        setError('');
      }, 1400);
      return;
    }
    setTimeout(() => setPaso('confirmar'), 150);
  };
  const alConfirmar = async (v: string) => {
    setPin2(v);
    if (v.length < LARGO_PIN) return;
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
    try {
      await descartarDescargaProvisional();
      const u = await crearAcademia({ nombre: academia, duenoNombre: nombre, pin });
      onListo(u);
    } catch (e) {
      setPin2('');
      setError(e instanceof Error ? e.message : 'No se pudo crear la academia');
    }
  };

  const entrarNube = async (elegida?: string) => {
    if (ocupado) return;
    setOcupado(true);
    setError('');
    setDescargaPendiente(false);
    let descargando = Boolean(elegida);
    try {
      if (elegida) {
        await descargarAcademiaEnDispositivoNuevo(elegida);
        return;
      }
      const disponibles = await academiasEnDispositivoNuevo(email.trim(), password);
      if (disponibles.length === 1) {
        descargando = true;
        await descargarAcademiaEnDispositivoNuevo(disponibles[0].id);
      }
      else {
        setAcademias(disponibles);
        setPassword('');
        setPaso('elegir');
      }
    } catch (e) {
      if (descargando) {
        setDescargaPendiente(true);
        setError('La descarga quedó incompleta. Revisa la conexión y vuelve a intentarlo.');
        anotarError(e, 'Descarga inicial');
      } else {
        setError(e instanceof Error ? e.message : 'No se pudo entrar');
      }
    } finally {
      setOcupado(false);
    }
  };

  // ya entró y está bajando la academia: pantalla con avance (la primera vez puede tardar)
  if (ocupado && progreso) return <PantallaDescarga progreso={progreso} />;

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col px-6 pt-safe pb-safe">
      {paso !== 'inicio' && (
        <button disabled={ocupado} onClick={() => { setError(''); setDescargaPendiente(false); setPaso(paso === 'confirmar' ? 'pin' : paso === 'pin' ? 'datos' : paso === 'elegir' ? 'nube' : 'inicio'); }} className="mt-4 -ml-2 self-start rounded-full p-2 active:bg-ink-100" aria-label="Atrás">
          <ArrowLeft />
        </button>
      )}
      {paso === 'elegir' && (
        <div className="flex flex-1 flex-col gap-4 pt-6">
          <h1 className="text-3xl font-extrabold tracking-tight">Elige tu academia</h1>
          <p className="text-ink-500">Se descargará en este equipo la academia que elijas.</p>
          {academias.map((opcion) => (
            <Boton key={opcion.id} bloque grande variante="secundario" disabled={ocupado} onClick={() => void entrarNube(opcion.id)}>
              {opcion.nombre}
            </Boton>
          ))}
          {ocupado && <p role="status" className="text-sm text-ink-500">Preparando la descarga…</p>}
          {error && <p role="alert" className="text-sm font-medium text-bad-600">{error}{descargaPendiente && ' Toca la academia para reintentar.'}</p>}
        </div>
      )}

      {paso === 'inicio' && (
        <div className="flex flex-1 flex-col justify-center">
          <Logo tam={64} />
          <h1 className="mt-6 text-4xl font-extrabold tracking-tight">Compás</h1>
          <p className="mt-2 text-lg text-ink-500">Cobros y asistencia de tu academia de baile. Funciona sin internet.</p>
          <div className="mt-10 space-y-3">
            {nubeConfigurada && (
              <Boton grande bloque onClick={() => setPaso('nube')}>
                <CloudDownload size={20} /> Conectar a mi academia
              </Boton>
            )}
            <Boton grande bloque variante={nubeConfigurada ? 'secundario' : 'primario'} onClick={() => setPaso('datos')}>
              <Sparkles size={20} /> Crear una academia nueva
            </Boton>
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
          <h1 className="text-center text-2xl font-extrabold">{paso === 'pin' ? `Crea tu PIN de ${LARGO_PIN} dígitos` : 'Repite tu PIN'}</h1>
          <p className="mt-1 mb-10 text-center text-ink-500">{error || 'Lo usarás para entrar a la app.'}</p>
          {paso === 'pin' ? <TecladoPin key="pin" conTeclado valor={pin} onChange={alPin} error={!!error} /> : <TecladoPin key="confirmar" conTeclado valor={pin2} onChange={alConfirmar} error={!!error} />}
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
          <h1 className="text-3xl font-extrabold tracking-tight">Conectar este equipo</h1>
          <p className="mt-1 text-ink-500">Escribe el correo y la contraseña de la academia. Se hace una sola vez por equipo; después cada persona entra con su PIN.</p>
          <div className="mt-8 space-y-5">
            <Campo etiqueta="Correo">
              <Entrada type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </Campo>
            <Campo etiqueta="Contraseña">
              <EntradaClave autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </Campo>
            {error && <p role="alert" className="text-sm font-medium text-bad-600">{error}</p>}
          </div>
          <div className="mt-auto pt-8 md:mt-0">
            <Boton grande bloque type="submit" disabled={ocupado}>
              {ocupado ? 'Conectando…' : descargaPendiente ? 'Reintentar descarga' : 'Entrar'}
            </Boton>
          </div>
        </form>
      )}
    </div>
  );
}
