import { useEffect, useState, type FormEvent } from 'react';
import { nubePublica } from '../../app/rpcPublica';
import { Boton, Tarjeta } from '../../components/ui';

interface Campana { nombre: string; abierta: boolean }
type Registro = { estado: 'lista'; portal: string } | { estado: 'cerrada' | 'recepcion' | 'datos' };
const campo = 'mt-1 block min-h-12 w-full rounded-xl bg-superficie px-3 text-base font-normal ring-1 ring-ink-100 focus:ring-2 focus:ring-brand-500';

function claveSolicitud(token: string) {
  const clave = `compas:solicitud-alta:${token}`;
  const nueva = crypto.randomUUID();
  try {
    const guardada = sessionStorage.getItem(clave);
    if (guardada) return guardada;
    sessionStorage.setItem(clave, nueva);
  } catch {
    // En navegadores que bloquean almacenamiento funciona durante esta visita.
  }
  return nueva;
}

export function AltaGrupal({ token }: { token: string }) {
  const [campana, setCampana] = useState<Campana | null>(null);
  const [intentos, setIntentos] = useState(0);
  const [estado, setEstado] = useState<'cargando' | 'abierta' | 'cerrada' | 'error'>('cargando');
  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  const [solicitud] = useState(() => claveSolicitud(token));
  const [enviando, setEnviando] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [portal, setPortal] = useState('');

  useEffect(() => {
    const control = new AbortController();
    const limite = setTimeout(() => control.abort('tiempo'), 15_000);
    void (async () => {
      const respuesta = await nubePublica?.rpc<Campana>('estado_alta_grupal', { p_token: token }, control.signal);
      clearTimeout(limite);
      if (control.signal.aborted && control.signal.reason !== 'tiempo') return;
      setCampana(respuesta?.data ?? null);
      setEstado(!respuesta || respuesta.error ? 'error' : respuesta.data?.abierta ? 'abierta' : 'cerrada');
    })();
    return () => { clearTimeout(limite); control.abort(); };
  }, [token, intentos]);

  async function registrar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (enviando) return;
    setMensaje('');
    setEnviando(true);
    const respuesta = await nubePublica?.rpc<Registro>('registrar_alta_grupal', {
      p_token: token, p_solicitud: solicitud, p_nombre: nombre.trim(), p_telefono: telefono.trim(),
    }, AbortSignal.timeout(15_000));
    setEnviando(false);
    if (!respuesta?.data || respuesta.error) {
      setMensaje('No pudimos confirmar el registro. Revisa tu conexión y vuelve a tocar «Crear mi pase».');
    } else if (respuesta.data.estado === 'lista') {
      setPortal(respuesta.data.portal);
    } else if (respuesta.data.estado === 'cerrada') {
      setEstado('cerrada');
    } else if (respuesta.data.estado === 'recepcion') {
      setMensaje('Recepción puede ayudarte a recuperar tu pase o registrarte si compartes celular. Si escribiste otro número por error, puedes corregirlo aquí.');
    } else {
      setMensaje('Escribe tu nombre completo y un celular mexicano de 10 dígitos.');
    }
  }

  return (
    <main className="mx-auto max-w-md px-4 py-8">
      <Tarjeta className="space-y-5 p-5 sm:p-7">
        <header>
          {campana && <p className="mb-1 text-sm font-bold text-brand-600">{campana.nombre}</p>}
          <h1 className="text-2xl font-extrabold">{portal ? 'Tu pase está listo' : 'Crea tu pase personal'}</h1>
        </header>
        {portal ? (
          <div className="space-y-4" aria-live="polite">
            <p className="text-ink-600">Abre Mi pase para ver tu QR, agregar una foto y guardar tu acceso en el celular. Tu enlace es personal.</p>
            <a href={`/p/${portal}`} className="flex min-h-12 items-center justify-center rounded-xl bg-brand-600 px-4 py-3 font-bold text-white">Abrir Mi pase</a>
          </div>
        ) : estado === 'abierta' ? (
          <form className="space-y-4" onSubmit={(e) => void registrar(e)}>
            <p className="text-sm text-ink-600">Usa tu nombre y celular para crear el pase que mostrarás al llegar a clase.</p>
            <label className="block text-sm font-semibold">Nombre completo
              <input required minLength={3} maxLength={120} autoComplete="name" value={nombre} onChange={(e) => setNombre(e.target.value)} disabled={enviando} className={campo} />
            </label>
            <label className="block text-sm font-semibold">Celular
              <input required type="tel" minLength={10} maxLength={32} autoComplete="tel-national" aria-describedby="formato-celular" value={telefono} onChange={(e) => setTelefono(e.target.value)} disabled={enviando} className={campo} />
              <span id="formato-celular" className="mt-1 block font-normal text-ink-600">10 dígitos de México</span>
            </label>
            {mensaje && <p role="alert" className="rounded-xl bg-brand-50 p-3 text-sm">{mensaje}</p>}
            <Boton type="submit" grande bloque disabled={enviando}>{enviando ? 'Creando tu pase…' : 'Crear mi pase'}</Boton>
          </form>
        ) : estado === 'cerrada' ? (
          <p className="text-ink-600">El registro por este enlace está cerrado. Si necesitas tu pase, pide ayuda en recepción.</p>
        ) : estado === 'error' ? (
          <div className="space-y-3">
            <p role="alert" className="text-ink-600">No pudimos abrir el registro. Revisa tu conexión e inténtalo nuevamente.</p>
            <Boton onClick={() => { setEstado('cargando'); setIntentos((n) => n + 1); }}>Reintentar</Boton>
          </div>
        ) : (
          <p role="status" className="text-ink-600">Abriendo el registro…</p>
        )}
      </Tarjeta>
    </main>
  );
}
