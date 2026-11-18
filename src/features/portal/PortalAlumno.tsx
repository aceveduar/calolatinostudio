import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Camera, CalendarCheck, Clock, MessageCircle, PackageCheck, QrCode, Sun, WifiOff, X } from 'lucide-react';
import { useRef } from 'react';
import { prepararFoto } from '../../app/fotos';
import { supabase } from '../../sync/supabase';
import { LogoAcademia } from '../../components/LogoAcademia';
import { cx } from '../../components/ui';
import { ImagenProducto } from '../../components/ImagenProducto';
import { contenidoQR } from '../../domain/qr';
import { dinero } from '../../domain/dinero';
import { diasEntre, fechaCorta, fechaLarga } from '../../domain/fechas';
import { ERRORES_PEDIDO, type DatosPortal } from '../../domain/portal';
import { INSIGNIAS, insignias, mensajeRenovar, proximaClase, racha, restante, semana, type ClaseHorario } from '../../domain/miPortal';
import { waLink } from '../../domain/reportes';

type Estado = { fase: 'cargando' } | { fase: 'listo'; datos: DatosPortal; guardadoEl: number | null } | { fase: 'no-existe' } | { fase: 'error' };

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
  useEffect(() => {
    let vivo = true;
    (async () => {
      if (!supabase) return setEstado((e) => (e.fase === 'listo' ? e : { fase: 'error' }));
      const { data, error } = await supabase.rpc('portal_alumno', { p_token: token });
      if (!vivo) return;
      if (error) return setEstado((e) => (e.fase === 'listo' ? e : { fase: 'error' }));
      if (!data) {
        // enlace regenerado o alumno dado de baja: no dejar datos viejos en el teléfono
        try {
          localStorage.removeItem(CLAVE(token));
        } catch {
          /* nada */
        }
        return setEstado({ fase: 'no-existe' });
      }
      try {
        localStorage.setItem(CLAVE(token), JSON.stringify({ datos: data, at: Date.now() }));
      } catch {
        /* sin espacio: igual se muestra */
      }
      setEstado({ fase: 'listo', datos: data as DatosPortal, guardadoEl: null });
    })();
    return () => {
      vivo = false;
    };
  }, [token, version]);

  const color = estado.fase === 'listo' ? estado.datos.academia.color : null;
  useEffect(() => {
    if (color) document.documentElement.style.setProperty('--marca', color);
    document.title = estado.fase === 'listo' ? `${estado.datos.alumno.nombre.split(' ')[0]} · ${estado.datos.academia.nombre}` : 'Mi credencial';
  }, [color, estado]);

  if (estado.fase === 'cargando') return <Centro>Cargando tu credencial…</Centro>;
  if (estado.fase === 'no-existe')
    return (
      <Centro titulo="Este enlace ya no funciona">
        Pide en recepción que te envíen tu enlace nuevo por WhatsApp.
      </Centro>
    );
  if (estado.fase === 'error') return <Centro titulo="No se pudo cargar">Revisa tu conexión a internet e inténtalo de nuevo.</Centro>;
  return <Vista datos={estado.datos} guardadoEl={estado.guardadoEl} token={token} recargar={() => setVersion((v) => v + 1)} />;
}

function HojaApartar({ producto, token, onCerrar, onListo }: { producto: DatosPortal['tienda'][number]; token: string; onCerrar: () => void; onListo: (texto: string) => void }) {
  const [opcion, setOpcion] = useState<string | null>(producto.opciones.length === 1 ? producto.opciones[0] : null);
  const [cantidad, setCantidad] = useState(1);
  const encargo = !!producto.sobre_pedido;
  const [nota, setNota] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const maximo = Math.max(1, Math.min(5, producto.disponibles ?? 5));
  const falta = producto.opciones.length > 0 && !opcion;

  const enviar = async () => {
    if (!supabase) return;
    setOcupado(true);
    setError(null);
    try {
      // el detalle solo se manda si lo escribió (así sirve aunque la base aún no tenga ese campo)
      const { data, error: e } = await supabase.rpc('portal_pedir', { p_token: token, p_producto: producto.id, p_opcion: opcion, p_cantidad: cantidad, ...(nota.trim() ? { p_nota: nota.trim() } : {}) });
      if (e) throw new Error('Sin conexión. Inténtalo otra vez.');
      if (data?.error) {
        setError(data.error === 'agotado' && typeof data.disponibles === 'number' && data.disponibles > 0 ? `Solo quedan ${data.disponibles}.` : (ERRORES_PEDIDO[data.error] ?? 'No se pudo apartar.'));
        return;
      }
      onListo(
        encargo
          ? `¡Listo! Encargaste ${producto.nombre}${opcion ? ` (${opcion})` : ''}${cantidad > 1 ? ` ×${cantidad}` : ''}. Te avisamos cuando llegue${producto.dias_entrega ? ` (unos ${producto.dias_entrega} días)` : ''}.`
          : `¡Listo! Apartaste ${producto.nombre}${opcion ? ` (${opcion})` : ''}${cantidad > 1 ? ` ×${cantidad}` : ''}. Recógelo y págalo en recepción.`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo apartar.');
    } finally {
      setOcupado(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label={`Apartar ${producto.nombre}`}>
      <div className="absolute inset-0 bg-panel/40 animate-aparece" onClick={onCerrar} />
      <div className="relative w-full max-w-md rounded-t-3xl bg-ink-50 p-5 pb-safe animate-sube sm:rounded-3xl">
        <div className="flex items-center gap-3">
          <ImagenProducto foto={producto.foto} emoji={producto.emoji} tam={64} />
          <span className="min-w-0 flex-1">
            <span className="block text-lg font-bold">{producto.nombre}</span>
            <span className="block font-bold text-brand-600">{dinero(producto.precio)}</span>
          </span>
          <button onClick={onCerrar} className="rounded-full p-2 text-ink-500 active:bg-ink-100" aria-label="Cerrar">
            <X size={20} />
          </button>
        </div>
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
        {encargo && <p className="mt-2 text-xs text-ink-500">Se pide al proveedor{producto.dias_entrega ? ` y tarda unos ${producto.dias_entrega} días` : ''}. Te avisamos por WhatsApp cuando llegue; lo pagas al recogerlo.</p>}
        {error && <p className="mt-3 rounded-xl bg-bad-50 px-3 py-2 text-sm font-medium text-bad-600">{error}</p>}
        <button
          type="button"
          onClick={enviar}
          disabled={ocupado || falta}
          className="mt-4 h-14 w-full rounded-2xl bg-brand-500 text-lg font-bold text-white active:scale-[0.98] disabled:opacity-50"
        >
          {falta ? 'Elige talla o color' : `${encargo ? 'Encargar' : 'Apartar'} · pagas ${dinero(producto.precio * cantidad)} al recoger`}
        </button>
      </div>
    </div>
  );
}

function Centro({ titulo, children }: { titulo?: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-2 bg-ink-50 px-8 text-center">
      {titulo && <p className="text-lg font-bold">{titulo}</p>}
      <p className="text-ink-500">{children}</p>
    </div>
  );
}

function Vista({ datos: crudos, guardadoEl, token, recargar }: { datos: DatosPortal; guardadoEl: number | null; token: string; recargar: () => void }) {
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
        {guardadoEl && (
          <p className="flex items-center gap-2 rounded-2xl bg-warn-50 px-4 py-2.5 text-sm font-medium text-warn-600">
            <WifiOff size={16} className="shrink-0" /> Sin conexión: datos del {fechaCorta(new Date(guardadoEl).toISOString().slice(0, 10))}. Tu pase sí sirve.
          </p>
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
            <SubirFoto token={token} foto={datos.alumno.foto ?? null} nombre={datos.alumno.nombre} sinConexion={!!guardadoEl} onListo={recargar} />
          </div>
          <button
            type="button"
            onClick={() => setPase(true)}
            className="mt-4 flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-brand-500 text-lg font-bold text-white shadow-lg shadow-brand-500/30 active:scale-[0.98]"
          >
            <QrCode size={22} aria-hidden="true" /> Mostrar mi pase
          </button>
          {!datos.alumno.foto && !guardadoEl && <p className="mt-2 text-center text-xs font-semibold text-[color-mix(in_oklab,var(--marca)_80%,black)]">Toca “FOTO” y pon tu foto: así te reconocen en recepción.</p>}
        </div>

        <ProximaClaseTarjeta horario={datos.horario ?? []} slug={datos.academia.slug ?? null} />

        {/* Plan */}
        <div className="rounded-3xl bg-superficie p-5 ring-1 ring-ink-100">
          <p className="text-xs font-bold tracking-wider text-ink-500 uppercase">Tu plan</p>
          {vigentes.length === 0 ? (
            <div className="mt-2">
              <p className="text-lg font-bold">{vencido ? `Tu ${vencido.plan.toLowerCase()} terminó` : 'Pagas por clase'}</p>
              <p className="text-sm text-ink-500">{vencido ? 'Renuévalo para seguir bailando.' : 'Con una mensualidad o paquete te sale más barato.'}</p>
              <BotonWhats href={renovar(vencido?.plan ?? null)} texto={vencido ? 'Renovar por WhatsApp' : 'Preguntar por planes'} />
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
                  {r.urgente && !p.beca && !proximos.length && <BotonWhats href={renovar(p.plan)} texto="Renovar por WhatsApp" />}
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

        {datos.logros && datos.logros.total > 0 && <Logros total={datos.logros.total} desde={datos.logros.desde} semanas={datos.logros.semanas} hoy={hoy} />}

        {/* Últimas clases */}
        {datos.clases.length > 0 && (
          <div className="rounded-3xl bg-superficie p-5 ring-1 ring-ink-100">
            <p className="flex items-center gap-1.5 text-xs font-bold tracking-wider text-ink-500 uppercase">
              <CalendarCheck size={14} /> Tus últimas clases
            </p>
            <ul className="mt-2 divide-y divide-ink-100">
              {datos.clases.map((c, i) => (
                <li key={i} className="flex items-center gap-3 py-2">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: c.color ?? 'var(--marca)' }} />
                  <span className="flex-1 font-medium">{c.clase}</span>
                  <span className="text-sm text-ink-500">{fechaCorta(c.fecha)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {aviso && (
          <p role="status" className="flex items-center gap-2 rounded-2xl bg-ok-50 px-4 py-3 text-sm font-semibold text-ok-600">
            <PackageCheck size={18} className="shrink-0" /> {aviso}
          </p>
        )}

        {/* Mis apartados */}
        {pedidos.length > 0 && (
          <div className="rounded-3xl bg-superficie p-5 ring-1 ring-ink-100">
            <p className="text-xs font-bold tracking-wider text-ink-500 uppercase">Tus apartados y encargos</p>
            <ul className="mt-2 divide-y divide-ink-100">
              {pedidos.map((p, i) => (
                <li key={i} className="flex items-center gap-3 py-2">
                  <span className="text-2xl leading-none">{p.emoji}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">
                      {p.producto}
                      {p.opcion && ` · ${p.opcion}`}
                      {p.cantidad > 1 && ` ×${p.cantidad}`}
                    </span>
                    {p.nota && <span className="block truncate text-xs text-ink-700">{p.nota}</span>}
                    <span className="block text-xs text-ink-500">
                      {p.estado === 'entregado'
                        ? 'Entregado'
                        : p.estado === 'llego' || p.estado === 'pendiente'
                          ? `${p.estado === 'llego' ? '¡Ya llegó! ' : ''}Recógelo en recepción · ${dinero(Math.max(0, p.precio * p.cantidad - (p.anticipo ?? 0)))}`
                          : 'El proveedor lo está preparando'}
                    </span>
                  </span>
                  <span
                    className={
                      p.estado === 'entregado' || p.estado === 'llego'
                        ? 'rounded-full bg-ok-50 px-2.5 py-0.5 text-xs font-bold text-ok-600'
                        : 'rounded-full bg-warn-50 px-2.5 py-0.5 text-xs font-bold text-warn-600'
                    }
                  >
                    {p.estado === 'entregado' ? '✓' : p.estado === 'llego' ? 'Llegó' : p.estado === 'pedido' ? 'En camino' : 'Apartado'}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Tienda */}
        {datos.tienda.length > 0 && (
          <div className="rounded-3xl bg-superficie p-5 ring-1 ring-ink-100">
            <p className="text-xs font-bold tracking-wider text-ink-500 uppercase">Tienda de la academia</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {datos.tienda.map((p) => {
                const agotado = !p.sobre_pedido && p.disponibles !== null && p.disponibles <= 0;
                return (
                  <div key={p.id} className="flex flex-col rounded-2xl bg-ink-50 p-3 text-center">
                    <ImagenProducto foto={p.foto} emoji={p.emoji} tam={80} className={cx('mx-auto', !p.foto && 'bg-transparent')} />
                    <p className="mt-1 line-clamp-2 text-sm font-semibold">{p.nombre}</p>
                    {p.descripcion && <p className="line-clamp-2 text-xs text-ink-500">{p.descripcion}</p>}
                    {p.sobre_pedido && <p className="text-[11px] font-semibold text-brand-600">Sobre pedido{p.dias_entrega ? ` · ~${p.dias_entrega} días` : ''}</p>}
                    <p className="text-sm font-bold text-brand-600">{dinero(p.precio)}</p>
                    {p.opciones.length > 0 && <p className="text-[11px] text-ink-500">{p.opciones.join(' · ')}</p>}
                    <span className="flex-1" />
                    <button
                      type="button"
                      disabled={agotado || !!guardadoEl}
                      onClick={() => {
                        setAviso(null);
                        setApartar(p);
                      }}
                      className="mt-2 h-10 rounded-xl bg-brand-500 text-sm font-bold text-white active:scale-95 disabled:bg-ink-100 disabled:text-ink-500"
                    >
                      {p.sobre_pedido ? 'Encargar' : agotado ? 'Agotado' : 'Apartar'}
                    </button>
                  </div>
                );
              })}
            </div>
            <p className="mt-3 text-center text-xs text-ink-500">Apártalo aquí y págalo al recogerlo en recepción.</p>
          </div>
        )}

        <p className="pt-2 text-center text-xs text-ink-500">Este enlace es solo tuyo · Compás</p>
      </div>
      {pase && <PaseCompleto qr={qr} nombre={datos.alumno.nombre} codigo={datos.alumno.codigo} foto={datos.alumno.foto ?? null} onCerrar={() => setPase(false)} />}
      {apartar && (
        <HojaApartar
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

/** Su foto en la credencial: si no tiene, se la pide (para que en recepción lo reconozcan). */
function SubirFoto({ token, foto, nombre, sinConexion, onListo }: { token: string; foto: string | null; nombre: string; sinConexion: boolean; onListo: () => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [estado, setEstado] = useState<'listo' | 'subiendo' | 'error'>('listo');
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
  return (
    <>
      <button
        type="button"
        disabled={sinConexion || estado === 'subiendo'}
        onClick={() => input.current?.click()}
        className="relative shrink-0 rounded-full"
        aria-label={foto ? 'Cambiar mi foto' : 'Poner mi foto'}
      >
        {foto ? (
          <img src={foto} alt={nombre} className="h-14 w-14 rounded-full object-cover" />
        ) : (
          <span className="flex h-14 w-14 flex-col items-center justify-center rounded-full bg-[color-mix(in_oklab,var(--marca)_12%,white)] text-[color-mix(in_oklab,var(--marca)_80%,black)] ring-2 ring-[color-mix(in_oklab,var(--marca)_40%,white)]">
            <Camera size={20} />
            <span className="text-[9px] font-bold">FOTO</span>
          </span>
        )}
        {estado === 'subiendo' && <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 text-[10px] font-bold text-white">…</span>}
      </button>
      <input ref={input} type="file" accept="image/*" capture="user" className="hidden" onChange={(e) => void subir(e.target.files?.[0])} />
      {estado === 'error' && <span className="text-xs font-semibold text-bad-600">No se pudo subir; inténtalo otra vez</span>}
    </>
  );
}

function saludo(d: Date): string {
  const h = d.getHours();
  return h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches';
}

function BotonWhats({ href, texto }: { href: string | null; texto: string }) {
  if (!href) return <p className="mt-2 text-sm text-ink-500">Pregunta en recepción.</p>;
  return (
    <a href={href} target="_blank" rel="noreferrer" className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#15803d] font-bold text-white active:scale-[0.98]">
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
      <a href={`/a/${slug}#horario`} className="flex items-center gap-3 rounded-3xl bg-superficie p-5 ring-1 ring-ink-100">
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
          <p className="text-xs font-bold tracking-wider text-ink-500 uppercase">Tu próxima clase</p>
          <p className="mt-1 text-2xl leading-tight font-extrabold">{prox.clase.clase}</p>
          <p className={cx('mt-1 flex items-center gap-2 font-semibold', prox.estado === 'ahora' ? 'text-ok-600' : 'text-ink-700')}>
            {prox.estado === 'ahora' && <span className="pp-pulso h-2.5 w-2.5 rounded-full bg-ok-600" aria-hidden="true" />}
            {prox.texto}
          </p>
          <p className="text-sm text-ink-500">
            {prox.clase.hora} – {horaFin(prox.clase.hora, prox.clase.duracion)}
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
      <p className="text-xs font-bold tracking-wider text-ink-500 uppercase">Tus logros</p>
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
      <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
        <div className="flex items-center gap-3">
          {foto && <img src={foto} alt="" className="h-14 w-14 rounded-full object-cover" />}
          <div className="text-left">
            <p className="text-xl font-extrabold">{nombre}</p>
            <p className="font-mono tracking-[0.3em] text-[#6b6778]">{codigo}</p>
          </div>
        </div>
        {qr && <img src={qr} alt="Tu código QR" className="aspect-square w-full max-w-[min(85vw,26rem)]" />}
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
