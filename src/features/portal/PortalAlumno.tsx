import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { CalendarCheck, Sun, WifiOff } from 'lucide-react';
import { supabase } from '../../sync/supabase';
import { LogoAcademia } from '../../components/LogoAcademia';
import { cx } from '../../components/ui';
import { contenidoQR } from '../../domain/qr';
import { dinero } from '../../domain/dinero';
import { diasEntre, fechaCorta, fechaLarga } from '../../domain/fechas';
import type { DatosPortal } from '../../domain/portal';

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
  }, [token]);

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
  return <Vista datos={estado.datos} guardadoEl={estado.guardadoEl} />;
}

function Centro({ titulo, children }: { titulo?: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-2 bg-ink-50 px-8 text-center">
      {titulo && <p className="text-lg font-bold">{titulo}</p>}
      <p className="text-ink-500">{children}</p>
    </div>
  );
}

function Vista({ datos, guardadoEl }: { datos: DatosPortal; guardadoEl: number | null }) {
  const [qr, setQr] = useState<string | null>(null);
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

        {/* Tienda */}
        {datos.tienda.length > 0 && (
          <div className="rounded-3xl bg-superficie p-5 ring-1 ring-ink-100">
            <p className="text-xs font-bold tracking-wider text-ink-500 uppercase">En la academia</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {datos.tienda.map((p, i) => (
                <div key={i} className="rounded-2xl bg-ink-50 p-3 text-center">
                  {p.foto ? <img src={p.foto} alt="" className="mx-auto h-20 w-20 rounded-xl object-cover" /> : <span className="block text-4xl leading-tight">{p.emoji}</span>}
                  <p className="mt-1 line-clamp-2 text-sm font-semibold">{p.nombre}</p>
                  <p className="text-sm font-bold text-brand-600">{dinero(p.precio)}</p>
                </div>
              ))}
            </div>
            <p className="mt-3 text-center text-xs text-ink-500">Pídelo en recepción.</p>
          </div>
        )}

        <p className="pt-2 text-center text-xs text-ink-300">Este enlace es solo tuyo · Compás</p>
      </div>
    </div>
  );
}
