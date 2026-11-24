import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Boton, Campo, Entrada, Tarjeta } from '../components/ui';

type Solicitud = { id: string; nombre: string; telefono: string; aprobada: boolean };
const clave = 'compas:prueba-altas:v1';
const base = '/prueba-altas/';
const telefonoRegistrado = '5500000001';
const claveCierre = 'compas:prueba-altas:cierre';

function leer(): Solicitud[] {
  try {
    return JSON.parse(localStorage.getItem(clave) ?? '[]') as Solicitud[];
  } catch {
    return [];
  }
}

export function PruebaAltas() {
  const [solicitudes, setSolicitudes] = useState(leer);
  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  const [confirmado, setConfirmado] = useState(false);
  const [seleccion, setSeleccion] = useState<string[]>([]);
  const [enlace, setEnlace] = useState('');
  const [qr, setQr] = useState('');
  const [aviso, setAviso] = useState('');
  const [automatica, setAutomatica] = useState(false);
  const [cierre, setCierre] = useState(() => Number(localStorage.getItem(claveCierre) ?? 0));
  const cerrada = cierre > 0 && Date.now() >= cierre;
  const [vista, id] = location.pathname.slice(base.length).split('/');
  const solicitud = solicitudes.find((s) => s.id === id);
  const requiereRevision = (s: Solicitud) => s.telefono === telefonoRegistrado ||
    solicitudes.some((otra) => otra.id !== s.id && otra.telefono === s.telefono);
  const pendientes = solicitudes.filter((s) => !s.aprobada);
  const elegibles = pendientes.filter((s) => !requiereRevision(s));

  useEffect(() => {
    const recargar = () => setSolicitudes(leer());
    window.addEventListener('storage', recargar);
    return () => window.removeEventListener('storage', recargar);
  }, []);

  useEffect(() => {
    if (!solicitud?.aprobada || vista !== 'estado') return;
    void QRCode.toDataURL(`COMPAS-PRUEBA:${solicitud.id}`).then(setQr);
  }, [solicitud, vista]);

  function guardar(nuevas: Solicitud[]) {
    localStorage.setItem(clave, JSON.stringify(nuevas));
    setSolicitudes(nuevas);
  }

  function enviar() {
    const numero = telefono.replace(/\D/g, '');
    if (!confirmado || nombre.trim().length < 2 || numero.length !== 10) return;
    if (leer().some((s) => s.telefono === numero && s.nombre.toLowerCase() === nombre.trim().toLowerCase())) {
      setAviso('Ya hay una solicitud con esos datos. Usa el enlace privado que guardaste.');
      return;
    }
    const nueva = { id: crypto.randomUUID(), nombre: nombre.trim(), telefono: numero, aprobada: false };
    guardar([...leer(), nueva]);
    setEnlace(`${base}estado/${nueva.id}`);
  }

  function altaAutomatica(e: React.FormEvent) {
    e.preventDefault();
    const limite = Number(localStorage.getItem(claveCierre) ?? 0);
    if (!limite || Date.now() >= limite) {
      setAviso('El registro de Calo está cerrado.');
      return;
    }
    const numero = telefono.replace(/\D/g, '');
    const limpio = nombre.trim().replace(/\s+/g, ' ');
    if (limpio.length < 2 || numero.length !== 10) return;
    const actuales = leer();
    const normalizar = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').trim().toLowerCase();
    const coincide = actuales.some((s) => s.telefono === numero || normalizar(s.nombre) === normalizar(limpio));
    if (actuales.some((s) => s.telefono === numero && normalizar(s.nombre) === normalizar(limpio))) {
      setAviso('Ya hay un registro con esos datos. Usa el enlace que guardaste o pide ayuda a Monse.');
      return;
    }
    const nueva = { id: crypto.randomUUID(), nombre: limpio, telefono: numero, aprobada: !coincide };
    guardar([...actuales, nueva]);
    setAutomatica(nueva.aprobada);
    setEnlace(`${base}estado/${nueva.id}`);
  }

  function cambiarCierre(ms: number) {
    localStorage.setItem(claveCierre, String(ms));
    setCierre(ms);
  }

  function aprobar() {
    const actuales = leer();
    const seleccionadas = actuales.filter((s) => !s.aprobada && seleccion.includes(s.id)
      && s.telefono !== telefonoRegistrado && !actuales.some((otra) => otra.id !== s.id && otra.telefono === s.telefono));
    const ids = new Set(seleccionadas.map((s) => s.id));
    guardar(actuales.map((s) => ids.has(s.id) ? { ...s, aprobada: true } : s));
    setSeleccion([]);
    setAviso(`Solicitudes aprobadas: ${ids.size}`);
  }

  return (
    <main className="mx-auto max-w-xl space-y-4 px-4 py-8">
      <p className="text-sm font-semibold text-warn-600">Simulación de Calo · Usa datos ficticios. Solo se guardan en este navegador.</p>
      <nav className="flex gap-4 text-sm font-semibold text-brand-600">
        <a href={`${base}registro`}>Formulario del alumno</a>
        <a href={`${base}recepcion`}>Bandeja de Monse</a>
        <a href={`${base}campana`}>Campaña automática</a>
      </nav>
      {vista === 'campana' ? (
        <>
          <h1 className="text-2xl font-extrabold">Campaña de alta de Calo</h1>
          <p>{cierre && !cerrada ? `Abierta hasta ${new Date(cierre).toLocaleString('es-MX')}` : 'Registro cerrado'}</p>
          <div className="flex flex-wrap gap-2">
            <Boton onClick={() => cambiarCierre(Date.now() + 7 * 86_400_000)}>Abrir por 7 días</Boton>
            <Boton variante="secundario" onClick={() => cambiarCierre(Date.now())}>Cerrar registro</Boton>
          </div>
          <a className="text-brand-600 underline" href={`${base}alta-directa`}>Abrir el enlace de inscripción</a>
        </>
      ) : vista === 'alta-directa' ? (
        <>
          <h1 className="text-2xl font-extrabold">Regístrate en Calo</h1>
          {enlace ? <p>{automatica ? 'Tu pase de prueba está listo. ' : 'Monse revisará la coincidencia. '}
            <a className="text-brand-600 underline" href={enlace}>{automatica ? 'Abrir Mi pase de prueba' : 'Ver mi solicitud'}</a></p> :
            !cierre || cerrada ? <p>El registro de Calo está cerrado.</p> :
              <form className="space-y-4" onSubmit={altaAutomatica}>
                <Campo etiqueta="Nombre completo"><Entrada value={nombre} required onChange={(e) => setNombre(e.target.value)} /></Campo>
                <Campo etiqueta="WhatsApp de prueba"><Entrada type="tel" inputMode="tel" required value={telefono} onChange={(e) => setTelefono(e.target.value)} /></Campo>
                <Boton type="submit">Crear mi pase de prueba</Boton>
              </form>}
        </>
      ) : vista === 'recepcion' ? (
        <>
          <h1 className="text-2xl font-extrabold">Solicitudes de alta</h1>
          <p className="text-sm">Coteja los números con el grupo de Calo. Selecciona las solicitudes que ya revisaste.</p>
          <div className="flex flex-wrap gap-2">
            <Boton variante="secundario" onClick={() => setSeleccion(elegibles.map((s) => s.id))}>Seleccionar las elegibles</Boton>
            <Boton disabled={!seleccion.length} onClick={aprobar}>Aprobar seleccionadas ({seleccion.length})</Boton>
          </div>
          {!pendientes.length && <p>No hay solicitudes pendientes.</p>}
          {pendientes.map((s) => (
            <Tarjeta key={s.id} className="p-3">
              <label className="flex items-center gap-3">
                <input type="checkbox" checked={seleccion.includes(s.id)} disabled={requiereRevision(s)}
                  onChange={(e) => setSeleccion(e.target.checked ? [...seleccion, s.id] : seleccion.filter((x) => x !== s.id))} />
                <span><strong>{s.nombre}</strong><br />{s.telefono}{requiereRevision(s) && <><br />Revisar ficha existente o teléfono compartido</>}</span>
              </label>
            </Tarjeta>
          ))}
        </>
      ) : vista === 'estado' ? (
        <>
          <h1 className="text-2xl font-extrabold">{solicitud?.aprobada ? 'Mi pase de prueba' : 'Estado de tu solicitud'}</h1>
          {solicitud && <p>{solicitud.nombre}</p>}
          {solicitud?.aprobada && qr ? <img src={qr} alt="QR de prueba" width={160} height={160} /> :
            <p>{solicitud ? 'Pendiente de aprobación por Monse.' : 'Esta solicitud no está guardada en este navegador.'}</p>}
        </>
      ) : (
        <>
          <h1 className="text-2xl font-extrabold">Activa tu pase de Calo</h1>
          {enlace ? <p>Recibimos tu solicitud. <a className="font-bold text-brand-600 underline" href={enlace}>Guarda tu enlace privado</a> para consultar el estado.</p> :
            <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); enviar(); }}>
              <Campo etiqueta="Nombre completo"><Entrada value={nombre} required onChange={(e) => setNombre(e.target.value)} /></Campo>
              <Campo etiqueta="WhatsApp de prueba"><Entrada type="tel" inputMode="tel" required value={telefono} onChange={(e) => { setTelefono(e.target.value); setConfirmado(false); }} /></Campo>
              <label className="flex gap-2 text-sm"><input type="checkbox" checked={confirmado} onChange={(e) => setConfirmado(e.target.checked)} />Simular verificación del número</label>
              <Boton type="submit" disabled={!confirmado || nombre.trim().length < 2 || telefono.replace(/\D/g, '').length !== 10}>Enviar solicitud</Boton>
              <p className="text-sm text-ink-500">Usa 5500000001 para probar una coincidencia con una ficha existente.</p>
            </form>}
        </>
      )}
      {aviso && <p role="status">{aviso}</p>}
    </main>
  );
}
