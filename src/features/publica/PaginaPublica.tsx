import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, Check, MapPin, MessageCircle, PartyPopper, ShoppingBag } from 'lucide-react';
import { supabase } from '../../sync/supabase';
import { LogoAcademia } from '../../components/LogoAcademia';
import { cx } from '../../components/ui';
import { dinero } from '../../domain/dinero';
import { DIAS_CORTOS, fechaLarga } from '../../domain/fechas';
import { ERRORES_INSCRIPCION, type DatosPublica } from '../../domain/publica';

const DIAS_LARGOS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const horaFin = (h: string, min: number) => {
  const t = Number(h.slice(0, 2)) * 60 + Number(h.slice(3)) + min;
  return `${String(Math.floor(t / 60) % 24).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
};

/**
 * Página pública del estudio: horarios por sede, precios, eventos, tienda y formulario de inscripción.
 * Pensada para compartirse en Facebook/WhatsApp; no muestra maestros ni datos de alumnos.
 */
export function PaginaPublica({ slug }: { slug: string }) {
  const [datos, setDatos] = useState<DatosPublica | null | 'no' | 'error'>(null);
  useEffect(() => {
    (async () => {
      if (!supabase) return setDatos('error');
      const { data, error } = await supabase.rpc('pagina_publica', { p_slug: slug });
      if (error) return setDatos('error');
      setDatos(data ? (data as DatosPublica) : 'no');
    })();
  }, [slug]);
  const color = datos && typeof datos === 'object' ? datos.academia.color : null;
  useEffect(() => {
    if (color) document.documentElement.style.setProperty('--marca', color);
    if (datos && typeof datos === 'object') document.title = `${datos.academia.nombre} · Clases y horarios`;
  }, [color, datos]);

  if (datos === null) return <Centro>Cargando…</Centro>;
  if (datos === 'no') return <Centro titulo="Página no encontrada">Revisa el enlace.</Centro>;
  if (datos === 'error') return <Centro titulo="No se pudo cargar">Revisa tu conexión e inténtalo de nuevo.</Centro>;
  return <Vista d={datos} slug={slug} />;
}

function Centro({ titulo, children }: { titulo?: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-2 bg-ink-50 px-8 text-center">
      {titulo && <p className="text-lg font-bold">{titulo}</p>}
      <p className="text-ink-500">{children}</p>
    </div>
  );
}

function Vista({ d, slug }: { d: DatosPublica; slug: string }) {
  const sedes = useMemo(() => [{ id: null as string | null, nombre: d.academia.sede_principal, color: d.academia.color ?? '#d6304a' }, ...d.sedes], [d]);
  const [sede, setSede] = useState<string | null>(null);
  const clasesSede = d.clases.filter((c) => (c.sede_id ?? null) === sede);
  const conSedes = d.sedes.length > 0;
  const planesSede = d.planes.filter((p) => !p.sede_id || p.sede_id === (sede ?? '00000000-0000-4000-8000-000000000000') || (sede && p.sede_id === sede));
  const suelta = planesSede.find((p) => p.tipo === 'suelta' && p.sede_id) ?? planesSede.find((p) => p.tipo === 'suelta');
  const wa = d.academia.whatsapp ? `https://wa.me/52${d.academia.whatsapp}?text=${encodeURIComponent(`Hola, vi la página de ${d.academia.nombre} y quiero información.`)}` : null;

  return (
    <div className="min-h-dvh bg-ink-50 pb-16">
      <header className="bg-brand-500 px-5 pt-8 pb-20 text-white">
        <div className="mx-auto flex max-w-2xl items-center gap-4">
          <span className="rounded-2xl bg-white p-2">
            <LogoAcademia academia={{ nombre: d.academia.nombre, logo: d.academia.logo }} tam={56} />
          </span>
          <span className="min-w-0">
            <h1 className="text-2xl font-extrabold tracking-tight">{d.academia.nombre}</h1>
            <p className="text-white/85">Clases de baile · horarios y precios</p>
          </span>
        </div>
      </header>

      <main className="mx-auto -mt-14 max-w-2xl space-y-4 px-4">
        {/* Horarios */}
        <section className="rounded-3xl bg-superficie p-5 shadow-xl shadow-black/5 ring-1 ring-ink-100">
          <h2 className="flex items-center gap-2 text-lg font-extrabold">
            <CalendarDays size={20} className="text-brand-600" /> Horarios
          </h2>
          {conSedes && (
            <div className="mt-3 flex flex-wrap gap-2" role="tablist" aria-label="Sede">
              {sedes.map((s) => (
                <button
                  key={s.id ?? 'principal'}
                  role="tab"
                  aria-selected={sede === s.id}
                  onClick={() => setSede(s.id)}
                  className={cx('flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold ring-1', sede === s.id ? 'bg-brand-500 text-white ring-brand-500' : 'bg-superficie ring-ink-100')}
                >
                  <MapPin size={14} /> {s.nombre}
                </button>
              ))}
            </div>
          )}
          {clasesSede.length === 0 ? (
            <p className="mt-3 text-sm text-ink-500">Pronto publicaremos horarios aquí.</p>
          ) : (
            <div className="mt-3 space-y-3">
              {[1, 2, 3, 4, 5, 6, 0]
                .map((dia) => ({ dia, clases: clasesSede.filter((c) => c.dias.includes(dia)).sort((a, b) => a.hora.localeCompare(b.hora)) }))
                .filter((x) => x.clases.length)
                .map(({ dia, clases }) => (
                  <div key={dia}>
                    <p className="mb-1 text-xs font-bold tracking-wider text-ink-500 uppercase">{DIAS_LARGOS[dia]}</p>
                    <ul className="space-y-1">
                      {clases.map((c) => (
                        <li key={c.id} className="flex items-center gap-3 rounded-xl bg-ink-50 px-3 py-2">
                          <span className="h-8 w-1 shrink-0 rounded-full" style={{ background: c.color ?? 'var(--marca)' }} />
                          <span className="flex-1 font-semibold">{c.clase}</span>
                          <span className="text-sm text-ink-500 tabular-nums">
                            {c.hora}–{horaFin(c.hora, c.duracion)}
                          </span>
                          {c.precio ? <span className="text-sm font-bold">{dinero(c.precio)}</span> : null}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
            </div>
          )}
        </section>

        {/* Precios */}
        {planesSede.length > 0 && (
          <section className="rounded-3xl bg-superficie p-5 ring-1 ring-ink-100">
            <h2 className="text-lg font-extrabold">Precios{conSedes ? ` · ${sedes.find((s) => s.id === sede)?.nombre}` : ''}</h2>
            <ul className="mt-3 divide-y divide-ink-100">
              {suelta && (
                <li className="flex items-baseline justify-between py-2">
                  <span>Clase suelta</span>
                  <span className="font-bold">{dinero(suelta.precio)}</span>
                </li>
              )}
              {planesSede
                .filter((p) => p.tipo !== 'suelta')
                .map((p, i) => (
                  <li key={i} className="flex items-baseline justify-between gap-3 py-2">
                    <span>
                      {p.nombre}
                      <span className="block text-xs text-ink-500">
                        {p.tipo === 'mensual' ? (p.grupos ? `${p.grupos === 1 ? 'Una clase' : `${p.grupos} clases`} durante un mes` : 'Clases ilimitadas durante un mes') : `${p.clases} clases · vigencia ${p.vigencia} días`}
                      </span>
                    </span>
                    <span className="font-bold">{dinero(p.precio)}</span>
                  </li>
                ))}
            </ul>
          </section>
        )}

        {/* Eventos */}
        {d.eventos.length > 0 && (
          <section className="rounded-3xl bg-superficie p-5 ring-1 ring-ink-100">
            <h2 className="flex items-center gap-2 text-lg font-extrabold">
              <PartyPopper size={20} className="text-brand-600" /> Próximos eventos
            </h2>
            <ul className="mt-3 space-y-2">
              {d.eventos.map((e, i) => (
                <li key={i} className="rounded-2xl bg-ink-50 p-3">
                  <p className="font-bold">{e.nombre}</p>
                  <p className="text-sm text-ink-500 first-letter:uppercase">
                    {fechaLarga(e.fecha)} · {e.hora} · boleto {dinero(e.precio)}
                  </p>
                  {e.descripcion && <p className="mt-1 text-sm">{e.descripcion}</p>}
                  {e.quedan !== null && <p className={cx('mt-1 text-sm font-semibold', e.quedan === 0 ? 'text-bad-600' : 'text-brand-600')}>{e.quedan === 0 ? 'Agotado' : `Quedan ${e.quedan} lugares`}</p>}
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Tienda */}
        {d.tienda.length > 0 && (
          <section className="rounded-3xl bg-superficie p-5 ring-1 ring-ink-100">
            <h2 className="flex items-center gap-2 text-lg font-extrabold">
              <ShoppingBag size={20} className="text-brand-600" /> Tienda
            </h2>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {d.tienda.map((p, i) => (
                <div key={i} className="rounded-2xl bg-ink-50 p-3 text-center">
                  {p.foto ? <img src={p.foto} alt="" className="mx-auto h-20 w-20 rounded-xl object-cover" /> : <span className="block text-4xl leading-tight">{p.emoji}</span>}
                  <p className="mt-1 text-sm font-semibold">{p.nombre}</p>
                  <p className="text-sm font-bold text-brand-600">{dinero(p.precio)}</p>
                  {p.sobre_pedido && <p className="text-[11px] text-ink-500">Sobre pedido</p>}
                </div>
              ))}
            </div>
            <p className="mt-3 text-center text-xs text-ink-500">Pídelo en recepción o por WhatsApp.</p>
          </section>
        )}

        <Inscripcion d={d} slug={slug} clases={clasesSede.length ? clasesSede : d.clases} />

        {wa && (
          <a href={wa} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 rounded-2xl bg-[#25d366] py-4 font-bold text-white">
            <MessageCircle size={20} /> Escríbenos por WhatsApp
          </a>
        )}
        <p className="pt-2 text-center text-xs text-ink-300">Compás</p>
      </main>
    </div>
  );
}

function Inscripcion({ d, slug, clases }: { d: DatosPublica; slug: string; clases: DatosPublica['clases'] }) {
  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  const [claseId, setClaseId] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [estado, setEstado] = useState<'listo' | 'enviando' | 'enviado'>('listo');
  const [error, setError] = useState<string | null>(null);
  const tel = telefono.replace(/\D/g, '');
  const valido = nombre.trim().length >= 2 && tel.length === 10;

  if (estado === 'enviado')
    return (
      <section className="rounded-3xl bg-ok-50 p-6 text-center ring-1 ring-ok-600/20" role="status">
        <span className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-ok-600 text-white">
          <Check size={26} />
        </span>
        <p className="text-lg font-extrabold">¡Listo, {nombre.trim().split(' ')[0]}!</p>
        <p className="text-sm text-ink-700">Te escribimos por WhatsApp para darte los detalles. ¡Te esperamos en {d.academia.nombre}! 💃🕺</p>
      </section>
    );

  return (
    <section className="rounded-3xl bg-superficie p-5 ring-1 ring-ink-100">
      <h2 className="text-lg font-extrabold">¿Quieres tomar clases?</h2>
      <p className="text-sm text-ink-500">Déjanos tus datos y te escribimos por WhatsApp. Te avisamos cuando abra un grupo nuevo.</p>
      <form
        className="mt-4 space-y-3"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!supabase || !valido) return;
          setEstado('enviando');
          setError(null);
          const { data, error: err } = await supabase.rpc('inscribir_interesado', { p_slug: slug, p_nombre: nombre.trim(), p_telefono: tel, p_clase: claseId || null, p_mensaje: mensaje.trim() });
          if (err || data?.error) {
            setError(err ? 'Sin conexión. Inténtalo otra vez.' : (ERRORES_INSCRIPCION[data.error] ?? 'No se pudo enviar.'));
            setEstado('listo');
            return;
          }
          setEstado('enviado');
        }}
      >
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-ink-700">Nombre</span>
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} autoComplete="name" className="h-12 w-full rounded-xl bg-ink-50 px-4 ring-1 ring-ink-100 outline-none focus:ring-2 focus:ring-brand-500" />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-ink-700">WhatsApp (10 dígitos)</span>
          <input value={telefono} onChange={(e) => setTelefono(e.target.value)} inputMode="tel" autoComplete="tel" className="h-12 w-full rounded-xl bg-ink-50 px-4 ring-1 ring-ink-100 outline-none focus:ring-2 focus:ring-brand-500" />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-ink-700">¿Qué clase te interesa?</span>
          <select value={claseId} onChange={(e) => setClaseId(e.target.value)} className="h-12 w-full rounded-xl bg-ink-50 px-3 ring-1 ring-ink-100 outline-none focus:ring-2 focus:ring-brand-500">
            <option value="">Todavía no sé / cualquiera</option>
            {clases.map((c) => (
              <option key={c.id} value={c.id}>
                {c.clase} · {c.dias.map((x) => DIAS_CORTOS[x]).join(' ')} {c.hora}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-ink-700">Algo que quieras decirnos (opcional)</span>
          <input value={mensaje} onChange={(e) => setMensaje(e.target.value)} maxLength={300} placeholder="Ej. nunca he bailado, voy en pareja…" className="h-12 w-full rounded-xl bg-ink-50 px-4 ring-1 ring-ink-100 outline-none placeholder:text-ink-300 focus:ring-2 focus:ring-brand-500" />
        </label>
        {error && <p className="rounded-xl bg-bad-50 px-3 py-2 text-sm font-medium text-bad-600">{error}</p>}
        <button type="submit" disabled={!valido || estado === 'enviando'} className="h-14 w-full rounded-2xl bg-brand-500 text-lg font-bold text-white active:scale-[0.98] disabled:opacity-50">
          {estado === 'enviando' ? 'Enviando…' : 'Quiero inscribirme'}
        </button>
        <p className="text-center text-xs text-ink-500">Solo usamos tu número para escribirte sobre las clases.</p>
      </form>
    </section>
  );
}
