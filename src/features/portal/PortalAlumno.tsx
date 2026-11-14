import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { CalendarCheck, PackageCheck, Sun, WifiOff, X } from 'lucide-react';
import { supabase } from '../../sync/supabase';
import { LogoAcademia } from '../../components/LogoAcademia';
import { cx } from '../../components/ui';
import { contenidoQR } from '../../domain/qr';
import { dinero } from '../../domain/dinero';
import { diasEntre, fechaCorta, fechaLarga } from '../../domain/fechas';
import { ERRORES_PEDIDO, type DatosPortal } from '../../domain/portal';

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
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const maximo = Math.max(1, Math.min(5, producto.disponibles ?? 5));
  const falta = producto.opciones.length > 0 && !opcion;

  const enviar = async () => {
    if (!supabase) return;
    setOcupado(true);
    setError(null);
    try {
      const { data, error: e } = await supabase.rpc('portal_pedir', { p_token: token, p_producto: producto.id, p_opcion: opcion, p_cantidad: cantidad });
      if (e) throw new Error('Sin conexión. Inténtalo otra vez.');
      if (data?.error) {
        setError(data.error === 'agotado' && typeof data.disponibles === 'number' && data.disponibles > 0 ? `Solo quedan ${data.disponibles}.` : (ERRORES_PEDIDO[data.error] ?? 'No se pudo apartar.'));
        return;
      }
      onListo(`¡Listo! Apartaste ${producto.nombre}${opcion ? ` (${opcion})` : ''}${cantidad > 1 ? ` ×${cantidad}` : ''}. Recógelo y págalo en recepción.`);
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
          <span className="text-4xl leading-none">{producto.emoji}</span>
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
        {error && <p className="mt-3 rounded-xl bg-bad-50 px-3 py-2 text-sm font-medium text-bad-600">{error}</p>}
        <button
          type="button"
          onClick={enviar}
          disabled={ocupado || falta}
          className="mt-4 h-14 w-full rounded-2xl bg-brand-500 text-lg font-bold text-white active:scale-[0.98] disabled:opacity-50"
        >
          {falta ? 'Elige talla o color' : `Apartar · pagas ${dinero(producto.precio * cantidad)} al recoger`}
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

  return (
    <div className="min-h-dvh bg-ink-50 pb-10">
      <div className="bg-brand-500 px-5 pt-6 pb-24 text-white">
        <div className="mx-auto flex max-w-md items-center gap-3">
          <span className="rounded-2xl bg-white p-1.5">
            <LogoAcademia academia={{ nombre: datos.academia.nombre, logo: datos.academia.logo }} tam={36} />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-lg font-extrabold">{datos.academia.nombre}</span>
            <span className="block text-sm text-white/80">Hola, {nombre1} 👋</span>
          </span>
        </div>
      </div>

      <div className="mx-auto -mt-20 max-w-md space-y-3 px-4">
        {guardadoEl && (
          <p className="flex items-center gap-2 rounded-2xl bg-warn-50 px-4 py-2.5 text-sm font-medium text-warn-600">
            <WifiOff size={16} className="shrink-0" /> Sin conexión: datos del {fechaCorta(new Date(guardadoEl).toISOString().slice(0, 10))}. Tu QR sí sirve.
          </p>
        )}

        {/* Credencial */}
        <div className="rounded-3xl bg-white p-5 text-center text-[#16141c] shadow-xl shadow-black/10">
          <p className="text-xs font-bold tracking-wider text-[#6e6a7c] uppercase">Tu pase de entrada</p>
          <div className="mx-auto mt-3 aspect-square w-full max-w-[17rem]">{qr ? <img src={qr} alt="Tu código QR" className="h-full w-full" /> : <div className="h-full w-full animate-pulse rounded-2xl bg-[#ecebf0]" />}</div>
          <p className="mt-3 text-xl font-extrabold">{datos.alumno.nombre}</p>
          <p className="font-mono text-sm tracking-[0.3em] text-[#6e6a7c]">{datos.alumno.codigo}</p>
          <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-[#6e6a7c]">
            <Sun size={14} /> Sube el brillo y muéstralo en recepción
          </p>
        </div>

        {/* Plan */}
        <div className="rounded-3xl bg-superficie p-5 ring-1 ring-ink-100">
          <p className="text-xs font-bold tracking-wider text-ink-500 uppercase">Tu plan</p>
          {vigentes.length === 0 ? (
            <div className="mt-2">
              <p className="text-lg font-bold">{vencido ? `Tu ${vencido.plan.toLowerCase()} terminó` : 'Pagas por clase'}</p>
              <p className="text-sm text-ink-500">{vencido ? 'Renuévalo en recepción para seguir bailando.' : 'Pregunta en recepción por las mensualidades y paquetes.'}</p>
            </div>
          ) : (
            vigentes.map((p, i) => {
              const dias = diasEntre(hoy, p.fin);
              const quedan = p.clases !== null ? p.clases - p.usadas : null;
              return (
                <div key={i} className={cx('mt-2', i > 0 && 'border-t border-ink-100 pt-3')}>
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="text-lg font-bold">{p.plan}</p>
                    <span className={cx('rounded-full px-2.5 py-0.5 text-xs font-bold', dias <= 3 || (quedan !== null && quedan <= 1) ? 'bg-warn-50 text-warn-600' : 'bg-ok-50 text-ok-600')}>
                      {p.beca ? 'Beca' : 'Vigente'}
                    </span>
                  </div>
                  {quedan !== null && (
                    <>
                      <p className="mt-1 text-sm">
                        Te quedan <b>{quedan}</b> de {p.clases} clases
                      </p>
                      <div className="mt-1.5 h-2 rounded-full bg-ink-100">
                        <div className="h-full rounded-full bg-brand-500" style={{ width: `${(quedan / (p.clases || 1)) * 100}%` }} />
                      </div>
                    </>
                  )}
                  <p className="mt-1.5 text-sm text-ink-500">{dias === 0 ? 'Vence hoy' : dias === 1 ? 'Vence mañana' : `Vigente hasta el ${fechaLarga(p.fin)}`}</p>
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
            <p className="text-xs font-bold tracking-wider text-ink-500 uppercase">Tus apartados</p>
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
                    <span className="block text-xs text-ink-500">{p.estado === 'pendiente' ? `Recógelo y págalo en recepción · ${dinero(p.precio * p.cantidad)}` : 'Entregado'}</span>
                  </span>
                  {p.estado === 'pendiente' ? (
                    <span className="rounded-full bg-warn-50 px-2.5 py-0.5 text-xs font-bold text-warn-600">Apartado</span>
                  ) : (
                    <span className="rounded-full bg-ok-50 px-2.5 py-0.5 text-xs font-bold text-ok-600">✓</span>
                  )}
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
                const agotado = p.disponibles !== null && p.disponibles <= 0;
                return (
                  <div key={p.id} className="flex flex-col rounded-2xl bg-ink-50 p-3 text-center">
                    {p.foto ? <img src={p.foto} alt="" className="mx-auto h-20 w-20 rounded-xl object-cover" /> : <span className="block text-4xl leading-tight">{p.emoji}</span>}
                    <p className="mt-1 line-clamp-2 text-sm font-semibold">{p.nombre}</p>
                    {p.descripcion && <p className="line-clamp-2 text-xs text-ink-500">{p.descripcion}</p>}
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
                      {agotado ? 'Agotado' : 'Apartar'}
                    </button>
                  </div>
                );
              })}
            </div>
            <p className="mt-3 text-center text-xs text-ink-500">Apártalo aquí y págalo al recogerlo en recepción.</p>
          </div>
        )}

        <p className="pt-2 text-center text-xs text-ink-300">Este enlace es solo tuyo · Compás</p>
      </div>
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
