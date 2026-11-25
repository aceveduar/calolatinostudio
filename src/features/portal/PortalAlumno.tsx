import { useEffect, useState } from 'react';
import { DetalleEvento } from '../../components/DetalleEvento';
import QRCode from 'qrcode';
import { Camera, Image as ImageIcon, CalendarCheck, Clock, MessageCircle, PackageCheck, PartyPopper, QrCode, RefreshCw, ShoppingBag, Sun, Ticket, Trophy, Users, WifiOff, X } from 'lucide-react';
import { useRef } from 'react';
import { prepararFoto } from '../../app/fotos';
import { nubePublica as supabase } from '../../app/rpcPublica';
import { LogoAcademia } from '../../components/LogoAcademia';
import { cx, Hoja } from '../../components/ui';
import { ImagenProducto } from '../../components/ImagenProducto';
import { contenidoQR } from '../../domain/qr';
import { dinero } from '../../domain/dinero';
import { aFecha, diasEntre, fechaCorta, fechaLarga } from '../../domain/fechas';
import { ERRORES_PEDIDO, ERRORES_TESTIMONIO, estadoPedidoPortal, fotoPedido, puedeOpinar, type DatosPortal } from '../../domain/portal';
import { nombrePublico } from '../../domain/nombres';
import { enlaceInvitacion, mensajeInvitacion, textoInvitados } from '../../domain/invitar';
import { INSIGNIAS, faltaParaEvento, insignias, mensajeEvento, mensajeRenovar, proximaClase, racha, restante, semana, type ClaseHorario } from '../../domain/miPortal';
import { waLink } from '../../domain/reportes';
import { GuardarEnInicio } from './GuardarEnInicio';
import { nombresApp } from '../../../cloudflare/portal';

type Estado = { fase: 'cargando' } | { fase: 'listo'; datos: DatosPortal; guardadoEl: number } | { fase: 'no-existe' } | { fase: 'error' };
type Actualizacion = 'actualizando' | 'al-dia' | 'error' | 'sin-internet';

const CLAVE = (t: string) => `compas-portal:${t}`;

function leerGuardado(token: string): { datos: DatosPortal; at: number } | null {
  try {
    const s = localStorage.getItem(CLAVE(token));
    return s ? JSON.parse(s) : null;
  } catch {
    return null;
  }
}

/**
 * Portal del alumno (/p/<token>): su QR para entrar, su plan y sus últimas clases.
 * Sin cuenta ni contraseña. Funciona sin internet con lo último que se cargó, para no quedarse en la puerta.
 */
export function PortalAlumno({ token }: { token: string }) {
  const [estado, setEstado] = useState<Estado>(() => {
    const g = leerGuardado(token);
    return g ? { fase: 'listo', datos: g.datos, guardadoEl: g.at } : { fase: 'cargando' };
  });

  // `version` cambia para volver a cargar (p. ej. después de apartar)
  const [version, setVersion] = useState(0);
  const [enLinea, setEnLinea] = useState(() => navigator.onLine);
  const [actualizacion, setActualizacion] = useState<Actualizacion>('actualizando');
  const estadoActualizacion = enLinea ? actualizacion : 'sin-internet';
  const recargar = () => {
    setActualizacion('actualizando');
    setEstado((e) => (e.fase === 'error' ? { fase: 'cargando' } : e));
    setVersion((v) => v + 1);
  };
  useEffect(() => {
    const actualizarRed = () => {
      const conectada = navigator.onLine;
      if (conectada) {
        setActualizacion('actualizando');
        setVersion((v) => v + 1);
      }
      setEnLinea(conectada);
    };
    window.addEventListener('online', actualizarRed);
    window.addEventListener('offline', actualizarRed);
    return () => {
      window.removeEventListener('online', actualizarRed);
      window.removeEventListener('offline', actualizarRed);
    };
  }, []);
  useEffect(() => {
    if (!enLinea || !supabase) {
      if (!supabase) setActualizacion('error');
      setEstado((e) => e.fase === 'cargando' ? { fase: 'error' } : e);
      return;
    }
    let vivo = true;
    const controlador = new AbortController();
    const limite = setTimeout(() => controlador.abort(), 18_000);
    (async () => {
      let { data, error } = await supabase.rpc('portal_alumno', { p_token: token }, controlador.signal);
      // un enlace recién creado en recepción puede tardar unos segundos en llegar a la nube: reintentar
      // antes de decir "ya no funciona" (antes salía ese mensaje al abrirlo de inmediato)
      for (let intento = 0; !error && !data && intento < 4 && vivo; intento++) {
        await new Promise((r) => setTimeout(r, 2500));
        if (!vivo) return;
        ({ data, error } = await supabase.rpc('portal_alumno', { p_token: token }, controlador.signal));
      }
      if (!vivo) return;
      if (error) {
        setActualizacion('error');
        return setEstado((e) => (e.fase === 'listo' ? e : { fase: 'error' }));
      }
      if (!data) {
        // enlace regenerado o alumno dado de baja: no dejar datos viejos en el teléfono
        try {
          localStorage.removeItem(CLAVE(token));
        } catch {
          /* nada */
        }
        return setEstado({ fase: 'no-existe' });
      }
      const guardadoEl = Date.now();
      try {
        localStorage.setItem(CLAVE(token), JSON.stringify({ datos: data, at: guardadoEl }));
      } catch {
        /* sin espacio: igual se muestra */
      }
      setEstado({ fase: 'listo', datos: data as DatosPortal, guardadoEl });
      setActualizacion('al-dia');
    })().finally(() => clearTimeout(limite));
    return () => {
      vivo = false;
      clearTimeout(limite);
      controlador.abort();
    };
  }, [token, version, enLinea]);

  const color = estado.fase === 'listo' ? estado.datos.academia.color : null;
  useEffect(() => {
    if (color) document.documentElement.style.setProperty('--marca', color);
    document.title = estado.fase === 'listo' ? `${estado.datos.alumno.nombre.split(' ')[0]} · ${estado.datos.academia.nombre}` : 'Mi credencial';
  }, [color, estado]);
  // al instalarla se llama "Mi Calo" (el nombre de su academia), no "Compás"
  const academiaNombre = estado.fase === 'listo' ? estado.datos.academia.nombre : null;
  useEffect(() => {
    if (!academiaNombre) return;
    document.querySelector('link[rel=manifest]')?.setAttribute('href', `/p/${token}/manifiesto?a=${encodeURIComponent(academiaNombre)}`);
    document.querySelector('meta[name="apple-mobile-web-app-title"]')?.setAttribute('content', nombresApp(academiaNombre).corto);
  }, [academiaNombre, token]);

  if (estado.fase === 'cargando' || (estado.fase === 'error' && estadoActualizacion === 'actualizando')) return <Centro>Cargando tu credencial…</Centro>;
  if (estado.fase === 'no-existe')
    return (
      <Centro titulo="Este enlace ya no funciona">
        Pide en recepción que te envíen tu enlace nuevo por WhatsApp.
      </Centro>
    );
  if (estado.fase === 'error')
    return (
      <Centro titulo={enLinea ? 'No se pudo cargar Mi pase' : 'Sin internet'}>
        {enLinea ? 'Intenta cargar tus datos otra vez.' : 'Conéctate a internet para cargar tu pase por primera vez.'}
        {enLinea && <button type="button" onClick={recargar} className="mt-4 block w-full rounded-2xl bg-brand-500 px-6 py-3 font-bold text-white active:scale-[0.98]">
          Reintentar
        </button>}
      </Centro>
    );
  return <Vista datos={estado.datos} guardadoEl={estado.guardadoEl} actualizacion={estadoActualizacion} token={token} recargar={recargar} />;
}

function productoAgotado(producto: DatosPortal['tienda'][number]) {
  return !producto.sobre_pedido && producto.disponibles !== null && producto.disponibles <= 0;
}

function HojaApartar({ producto, token, actualizacion, onCerrar, onListo }: { producto: DatosPortal['tienda'][number]; token: string; actualizacion: Actualizacion; onCerrar: () => void; onListo: (texto: string) => void }) {
  const [opcion, setOpcion] = useState<string | null>(producto.opciones.length === 1 ? producto.opciones[0] : null);
  const [cantidad, setCantidad] = useState(1);
  const encargo = !!producto.sobre_pedido;
  const [nota, setNota] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const agotado = productoAgotado(producto);
  const puedePedir = !agotado && actualizacion === 'al-dia';
  const maximo = Math.max(1, Math.min(5, producto.disponibles ?? 5));
  const falta = producto.opciones.length > 0 && !opcion;

  const enviar = async () => {
    if (!supabase || !puedePedir || falta || ocupado) return;
    setOcupado(true);
    setError(null);
    try {
      // el detalle solo se manda si lo escribió (así sirve aunque la base aún no tenga ese campo)
      const { data, error: e } = await supabase.rpc('portal_pedir', { p_token: token, p_producto: producto.id, p_opcion: opcion, p_cantidad: cantidad, ...(nota.trim() ? { p_nota: nota.trim() } : {}) });
      if (e) throw new Error('No se pudo enviar el pedido. Inténtalo otra vez.');
      if (data?.error) {
        setError(data.error === 'agotado' && typeof data.disponibles === 'number' && data.disponibles > 0 ? `Solo quedan ${data.disponibles}.` : (ERRORES_PEDIDO[data.error] ?? 'No se pudo apartar.'));
        return;
      }
      onListo(
        encargo
          ? `¡Listo! Encargaste ${producto.nombre}${opcion ? ` (${opcion})` : ''}${cantidad > 1 ? ` ×${cantidad}` : ''}. ${producto.dias_entrega ? `Entrega estimada en unos ${producto.dias_entrega} días. ` : ''}Consulta cuándo recogerlo en Tus apartados y encargos.`
          : `¡Listo! Apartaste ${producto.nombre}${opcion ? ` (${opcion})` : ''}${cantidad > 1 ? ` ×${cantidad}` : ''}. Recógelo y págalo en recepción.`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo apartar.');
    } finally {
      setOcupado(false);
    }
  };

  return (
    <Hoja abierta onCerrar={() => { if (!ocupado) onCerrar(); }} titulo={producto.nombre}>
        <ImagenProducto foto={producto.foto} tam={producto.foto ? 224 : 64} ajustar className="mx-auto max-w-full" />
        <div className="mt-3 space-y-1">
          <p className="text-lg font-bold text-brand-600">{dinero(producto.precio)}</p>
          <p className="text-sm font-medium text-ink-700">
            {agotado ? 'Agotado' : encargo ? `Sobre pedido${producto.dias_entrega ? ` · unos ${producto.dias_entrega} días` : ''}` : 'Recógelo y págalo en recepción'}
          </p>
          {producto.descripcion && <p className="whitespace-pre-line break-words text-sm text-ink-700">{producto.descripcion}</p>}
          {!puedePedir && producto.opciones.length > 0 && <p className="text-sm text-ink-500">{producto.opciones.join(' · ')}</p>}
          {!puedePedir && !agotado && (
            <p className="text-sm text-ink-500">
              {actualizacion === 'sin-internet' ? 'Conéctate a internet para hacer un pedido.' : 'Actualiza Mi pase para hacer un pedido.'}
            </p>
          )}
        </div>
        {puedePedir && <>
        {producto.opciones.length > 0 && (
          <div className="mt-4" role="group" aria-label="Talla o color">
            <p className="mb-1.5 text-sm font-medium text-ink-700">Elige talla o color</p>
            <div className="flex flex-wrap gap-2">
              {producto.opciones.map((o) => (
                <button
                  key={o}
                  type="button"
                  aria-pressed={opcion === o}
                  onClick={() => setOpcion(o)}
                  className={cx('h-11 min-w-12 rounded-xl px-3 font-semibold ring-1', opcion === o ? 'bg-brand-500 text-white ring-brand-500' : 'bg-superficie ring-ink-100')}
                >
                  {o}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="mt-4 flex items-center justify-between rounded-2xl bg-superficie p-2 ring-1 ring-ink-100">
          <span className="pl-2 text-sm font-medium text-ink-700">Piezas</span>
          <div className="flex items-center gap-3">
            <button type="button" className="flex h-10 w-10 items-center justify-center rounded-xl bg-ink-100 text-xl font-bold disabled:opacity-30" disabled={cantidad <= 1} onClick={() => setCantidad(cantidad - 1)} aria-label="Una menos">
              −
            </button>
            <span className="w-6 text-center text-lg font-bold" aria-live="polite">
              {cantidad}
            </span>
            <button type="button" className="flex h-10 w-10 items-center justify-center rounded-xl bg-ink-100 text-xl font-bold disabled:opacity-30" disabled={cantidad >= maximo} onClick={() => setCantidad(cantidad + 1)} aria-label="Una más">
              +
            </button>
          </div>
        </div>
        {encargo && (
          <label className="mt-4 block">
            <span className="mb-1.5 block text-sm font-medium text-ink-700">Detalles (color, diseño…)</span>
            <input
              value={nota}
              onChange={(e) => setNota(e.target.value.slice(0, 200))}
              placeholder="Ej. negras, tacón 5 cm"
              className="h-12 w-full rounded-xl bg-superficie px-4 ring-1 ring-ink-100 outline-none placeholder:text-ink-300 focus:ring-2 focus:ring-brand-500"
            />
          </label>
        )}
        {encargo && <p className="mt-2 text-xs text-ink-500">Te avisamos por WhatsApp cuando llegue.</p>}
        {error && <p className="mt-3 rounded-xl bg-bad-50 px-3 py-2 text-sm font-medium text-bad-600">{error}</p>}
        <button
          type="button"
          onClick={enviar}
          disabled={ocupado || falta}
          className="mt-4 h-14 w-full rounded-2xl bg-brand-500 text-lg font-bold text-white active:scale-[0.98] disabled:opacity-50"
        >
          {falta ? 'Elige talla o color' : `${encargo ? 'Encargar' : 'Apartar'} · pagas ${dinero(producto.precio * cantidad)} al recoger`}
        </button>
        </>}
    </Hoja>
  );
}

function Centro({ titulo, children }: { titulo?: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-2 bg-ink-50 px-8 text-center">
      {titulo && <p className="text-lg font-bold">{titulo}</p>}
      <div className="text-ink-500">{children}</div>
    </div>
  );
}

function Vista({ datos: crudos, guardadoEl, actualizacion, token, recargar }: { datos: DatosPortal; guardadoEl: number; actualizacion: Actualizacion; token: string; recargar: () => void }) {
  const datosPendientes = actualizacion !== 'al-dia';
  const [todaTienda, setTodaTienda] = useState(false);
  // "Tu experiencia" es opcional: con la ✕ se quita (se recuerda en este teléfono) y queda un enlace abajo
  const claveOpinar = `compas-portal-opinar-oculto:${token}`;
  const [opinarOculto, setOpinarOculto] = useState(() => {
    try {
      return localStorage.getItem(claveOpinar) === '1';
    } catch {
      return false;
    }
  });
  const ocultarOpinar = (si: boolean) => {
    setOpinarOculto(si);
    try {
      if (si) localStorage.setItem(claveOpinar, '1');
      else localStorage.removeItem(claveOpinar);
    } catch {
      /* sin almacenamiento: solo por esta visita */
    }
  };
  // datos guardados por una versión anterior pueden no traer campos nuevos
  const datos: DatosPortal = { ...crudos, tienda: (crudos.tienda ?? []).map((p) => ({ ...p, opciones: p.opciones ?? [], disponibles: p.disponibles ?? null })) };
  const [qr, setQr] = useState<string | null>(null);
  const [apartar, setApartar] = useState<DatosPortal['tienda'][number] | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const pedidos = (datos.pedidos ?? []).filter((p) => p.estado !== 'cancelado');
  useEffect(() => {
    void QRCode.toDataURL(contenidoQR(datos.alumno.codigo), { margin: 1, width: 640, errorCorrectionLevel: 'M' }).then(setQr);
  }, [datos.alumno.codigo]);
  const nombre1 = datos.alumno.nombre.split(' ')[0];
  const hoy = datos.hoy;
  const vigentes = datos.planes.filter((p) => p.inicio <= hoy && p.fin >= hoy && (p.clases === null || p.usadas < p.clases));
  const proximos = datos.planes.filter((p) => p.inicio > hoy);
  const vencido = !vigentes.length ? datos.planes.find((p) => p.fin < hoy || (p.clases !== null && p.usadas >= p.clases)) : undefined;
  const [pase, setPase] = useState(false);
  const wa = datos.academia.whatsapp ?? null;
  const renovar = (plan: string | null) => (wa ? waLink(wa, mensajeRenovar(datos.alumno.nombre, datos.alumno.codigo, plan)) : null);

  return (
    <div className="min-h-dvh bg-ink-50 pb-10">
      <div className="relative overflow-hidden bg-brand-500 px-5 pt-6 pb-20 text-white">
        <div className="absolute -top-16 -right-10 h-48 w-48 rounded-full bg-white/10" aria-hidden="true" />
        <div className="absolute top-10 -left-12 h-32 w-32 rounded-full bg-white/10" aria-hidden="true" />
        <div className="relative mx-auto flex max-w-md items-center gap-3">
          <span className="rounded-2xl bg-white p-1.5">
            <LogoAcademia academia={{ nombre: datos.academia.nombre, logo: datos.academia.logo }} tam={36} />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-white">{datos.academia.nombre}</span>
            <span className="block text-2xl leading-tight font-extrabold">
              {saludo(new Date())}, {nombre1}
            </span>
          </span>
        </div>
      </div>

      <div className="relative mx-auto -mt-14 max-w-md space-y-3 px-4">
        {datosPendientes && (
          <div className={cx('flex flex-wrap items-center gap-x-3 rounded-2xl px-4 py-2 text-sm font-medium', actualizacion === 'actualizando' ? 'bg-superficie text-ink-700' : 'bg-warn-50 text-warn-600')}>
            <p role="status" className="flex min-w-0 flex-1 items-start gap-2 py-1">
              {actualizacion === 'sin-internet'
                ? <WifiOff size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
                : <RefreshCw size={16} className={cx('mt-0.5 shrink-0', actualizacion === 'actualizando' && 'motion-safe:animate-spin')} aria-hidden="true" />}
              <span>
                {actualizacion === 'actualizando' ? 'Actualizando… Tu pase sigue disponible.' : (
                  <>{actualizacion === 'error' ? 'No pudimos actualizar.' : 'Sin internet.'} Datos del {fechaCorta(aFecha(new Date(guardadoEl)))}. Tu pase sigue disponible.</>
                )}
              </span>
            </p>
            {actualizacion === 'error' && (
              <button type="button" onClick={recargar} className="min-h-11 shrink-0 rounded-lg px-2 font-bold underline active:bg-warn-600/10">Reintentar</button>
            )}
          </div>
        )}

        {/* Pase de entrada: compacto; a pantalla completa al tocarlo */}
        <div className="rounded-3xl bg-white p-4 text-[#16141c] shadow-xl shadow-black/10">
          <div className="flex items-center gap-4">
            <button type="button" onClick={() => setPase(true)} className="shrink-0 rounded-2xl ring-1 ring-[#ecebf0]" aria-label="Mostrar mi pase en grande">
              {qr ? <img src={qr} alt="" className="h-24 w-24 rounded-2xl" /> : <span className="block h-24 w-24 animate-pulse rounded-2xl bg-[#ecebf0]" />}
            </button>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-bold tracking-wider text-[#6b6778] uppercase">Tu pase de entrada</p>
              <p className="truncate text-lg leading-tight font-extrabold">{datos.alumno.nombre}</p>
              <p className="font-mono text-sm tracking-[0.25em] text-[#6b6778]">{datos.alumno.codigo}</p>
            </div>
            {datos.alumno.foto && <SubirFoto token={token} foto={datos.alumno.foto} nombre={datos.alumno.nombre} sinConexion={datosPendientes} onListo={recargar} />}
          </div>
          <button
            type="button"
            onClick={() => setPase(true)}
            className="mt-4 flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-brand-500 text-lg font-bold text-white shadow-lg shadow-brand-500/30 active:scale-[0.98]"
          >
            <QrCode size={22} aria-hidden="true" /> Mostrar mi pase
          </button>
          <GuardarEnInicio />
        </div>

        {!datos.alumno.foto && !datosPendientes && <SubirFoto variante="tarjeta" token={token} foto={null} nombre={datos.alumno.nombre} sinConexion={false} onListo={recargar} />}

        {/* Plan */}
        <div className="rounded-3xl bg-superficie p-5 ring-1 ring-ink-100">
          <p className="flex items-center gap-1.5 text-xs font-bold tracking-wider text-ink-500 uppercase">
            <Ticket size={14} aria-hidden="true" /> Tu plan
          </p>
          {vigentes.length === 0 ? (
            <div className="mt-2">
              <p className="text-lg font-bold">{vencido ? `Tu ${vencido.plan.toLowerCase()} terminó` : 'Pagas por clase'}</p>
              {vencido && <p className="text-sm text-ink-500">Renuévalo para seguir bailando.</p>}
              <BotonWhats href={renovar(vencido?.plan ?? null)} texto={vencido ? 'Renovar por WhatsApp' : 'Preguntar por planes'} fuerte={!!vencido} />
            </div>
          ) : (
            vigentes.map((p, i) => {
              const r = restante(p, hoy);
              const dias = diasEntre(hoy, p.fin);
              return (
                <div key={i} className={cx('mt-3', i > 0 && 'border-t border-ink-100 pt-4')}>
                  <div className="flex items-center gap-4">
                    <Anillo fraccion={r.fraccion} urgente={r.urgente} valor={r.valor} unidad={r.unidad} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-lg leading-tight font-bold">{p.plan}</p>
                        <span className={cx('rounded-full px-2.5 py-0.5 text-xs font-bold', r.urgente ? 'bg-warn-50 text-warn-600' : 'bg-ok-50 text-ok-600')}>
                          {p.beca ? 'Beca' : r.urgente ? 'Por terminar' : 'Vigente'}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-ink-500">
                        {p.clases !== null && `${p.usadas} de ${p.clases} clases usadas · `}
                        {dias === 0 ? 'vence hoy' : dias === 1 ? 'vence mañana' : `hasta el ${fechaLarga(p.fin)}`}
                      </p>
                    </div>
                  </div>
                  {r.urgente && !p.beca && !proximos.length && <BotonWhats href={renovar(p.plan)} texto="Renovar por WhatsApp" fuerte />}
                </div>
              );
            })
          )}
          {proximos.map((p, i) => (
            <p key={i} className="mt-3 border-t border-ink-100 pt-3 text-sm text-ink-500">
              Después sigue: <b className="text-ink-900">{p.plan}</b> del {fechaCorta(p.inicio)} al {fechaCorta(p.fin)}
            </p>
          ))}
        </div>

        <ProximaClaseTarjeta horario={datos.horario ?? []} slug={datos.academia.slug ?? null} />

        {!!datos.eventos?.length && <ProximosEventos eventos={datos.eventos} hoy={hoy} nombre={datos.alumno.nombre} codigo={datos.alumno.codigo} whatsapp={wa} />}

        {datos.logros && datos.logros.total > 0 && <Logros total={datos.logros.total} desde={datos.logros.desde} semanas={datos.logros.semanas} hoy={hoy} />}

        {datos.invita && datos.academia.slug && <InvitaAmigo academia={datos.academia.nombre} slug={datos.academia.slug} invita={datos.invita} />}

        {datos.testimonio !== undefined && puedeOpinar(datos) && !opinarOculto && (
          <TuTestimonio token={token} nombre={datos.alumno.nombre} academia={datos.academia.nombre} actual={datos.testimonio} sinConexion={datosPendientes} onListo={recargar} onOcultar={() => ocultarOpinar(true)} />
        )}

        {aviso && (
          <p role="status" className="flex items-center gap-2 rounded-2xl bg-ok-50 px-4 py-3 text-sm font-semibold text-ok-600">
            <PackageCheck size={18} className="shrink-0" /> {aviso}
          </p>
        )}

        {/* Mis apartados */}
        {pedidos.length > 0 && (
          <div className="rounded-3xl bg-superficie p-5 ring-1 ring-ink-100">
            <p className="flex items-center gap-1.5 text-xs font-bold tracking-wider text-ink-500 uppercase">
              <PackageCheck size={14} aria-hidden="true" /> Tus apartados y encargos
            </p>
            <ul className="mt-2 divide-y divide-ink-100">
              {pedidos.map((p, i) => {
                const estado = estadoPedidoPortal(p, datos.tienda);
                const saldo = Math.max(0, p.precio * p.cantidad - (p.anticipo ?? 0));
                return (
                <li key={i} className="flex items-center gap-3 py-2">
                  <ImagenProducto foto={fotoPedido(p, datos.tienda)} tam={44} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">
                      {p.producto}
                      {p.opcion && ` · ${p.opcion}`}
                      {p.cantidad > 1 && ` ×${p.cantidad}`}
                    </span>
                    {p.nota && <span className="block truncate text-xs text-ink-700">{p.nota}</span>}
                    {estado.detalle && <span className="block text-xs text-ink-500">
                      {estado.detalle}{estado.listo ? ` · ${dinero(saldo)}` : ` · Total ${dinero(p.precio * p.cantidad)}`}
                    </span>}
                  </span>
                  <span
                    className={
                      p.estado === 'entregado' || p.estado === 'llego'
                        ? 'shrink-0 rounded-full bg-ok-50 px-2.5 py-0.5 text-xs font-bold text-ok-600'
                        : 'max-w-24 shrink-0 rounded-xl bg-warn-50 px-2.5 py-0.5 text-center text-xs font-bold text-warn-600'
                    }
                  >
                    {estado.etiqueta}
                  </span>
                </li>
                );
              })}
            </ul>
          </div>
        )}

        {/* Tienda: cuadrícula de 2 con los primeros 4 y "Ver toda la tienda". Antes era un carrusel, pero en los
            carruseles casi nadie pasa del segundo producto; así se ven 4 sin deslizar y el resto está a un toque. */}
        {datos.tienda.length > 0 && (
          <section aria-label="Tienda de la academia" className="rounded-3xl bg-superficie py-5 ring-1 ring-ink-100">
            <div className="flex items-baseline justify-between gap-2 px-5">
              <p className="flex items-center gap-1.5 text-xs font-bold tracking-wider text-ink-500 uppercase">
                <ShoppingBag size={14} aria-hidden="true" /> Tienda de la academia
              </p>
              {datos.tienda.length > 4 && <p className="shrink-0 text-xs font-semibold text-ink-500">{datos.tienda.length} artículos</p>}
            </div>
            <ul aria-label="Productos" className="mt-3 grid grid-cols-2 gap-2 px-5">
              {(todaTienda ? datos.tienda : datos.tienda.slice(0, 4)).map((p) => {
                const agotado = productoAgotado(p);
                const verProducto = () => {
                  setAviso(null);
                  setApartar(p);
                };
                return (
                  <li key={p.id} className="flex flex-col rounded-2xl bg-ink-50 p-3 text-center">
                    <button type="button" onClick={verProducto} aria-label={`Ver ${p.nombre}`} className="rounded-xl text-center active:opacity-75">
                      <ImagenProducto foto={p.foto} tam={80} className="mx-auto" />
                      <span className="mt-1 line-clamp-2 text-sm font-semibold">{p.nombre}</span>
                    </button>
                    {p.descripcion && <p className="line-clamp-2 text-xs text-ink-500">{p.descripcion}</p>}
                    {p.sobre_pedido && <p className="text-[11px] font-semibold text-brand-600">Sobre pedido{p.dias_entrega ? ` · ~${p.dias_entrega} días` : ''}</p>}
                    <p className="text-sm font-bold text-brand-600">{dinero(p.precio)}</p>
                    {p.opciones.length > 0 && <p className="line-clamp-1 text-[11px] text-ink-500">{p.opciones.join(' · ')}</p>}
                    <span className="flex-1" />
                    <button
                      type="button"
                      disabled={agotado || datosPendientes}
                      onClick={verProducto}
                      className="mt-2 h-10 rounded-xl bg-brand-50 text-sm font-bold text-brand-600 ring-1 ring-brand-500/20 active:scale-95 disabled:bg-ink-100 disabled:text-ink-500 disabled:ring-0"
                    >
                      {p.sobre_pedido ? 'Encargar' : agotado ? 'Agotado' : 'Apartar'}
                    </button>
                  </li>
                );
              })}
            </ul>
            {datos.tienda.length > 4 && (
              <div className="px-5">
                <button type="button" onClick={() => setTodaTienda(!todaTienda)} className="mt-2 min-h-11 w-full rounded-xl text-sm font-semibold text-brand-600 ring-1 ring-ink-100 active:bg-ink-50">
                  {todaTienda ? 'Ver menos' : `Ver toda la tienda (${datos.tienda.length})`}
                </button>
              </div>
            )}
            <p className="mt-3 px-5 text-center text-xs text-ink-500">Apártalo aquí y págalo al recogerlo en recepción.</p>
          </section>
        )}

        {/* Últimas clases */}
        {datos.clases.length > 0 && <UltimasClases clases={datos.clases} />}

        {/* si la quitó, no se pierde: queda este enlace discreto por si después se anima */}
        {datos.testimonio !== undefined && puedeOpinar(datos) && opinarOculto && (
          <button type="button" onClick={() => ocultarOpinar(false)} className="mx-auto flex min-h-11 items-center gap-1.5 px-3 text-sm font-semibold text-brand-600">
            <MessageCircle size={16} aria-hidden="true" /> Contar mi experiencia
          </button>
        )}
        <p className="pt-2 text-center text-xs text-ink-500">Este enlace es solo tuyo · Compás</p>
      </div>
      {pase && <PaseCompleto qr={qr} nombre={datos.alumno.nombre} codigo={datos.alumno.codigo} foto={datos.alumno.foto ?? null} onCerrar={() => setPase(false)} />}
      {apartar && (
        <HojaApartar
          actualizacion={actualizacion}
          producto={apartar}
          token={token}
          onCerrar={() => setApartar(null)}
          onListo={(texto) => {
            setApartar(null);
            setAviso(texto);
            recargar();
          }}
        />
      )}
    </div>
  );
}

/**
 * Su foto: el círculo del pase, o (si aún no tiene) una tarjeta amable que se va al ponerla.
 * Dos caminos claros: "Tomar foto" abre directo la cámara de frente (capture="user") y "Elegir foto" sus fotos.
 * Antes era un solo selector y en algunos teléfonos (sobre todo abierto dentro de WhatsApp) la opción de
 * cámara no abría nada.
 */
function SubirFoto({ token, foto, nombre, sinConexion, onListo, variante = 'circulo' }: { token: string; foto: string | null; nombre: string; sinConexion: boolean; onListo: () => void; variante?: 'circulo' | 'tarjeta' }) {
  const camara = useRef<HTMLInputElement>(null);
  const galeria = useRef<HTMLInputElement>(null);
  const [estado, setEstado] = useState<'listo' | 'subiendo' | 'error'>('listo');
  const [menu, setMenu] = useState(false);
  // después de intentar con la cámara: por si en ese navegador no abre, decir qué hacer
  const [probóCamara, setProbóCamara] = useState(false);
  const subir = async (f: File | undefined) => {
    if (!f || !supabase) return;
    setEstado('subiendo');
    try {
      const { data, error } = await supabase.rpc('portal_foto', { p_token: token, p_foto: await prepararFoto(f) });
      if (error || data?.error) throw new Error('foto');
      setEstado('listo');
      onListo();
    } catch {
      setEstado('error');
    }
  };
  const tomar = () => {
    setMenu(false);
    setProbóCamara(true);
    camara.current?.click();
  };
  const elegir = () => {
    setMenu(false);
    galeria.current?.click();
  };
  const entradas = (
    <>
      <input ref={camara} type="file" accept="image/*" capture="user" className="hidden" onChange={(e) => void subir(e.target.files?.[0])} />
      <input ref={galeria} type="file" accept="image/*" className="hidden" onChange={(e) => void subir(e.target.files?.[0])} />
    </>
  );
  const ayuda = probóCamara && estado !== 'subiendo' && (
    <p className="text-xs text-ink-500">¿No se abrió la cámara? Abre tu enlace en Chrome o Safari, o toma la foto con la cámara del teléfono y usa “Elegir foto”.</p>
  );
  if (variante === 'tarjeta')
    return (
      <div className="space-y-3 rounded-3xl bg-superficie p-4 ring-1 ring-ink-100">
        <div className="flex items-center gap-4">
          <span className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xl font-extrabold text-brand-600 border-2 border-dashed border-brand-500/40" aria-hidden="true">
            {nombre.trim()[0]?.toUpperCase()}
            <span className="absolute -right-1 -bottom-1 flex h-6 w-6 items-center justify-center rounded-full bg-brand-500 text-white ring-2 ring-superficie">
              <Camera size={13} />
            </span>
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-bold">Pon tu foto</p>
            <p className="text-sm text-ink-500">Así te reconocen en recepción y en tu clase.</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" disabled={estado === 'subiendo'} onClick={tomar} className="flex h-11 items-center justify-center gap-1.5 rounded-xl bg-brand-50 text-sm font-bold text-brand-600 ring-1 ring-brand-500/20 active:scale-95 disabled:opacity-50">
            <Camera size={16} aria-hidden="true" /> {estado === 'subiendo' ? 'Subiendo…' : 'Tomar foto'}
          </button>
          <button type="button" disabled={estado === 'subiendo'} onClick={elegir} className="flex h-11 items-center justify-center gap-1.5 rounded-xl bg-superficie text-sm font-bold text-ink-700 ring-1 ring-ink-100 active:scale-95 disabled:opacity-50">
            <ImageIcon size={16} aria-hidden="true" /> Elegir foto
          </button>
        </div>
        {estado === 'error' && <p className="text-xs font-semibold text-bad-600">No se pudo subir; inténtalo otra vez</p>}
        {ayuda}
        {entradas}
      </div>
    );
  return (
    <div className="relative shrink-0">
      <button
        type="button"
        disabled={sinConexion || estado === 'subiendo'}
        onClick={() => setMenu(!menu)}
        className="relative rounded-full"
        aria-label="Cambiar mi foto"
        aria-expanded={menu}
      >
        <img src={foto ?? undefined} alt="" className="h-14 w-14 rounded-full object-cover" />
        {estado === 'subiendo' && <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 text-[10px] font-bold text-white">…</span>}
      </button>
      {menu && (
        <>
          {/* tocar fuera lo cierra */}
          <button type="button" className="fixed inset-0 z-20 cursor-default" aria-label="Cerrar" onClick={() => setMenu(false)} />
          {/* el círculo está a la derecha del pase: el menú abre hacia la izquierda para no salirse */}
          <div className="absolute top-full right-0 z-30 mt-2 w-48 overflow-hidden rounded-2xl bg-superficie text-ink-900 shadow-lg ring-1 ring-ink-100">
            <button type="button" onClick={tomar} className="flex w-full items-center gap-2.5 px-4 py-3 text-left text-sm font-semibold active:bg-ink-50">
              <Camera size={18} className="text-brand-600" aria-hidden="true" /> Tomar foto
            </button>
            <button type="button" onClick={elegir} className="flex w-full items-center gap-2.5 border-t border-ink-100 px-4 py-3 text-left text-sm font-semibold active:bg-ink-50">
              <ImageIcon size={18} className="text-ink-500" aria-hidden="true" /> Elegir foto
            </button>
          </div>
        </>
      )}
      {entradas}
      {estado === 'error' && <span className="block text-xs font-semibold text-bad-600">No se pudo subir; inténtalo otra vez</span>}
    </div>
  );
}

/** Sus últimas clases: las 3 más recientes a la vista y "Ver las 8" (antes 8 renglones casi iguales). */
function UltimasClases({ clases }: { clases: DatosPortal['clases'] }) {
  const [todas, setTodas] = useState(false);
  const visibles = todas ? clases : clases.slice(0, 3);
  return (
    <div className="rounded-3xl bg-superficie p-5 ring-1 ring-ink-100">
      <p className="flex items-center gap-1.5 text-xs font-bold tracking-wider text-ink-500 uppercase">
        <CalendarCheck size={14} aria-hidden="true" /> Tus últimas clases
      </p>
      <ul className="mt-2 divide-y divide-ink-100">
        {visibles.map((c, i) => (
          <li key={i} className="flex items-center gap-3 py-2">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: c.color ?? 'var(--marca)' }} />
            <span className="flex-1 font-medium">{c.clase}</span>
            <span className="text-sm text-ink-500">{fechaCorta(c.fecha)}</span>
          </li>
        ))}
      </ul>
      {clases.length > 3 && (
        <button type="button" onClick={() => setTodas(!todas)} className="mt-1 min-h-11 w-full rounded-xl text-sm font-semibold text-brand-600 active:bg-ink-50">
          {todas ? 'Ver menos' : `Ver las ${clases.length}`}
        </button>
      )}
    </div>
  );
}

function saludo(d: Date): string {
  const h = d.getHours();
  return h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches';
}

/** Botón de WhatsApp: fuerte (verde lleno) solo cuando urge (renovar); si no, tonal, para no competir con "Mostrar mi pase". */
const WA_FUERTE = 'bg-[#15803d] text-white';
const WA_SUAVE = 'bg-ok-50 text-ok-600 ring-1 ring-ok-600/20';
function BotonWhats({ href, texto, fuerte = false }: { href: string | null; texto: string; fuerte?: boolean }) {
  if (!href) return <p className="mt-2 text-sm text-ink-500">Pregunta en recepción.</p>;
  return (
    <a href={href} target="_blank" rel="noreferrer" className={cx('mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-2xl font-bold active:scale-[0.98]', fuerte ? WA_FUERTE : WA_SUAVE)}>
      <MessageCircle size={20} aria-hidden="true" /> {texto}
    </a>
  );
}

/** Círculo de lo que le queda del plan. */
function Anillo({ fraccion, urgente, valor, unidad }: { fraccion: number; urgente: boolean; valor: number; unidad: string }) {
  const r = 34;
  const largo = 2 * Math.PI * r;
  return (
    <div className="relative h-20 w-20 shrink-0" role="img" aria-label={`Te quedan ${valor} ${unidad}`}>
      <svg viewBox="0 0 80 80" className="h-full w-full -rotate-90" aria-hidden="true">
        <circle cx="40" cy="40" r={r} fill="none" strokeWidth="8" className="stroke-ink-100" />
        <circle
          cx="40"
          cy="40"
          r={r}
          fill="none"
          strokeWidth="8"
          strokeLinecap="round"
          className={urgente ? 'stroke-warn-600' : 'stroke-brand-500'}
          strokeDasharray={largo}
          strokeDashoffset={largo * (1 - Math.max(0.02, fraccion))}
          style={{ transition: 'stroke-dashoffset 900ms ease-out' }}
        />
      </svg>
      <span className="absolute inset-0 flex flex-col items-center justify-center leading-none" aria-hidden="true">
        <span className="text-2xl font-extrabold">{valor}</span>
        <span className="text-[10px] font-semibold text-ink-500">{unidad}</span>
      </span>
    </div>
  );
}

/** "Tu próxima clase" con cuánto falta (se actualiza solo) y su semana. */
function ProximaClaseTarjeta({ horario, slug }: { horario: ClaseHorario[]; slug: string | null }) {
  const [ahora, setAhora] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setAhora(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);
  const prox = proximaClase(horario, ahora);
  const dias = semana(horario);
  if (!prox)
    return slug ? (
      <a href={`/a/${slug}?yo=1#horarios`} className="flex items-center gap-3 rounded-3xl bg-superficie p-5 ring-1 ring-ink-100">
        <Clock size={22} className="text-brand-600" aria-hidden="true" />
        <span className="flex-1 font-semibold">Ver el horario de clases</span>
        <span aria-hidden="true" className="text-ink-300">›</span>
      </a>
    ) : null;
  const color = prox.clase.color ?? 'var(--marca)';
  return (
    <div className="overflow-hidden rounded-3xl bg-superficie ring-1 ring-ink-100">
      <div className="flex gap-4 p-5" style={{ background: `linear-gradient(135deg, color-mix(in oklab, ${color} 16%, transparent), transparent 70%)` }}>
        <span className="w-1.5 shrink-0 rounded-full" style={{ background: color }} aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-xs font-bold tracking-wider text-ink-500 uppercase">
            <Clock size={14} aria-hidden="true" /> Tu próxima clase
          </p>
          <p className="mt-1 text-2xl leading-tight font-extrabold">{prox.clase.clase}</p>
          <p className={cx('mt-1 flex items-center gap-2 font-semibold', prox.estado === 'ahora' ? 'text-ok-600' : 'text-ink-700')}>
            {prox.estado === 'ahora' && <span className="pp-pulso h-2.5 w-2.5 rounded-full bg-ok-600" aria-hidden="true" />}
            {prox.texto}
          </p>
          <p className="text-sm text-ink-500">
            {prox.clase.hora} – {horaFin(prox.clase.hora, prox.clase.duracion)}
            {prox.clase.sedeCambio && ` · ${prox.clase.sedeCambio}`}
          </p>
        </div>
      </div>
      {dias.length > 0 && (
        <div className="flex gap-2 overflow-x-auto border-t border-ink-100 px-5 py-3">
          {dias.map((d) => (
            <span key={d.dia} className="shrink-0 rounded-xl bg-ink-50 px-3 py-1.5 text-xs">
              <b className="text-ink-900">{d.dia}</b> <span className="text-ink-500">{d.clases.map((c) => `${c.hora} ${c.clase}`).join(' · ')}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

const horaFin = (h: string, min: number) => {
  const t = Number(h.slice(0, 2)) * 60 + Number(h.slice(3)) + min;
  return `${String(Math.floor(t / 60) % 24).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
};

/** Cuántas clases lleva, su racha y sus insignias. */
function Logros({ total, desde, semanas, hoy }: { total: number; desde: string | null; semanas: string[]; hoy: string }) {
  const n = racha(semanas, hoy);
  const ins = insignias(total);
  const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  return (
    <div className="rounded-3xl bg-superficie p-5 ring-1 ring-ink-100">
      <p className="flex items-center gap-1.5 text-xs font-bold tracking-wider text-ink-500 uppercase">
        <Trophy size={14} aria-hidden="true" /> Tus logros
      </p>
      <div className="mt-2 flex items-end gap-4">
        <p className="leading-none">
          <span className="text-5xl font-extrabold tracking-tight tabular-nums">{total}</span>{' '}
          <span className="font-semibold text-ink-500">{total === 1 ? 'clase' : 'clases'}</span>
        </p>
        {n >= 2 && (
          <p className="mb-1 rounded-full bg-warn-50 px-3 py-1 text-sm font-bold text-warn-600">
            🔥 {n} semanas seguidas
          </p>
        )}
      </div>
      {desde && <p className="mt-1 text-sm text-ink-500">Bailando con nosotros desde {MESES[Number(desde.slice(5, 7)) - 1]} de {desde.slice(0, 4)}</p>}
      <ul className="mt-4 grid grid-cols-6 gap-1.5" aria-label="Insignias">
        {INSIGNIAS.map((i) => {
          const ganada = total >= i.meta;
          return (
            <li key={i.meta} className="flex flex-col items-center gap-1 text-center" title={`${i.nombre}: ${i.meta} ${i.meta === 1 ? 'clase' : 'clases'}`}>
              <span className={cx('flex h-11 w-11 items-center justify-center rounded-full text-2xl', ganada ? 'bg-brand-50 ring-2 ring-brand-500/40' : 'bg-ink-50 opacity-40 grayscale')} aria-hidden="true">
                {i.emoji}
              </span>
              <span className={cx('text-[10px] leading-tight font-semibold', ganada ? 'text-ink-900' : 'text-ink-500')}>{i.meta}</span>
              <span className="sr-only">
                {i.nombre}, {ganada ? 'ganada' : 'por ganar'}
              </span>
            </li>
          );
        })}
      </ul>
      {ins.siguiente && (
        <div className="mt-4">
          <p className="text-sm">
            Te {ins.faltan === 1 ? 'falta' : 'faltan'} <b>{ins.faltan}</b> {ins.faltan === 1 ? 'clase' : 'clases'} para {ins.siguiente.emoji} <b>{ins.siguiente.nombre}</b>
          </p>
          <div className="mt-1.5 h-2 rounded-full bg-ink-100">
            <div className="h-full rounded-full bg-brand-500" style={{ width: `${Math.max(4, ins.avance * 100)}%` }} />
          </div>
        </div>
      )}
    </div>
  );
}

/** El pase en grande: fondo blanco, QR al centro y la pantalla encendida mientras se muestra. */
function PaseCompleto({ qr, nombre, codigo, foto, onCerrar }: { qr: string | null; nombre: string; codigo: string; foto: string | null; onCerrar: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    d?.showModal();
    let lock: { release: () => Promise<void> } | null = null;
    const nav = navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } };
    nav.wakeLock?.request('screen').then((l) => (lock = l)).catch(() => {});
    return () => {
      void lock?.release().catch(() => {});
      if (d?.open) d.close();
    };
  }, []);
  return (
    <dialog ref={ref} onClose={onCerrar} aria-label="Mi pase de entrada" className="m-0 h-dvh max-h-none w-screen max-w-none bg-white p-0 text-[#16141c] backdrop:bg-white">
      <div className="flex min-h-full flex-col items-center justify-center gap-4 px-6 py-4 text-center">
        <div className="flex items-center gap-3">
          {foto && <img src={foto} alt="" className="h-14 w-14 rounded-full object-cover" />}
          <div className="text-left">
            <p className="text-xl font-extrabold">{nombre}</p>
            <p className="font-mono tracking-[0.3em] text-[#6b6778]">{codigo}</p>
          </div>
        </div>
        {qr && <img src={qr} alt="Tu código QR" className="aspect-square w-full max-w-[min(85vw,55dvh,26rem)]" />}
        <p className="flex items-center gap-1.5 text-sm text-[#6b6778]">
          <Sun size={16} aria-hidden="true" /> Sube el brillo y muéstralo en recepción
        </p>
        <button type="button" onClick={() => ref.current?.close()} className="mt-2 h-12 rounded-2xl bg-[#ecebf0] px-8 font-bold" autoFocus>
          Listo
        </button>
      </div>
    </dialog>
  );
}

/**
 * "Cuéntanos tu experiencia": el alumno escribe su testimonio. Se revisa antes de publicarse y en la página
 * aparece solo con su nombre de pila e inicial. Si ya mandó uno, ve si está en revisión o publicado.
 */
function TuTestimonio({ token, nombre, academia, actual, sinConexion, onListo, onOcultar }: { token: string; nombre: string; academia: string; actual: DatosPortal['testimonio']; sinConexion: boolean; onListo: () => void; onOcultar: () => void }) {
  const [texto, setTexto] = useState('');
  const [escribiendo, setEscribiendo] = useState(false);
  const [estado, setEstado] = useState<'listo' | 'enviando' | 'enviado'>('listo');
  const [error, setError] = useState('');
  const MAX = 400;
  const enviar = async () => {
    if (!supabase) return;
    setEstado('enviando');
    setError('');
    const { data, error: e } = await supabase.rpc('portal_testimonio', { p_token: token, p_texto: texto });
    if (e || data?.error) {
      setError(ERRORES_TESTIMONIO[data?.error] ?? 'No se pudo enviar. Revisa tu conexión e inténtalo de nuevo.');
      setEstado('listo');
      return;
    }
    setEstado('enviado');
    setEscribiendo(false);
    onListo();
  };
  const formulario = escribiendo || (!actual && estado !== 'enviado');
  return (
    <div className="rounded-3xl bg-superficie p-5 ring-1 ring-ink-100">
      <div className="-mt-2 -mr-2 flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-xs font-bold tracking-wider text-ink-500 uppercase">
          <MessageCircle size={14} aria-hidden="true" /> Tu experiencia
        </p>
        <button type="button" onClick={onOcultar} className="flex h-10 w-10 items-center justify-center rounded-full text-ink-500 active:bg-ink-100" aria-label="Quitar “Tu experiencia”">
          <X size={18} aria-hidden="true" />
        </button>
      </div>
      {formulario ? (
        <>
          <p className="mt-2 font-semibold">¿Qué te ha dejado bailar en {academia}?</p>
          <p className="text-sm text-ink-500">Si quieres, cuéntalo: ayuda a que más gente se anime a empezar.</p>
          <label className="sr-only" htmlFor="testimonio">Tu testimonio</label>
          <textarea
            id="testimonio"
            value={texto}
            onChange={(e) => setTexto(e.target.value.slice(0, MAX))}
            rows={4}
            placeholder="Ej. Llegué sin saber nada y ahora bailo cada semana…"
            disabled={sinConexion}
            className="mt-3 w-full resize-none rounded-2xl bg-ink-50 p-3 text-[15px] ring-1 ring-ink-100 outline-none focus:ring-2 focus:ring-brand-500"
          />
          <div className="mt-1 flex justify-between gap-3 text-xs text-ink-500">
            <span>
              Lo revisamos antes de publicarlo. En la página aparece como <b className="text-ink-700">{nombrePublico(nombre)}</b>.
            </span>
            <span className="shrink-0 tabular-nums">
              {texto.length}/{MAX}
            </span>
          </div>
          {error && (
            <p role="alert" className="mt-2 text-sm font-semibold text-bad-600">
              {error}
            </p>
          )}
          <button
            type="button"
            onClick={() => void enviar()}
            disabled={sinConexion || estado === 'enviando' || texto.trim().length < 10}
            className="mt-3 h-12 w-full rounded-2xl bg-brand-500 font-bold text-white active:scale-[0.98] disabled:bg-ink-100 disabled:text-ink-500"
          >
            {estado === 'enviando' ? 'Enviando…' : 'Enviar'}
          </button>
        </>
      ) : (
        <>
          <p className="mt-2 font-semibold">
            {actual?.estado === 'aprobado' ? '¡Tu testimonio está en nuestra página! Gracias 💛' : estado === 'enviado' || actual?.estado === 'pendiente' ? '¡Gracias! Lo estamos revisando.' : 'Gracias por escribirnos.'}
          </p>
          {actual && <p className="mt-2 rounded-2xl bg-ink-50 p-3 text-sm text-ink-700">“{actual.texto}”</p>}
          <button type="button" onClick={() => setEscribiendo(true)} className="mt-2 min-h-10 rounded-lg px-1 text-sm font-semibold text-brand-600 active:bg-ink-50">
            Escribir otro
          </button>
        </>
      )}
    </div>
  );
}

/** Invitar a un amigo: comparte la página de la academia "de parte de" este alumno, y ve a cuántos invitó. */
function InvitaAmigo({ academia, slug, invita }: { academia: string; slug: string; invita: NonNullable<DatosPortal['invita']> }) {
  const [copiado, setCopiado] = useState(false);
  const url = enlaceInvitacion(location.origin, slug, invita.de);
  const texto = mensajeInvitacion(academia, url);
  const puedeCompartir = typeof navigator.share === 'function';
  const logro = textoInvitados(invita.invitados, invita.inscritos);
  return (
    <div className="rounded-3xl bg-superficie p-5 ring-1 ring-ink-100">
      <p className="flex items-center gap-1.5 text-xs font-bold tracking-wider text-ink-500 uppercase">
        <Users size={14} aria-hidden="true" /> Invita a un amigo
      </p>
      <p className="mt-2 font-semibold">Bailar es mejor en compañía 💃🕺</p>
      <p className="text-sm text-ink-500">Mándale tu invitación: verá horarios, precios y podrá apartar su primera clase.</p>
      {logro && <p className="mt-3 rounded-2xl bg-ok-50 px-3 py-2 text-sm font-semibold text-ok-600">{logro}</p>}
      <a
        href={`https://wa.me/?text=${encodeURIComponent(texto)}`}
        target="_blank"
        rel="noreferrer"
        className={cx('mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-2xl font-bold active:scale-[0.98]', WA_SUAVE)}
      >
        <MessageCircle size={20} aria-hidden="true" /> Invitar por WhatsApp
      </a>
      <button
        type="button"
        onClick={() =>
          puedeCompartir
            ? void navigator.share({ title: academia, text: texto }).catch(() => {})
            : void navigator.clipboard?.writeText(url).then(() => {
                setCopiado(true);
                setTimeout(() => setCopiado(false), 2500);
              })
        }
        className="mt-1 h-11 w-full rounded-2xl text-sm font-semibold text-ink-700 active:bg-ink-50"
      >
        {puedeCompartir ? 'Compartir de otra forma' : copiado ? '¡Enlace copiado!' : 'Copiar enlace'}
      </button>
    </div>
  );
}

const MES_CORTO = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** Próximos eventos (socials, talleres): los 3 primeros y el resto al tocar "Ver más". "Quiero ir" escribe por WhatsApp. */
const DIA_CORTO = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

function ProximosEventos({ eventos, hoy, nombre, codigo, whatsapp }: { eventos: NonNullable<DatosPortal['eventos']>; hoy: string; nombre: string; codigo: string; whatsapp: string | null }) {
  const [todos, setTodos] = useState(false);
  const visibles = todos ? eventos : eventos.slice(0, 3);
  return (
    <div className="rounded-3xl bg-superficie p-5 ring-1 ring-ink-100">
      <p className="flex items-center gap-1.5 text-xs font-bold tracking-wider text-ink-500 uppercase">
        <PartyPopper size={14} aria-hidden="true" /> Próximos eventos
      </p>
      <ul className="mt-3 space-y-3">
        {visibles.map((e, i) => {
          const [yy, mm, dd] = e.fecha.split('-').map(Number);
          const falta = faltaParaEvento(hoy, e.fecha);
          const link = e.quedan !== 0 && whatsapp ? waLink(whatsapp, mensajeEvento(nombre, codigo, e)) : null;
          return (
            // Reacomodada: se leía como lista de datos. Ahora el día de la semana en la fecha, hora y lugar en una
            // línea, lo urgente como etiquetas, y abajo una barra con el precio grande y "Quiero ir".
            <li key={i} className={cx(i > 0 && 'border-t border-ink-100 pt-4')}>
              {e.foto && <img src={e.foto} alt={`Flyer de ${e.nombre}`} loading="lazy" className="mb-3 max-h-80 w-full rounded-2xl bg-ink-50 object-contain" />}
              <div className="flex gap-3">
                <span className="flex h-16 w-14 shrink-0 flex-col items-center justify-center rounded-2xl bg-brand-500 text-white" aria-hidden="true">
                  <span className="text-[10px] font-bold tracking-wider uppercase opacity-90">{DIA_CORTO[new Date(yy, mm - 1, dd).getDay()]}</span>
                  <span className="text-xl leading-none font-extrabold">{dd}</span>
                  <span className="text-[10px] font-bold uppercase">{MES_CORTO[mm - 1]}</span>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-lg leading-tight font-bold">{e.nombre}</span>
                  <span className="mt-0.5 block text-sm text-ink-500">
                    <span className="sr-only">{`${DIA_CORTO[new Date(yy, mm - 1, dd).getDay()]} ${dd} de ${MES_CORTO[mm - 1]}, `}</span>
                    {e.hora}
                    {/* en su academia basta el nombre del lugar; fuera de ella va abajo con dirección y "Cómo llegar" */}
                    {!e.otro_lugar && e.lugar ? ` · ${e.lugar}` : ''}
                  </span>
                  {(falta || (e.quedan !== null && e.quedan > 0 && e.quedan <= 20)) && (
                    <span className="mt-1.5 flex flex-wrap gap-1.5">
                      {falta && <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-extrabold text-brand-600">{falta}</span>}
                      {e.quedan !== null && e.quedan > 0 && e.quedan <= 20 && (
                        <span className="rounded-full bg-warn-50 px-2 py-0.5 text-[11px] font-extrabold text-warn-600">¡Quedan {e.quedan}!</span>
                      )}
                    </span>
                  )}
                </span>
              </div>
              <div className="text-ink-700">
                <DetalleEvento e={e.otro_lugar ? e : { ...e, lugar: '' }} paraAlumno />
              </div>
              <div className="mt-3 flex items-center justify-between gap-3 rounded-2xl bg-ink-50 py-2 pr-2 pl-4">
                <span>
                  <span className="block text-lg leading-tight font-extrabold">{e.precio > 0 ? dinero(e.precio) : 'Gratis'}</span>
                  <span className="block text-xs text-ink-500">{e.precio > 0 ? 'boleto' : 'entrada libre'}</span>
                </span>
                {e.quedan === 0 ? (
                  <span className="rounded-full bg-bad-50 px-3 py-1 text-sm font-extrabold text-bad-600">Agotado</span>
                ) : (
                  link && (
                    <a href={link} target="_blank" rel="noreferrer" className={cx('flex min-h-11 items-center gap-2 rounded-xl px-5 text-sm font-bold active:scale-[0.98]', WA_FUERTE)}>
                      <MessageCircle size={18} aria-hidden="true" /> Quiero ir
                    </a>
                  )
                )}
              </div>
            </li>
          );
        })}
      </ul>
      {eventos.length > 3 && !todos && (
        <button type="button" onClick={() => setTodos(true)} className="mt-3 h-11 w-full rounded-xl text-sm font-semibold text-brand-600 ring-1 ring-ink-100 active:bg-ink-50">
          Ver {eventos.length - 3} {eventos.length - 3 === 1 ? 'evento más' : 'eventos más'}
        </button>
      )}
    </div>
  );
}
