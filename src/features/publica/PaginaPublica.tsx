import { useEffect, useMemo, useRef, useState } from 'react';
import { AtSign, CalendarDays, Check, ChevronDown, MapPin, MapPinned, MessageCircle, Navigation, PartyPopper, ShoppingBag, Sparkle } from 'lucide-react';
import { supabase } from '../../sync/supabase';
import { LogoAcademia } from '../../components/LogoAcademia';
import { cx } from '../../components/ui';
import { dinero } from '../../domain/dinero';
import { DIAS_CORTOS, fechaLarga, hoy } from '../../domain/fechas';
import { estadoCurso } from '../../domain/cursos';
import { ERRORES_INSCRIPCION, comoLlegar, mapaEmbed, urlRed, type DatosPublica } from '../../domain/publica';

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
    if (datos && typeof datos === 'object') document.title = `${datos.academia.nombre} · ${datos.pagina?.frase || 'Clases de baile'}`;
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
  const p = d.pagina ?? {};
  // la oferta de la primera clase: la que escribió la academia o el precio de la clase suelta
  const sueltaGeneral = d.planes.find((x) => x.tipo === 'suelta' && !x.sede_id) ?? d.planes.find((x) => x.tipo === 'suelta');
  const primera = p.primera || (sueltaGeneral ? `Clase de prueba: ${dinero(sueltaGeneral.precio)}` : null);
  const lugares = sedes.flatMap((s) => {
    const u = p.ubicaciones?.[s.id ?? 'principal'];
    return u?.direccion ? [{ ...u, nombre: s.nombre }] : [];
  });
  const redes = (['instagram', 'facebook', 'tiktok'] as const).flatMap((r) => {
    const url = urlRed(r, p.redes?.[r]);
    return url ? [{ red: r, url }] : [];
  });
  // clases por curso: quién acepta nuevos ahora y cuáles abren grupo pronto
  const dia = hoy();
  const estados = new Map(d.clases.map((c) => [c.id, estadoCurso(c.curso, dia)]));
  const nuevos = clasesSede.flatMap((c) => {
    const e = estados.get(c.id)!;
    return e.tipo === 'pronto' || e.tipo === 'iniciando' ? [{ c, e }] : [];
  });
  // botón fijo "Inscríbete" cuando ya no se ve el de la portada ni el formulario
  const hero = useRef<HTMLDivElement>(null);
  const form = useRef<HTMLDivElement>(null);
  const [verBarra, setVerBarra] = useState(false);
  useEffect(() => {
    const vistos = new Map<Element, boolean>();
    const io = new IntersectionObserver((es) => {
      for (const e of es) vistos.set(e.target, e.isIntersecting);
      setVerBarra(![...vistos.values()].some(Boolean));
      // lo de abajo de la pantalla no cuenta: un formulario que apenas asoma no esconde el botón
    }, { rootMargin: '0px 0px -25% 0px' });
    if (hero.current) io.observe(hero.current);
    if (form.current) io.observe(form.current);
    return () => io.disconnect();
  }, []);

  return (
    <div className="min-h-dvh bg-ink-50 pb-28">
      <Portada d={d} wa={wa} primera={primera} heroRef={hero} />

      <main className="relative mx-auto -mt-8 max-w-2xl space-y-4 px-4">
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
          {nuevos.length > 0 && (
            <div className="mt-3 space-y-1 rounded-2xl bg-ok-50 p-3 ring-1 ring-ok-600/20">
              {nuevos.map(({ c, e }) => (
                <p key={c.id} className="flex items-start gap-2 text-sm font-semibold text-ok-600">
                  <Sparkle size={16} className="mt-0.5 shrink-0" />
                  <span>
                    {c.clase}: {e.texto?.replace('Nuevo grupo: ', '')}
                  </span>
                </p>
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
                          <span className="min-w-0 flex-1">
                            <span className="block font-semibold">{c.clase}</span>
                            {estados.get(c.id)?.texto && (
                              <span className={cx('block text-xs font-semibold', estados.get(c.id)!.aceptaNuevos ? 'text-ok-600' : 'text-ink-500')}>{estados.get(c.id)!.texto}</span>
                            )}
                          </span>
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

        {/* Dónde estamos */}
        {lugares.length > 0 && (
          <section className="rounded-3xl bg-superficie p-5 ring-1 ring-ink-100">
            <h2 className="flex items-center gap-2 text-lg font-extrabold">
              <MapPinned size={20} className="text-brand-600" /> Dónde estamos
            </h2>
            <div className="mt-3 space-y-5">
              {lugares.map((l) => (
                <div key={l.nombre}>
                  {lugares.length > 1 && <p className="font-bold">{l.nombre}</p>}
                  <p className="text-ink-700">{l.direccion}</p>
                  {l.referencias && <p className="text-sm text-ink-500">{l.referencias}</p>}
                  <iframe
                    title={`Mapa de ${l.nombre}`}
                    src={mapaEmbed(l.direccion)}
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    className="mt-3 aspect-[16/10] w-full rounded-2xl bg-ink-100 ring-1 ring-ink-100"
                  />
                  <a href={comoLlegar(l.direccion)} target="_blank" rel="noreferrer" className="mt-2 flex h-12 items-center justify-center gap-2 rounded-2xl bg-ink-900 font-bold text-white active:scale-[0.98]">
                    <Navigation size={18} /> Cómo llegar
                  </a>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Preguntas frecuentes */}
        {(p.preguntas?.length ?? 0) > 0 && (
          <section className="rounded-3xl bg-superficie p-5 ring-1 ring-ink-100">
            <h2 className="text-lg font-extrabold">Preguntas frecuentes</h2>
            <div className="mt-2 divide-y divide-ink-100">
              {p.preguntas!.map((x, i) => (
                <details key={i} className="group py-1">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 py-3 font-semibold [&::-webkit-details-marker]:hidden">
                    {x.p}
                    <ChevronDown size={18} className="shrink-0 text-ink-500 transition group-open:rotate-180" />
                  </summary>
                  <p className="pb-3 text-ink-700">{x.r}</p>
                </details>
              ))}
            </div>
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

        <div ref={form} id="inscribete" className="scroll-mt-4">
          <Inscripcion d={d} slug={slug} clases={clasesSede.length ? clasesSede : d.clases} primera={primera} estados={estados} />
        </div>

        {wa && (
          <a href={wa} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 rounded-2xl bg-[#25d366] py-4 font-bold text-white">
            <MessageCircle size={20} /> Escríbenos por WhatsApp
          </a>
        )}
        {redes.length > 0 && (
          <div className="flex flex-wrap justify-center gap-2 pt-2">
            {redes.map((r) => (
              <a key={r.red} href={r.url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 rounded-full bg-superficie px-4 py-2 text-sm font-semibold ring-1 ring-ink-100 active:bg-ink-100">
                <AtSign size={15} className="text-brand-600" /> {{ instagram: 'Instagram', facebook: 'Facebook', tiktok: 'TikTok' }[r.red]}
              </a>
            ))}
          </div>
        )}
        <p className="pt-2 text-center text-xs text-ink-300">
          © {new Date().getFullYear()} {d.academia.nombre} · Hecho con Compás
        </p>
      </main>

      {/* botón fijo para inscribirse (sobre todo en el celular) */}
      <div
        className={cx(
          'fixed inset-x-0 bottom-0 z-30 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] transition duration-300',
          verBarra ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-full opacity-0',
        )}
        aria-hidden={!verBarra}
      >
        <div className="mx-auto flex max-w-2xl gap-2">
          <a href="#inscribete" tabIndex={verBarra ? 0 : -1} className="flex h-14 flex-1 items-center justify-center rounded-2xl bg-brand-500 text-lg font-bold text-white shadow-xl shadow-brand-500/30 active:scale-[0.98]">
            Quiero mi primera clase
          </a>
          {wa && (
            <a href={wa} target="_blank" rel="noreferrer" tabIndex={verBarra ? 0 : -1} className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#25d366] text-white shadow-xl" aria-label="Escríbenos por WhatsApp">
              <MessageCircle size={24} />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

function Inscripcion({ d, slug, clases, primera, estados }: { d: DatosPublica; slug: string; clases: DatosPublica['clases']; primera: string | null; estados: Map<string, ReturnType<typeof estadoCurso>> }) {
  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  const [claseId, setClaseId] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [estado, setEstado] = useState<'listo' | 'enviando' | 'enviado'>('listo');
  const [error, setError] = useState<string | null>(null);
  const tel = telefono.replace(/\D/g, '');
  const valido = nombre.trim().length >= 2 && tel.length === 10;
  // clase a medio curso: se anota igual, como lista de espera para el siguiente grupo
  const espera = claseId && estados.get(claseId)?.aceptaNuevos === false ? clases.find((c) => c.id === claseId) : null;
  const [esperaEnviada, setEsperaEnviada] = useState<string | null>(null);

  if (estado === 'enviado')
    return (
      <section className="rounded-3xl bg-ok-50 p-6 text-center ring-1 ring-ok-600/20" role="status">
        <span className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-ok-600 text-white">
          <Check size={26} />
        </span>
        <p className="text-lg font-extrabold">¡Listo, {nombre.trim().split(' ')[0]}!</p>
        <p className="text-sm text-ink-700">
          {esperaEnviada
            ? `Ese grupo ya va avanzado: te escribimos por WhatsApp en cuanto abra el siguiente grupo de ${esperaEnviada}. 💃🕺`
            : `Te escribimos por WhatsApp para darte los detalles. ¡Te esperamos en ${d.academia.nombre}! 💃🕺`}
        </p>
      </section>
    );

  return (
    <section className="rounded-3xl bg-superficie p-5 ring-1 ring-ink-100">
      <h2 className="text-lg font-extrabold">Agenda tu primera clase</h2>
      {primera && <p className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1 text-sm font-bold text-brand-600"><Sparkle size={14} /> {primera}</p>}
      <p className="mt-1 text-sm text-ink-500">Déjanos tus datos y te escribimos por WhatsApp para apartarte lugar.</p>
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
          setEsperaEnviada(espera ? espera.clase : null);
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
                {estados.get(c.id)?.aceptaNuevos === false ? ' · próximo grupo' : estados.get(c.id)?.tipo === 'pronto' ? ' · grupo nuevo' : ''}
              </option>
            ))}
          </select>
        </label>
        {espera && (
          <p className="rounded-xl bg-warn-50 px-3 py-2 text-sm font-medium text-warn-600">
            {espera.clase} ya va a medio curso. Déjanos tus datos y te avisamos cuando abra el siguiente grupo.
          </p>
        )}
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-ink-700">Algo que quieras decirnos (opcional)</span>
          <input value={mensaje} onChange={(e) => setMensaje(e.target.value)} maxLength={300} placeholder="Ej. nunca he bailado, voy en pareja…" className="h-12 w-full rounded-xl bg-ink-50 px-4 ring-1 ring-ink-100 outline-none placeholder:text-ink-300 focus:ring-2 focus:ring-brand-500" />
        </label>
        {error && <p className="rounded-xl bg-bad-50 px-3 py-2 text-sm font-medium text-bad-600">{error}</p>}
        <button type="submit" disabled={!valido || estado === 'enviando'} className="h-14 w-full rounded-2xl bg-brand-500 text-lg font-bold text-white active:scale-[0.98] disabled:opacity-50">
          {estado === 'enviando' ? 'Enviando…' : espera ? 'Avísenme del siguiente grupo' : 'Quiero inscribirme'}
        </button>
        <p className="text-center text-xs text-ink-500">Solo usamos tu número para escribirte sobre las clases.</p>
      </form>
    </section>
  );
}

/** Portada: foto (o el color de la academia), frase, la oferta de la primera clase y los dos botones. */
function Portada({ d, wa, primera, heroRef }: { d: DatosPublica; wa: string | null; primera: string | null; heroRef: React.RefObject<HTMLDivElement | null> }) {
  const p = d.pagina ?? {};
  const foto = p.portada;
  return (
    <header className={cx('relative overflow-hidden text-white', foto ? 'bg-panel' : 'bg-brand-500')}>
      {foto ? (
        <>
          <img src={foto} alt="" className="absolute inset-0 h-full w-full object-cover" fetchPriority="high" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/45 to-black/25" />
        </>
      ) : (
        <svg className="pointer-events-none absolute -top-16 -right-16 h-72 w-72 opacity-15" viewBox="0 0 64 64" aria-hidden="true">
          <circle cx="32" cy="32" r="17" fill="none" stroke="#fff" strokeWidth="3" strokeDasharray="70 37" strokeLinecap="round" transform="rotate(-30 32 32)" />
          <circle cx="32" cy="32" r="27" fill="none" stroke="#fff" strokeWidth="1.5" strokeDasharray="4 6" />
        </svg>
      )}
      <div className={cx('relative mx-auto flex max-w-2xl flex-col px-5 pt-5 pb-14', foto && 'min-h-[72svh]')}>
        <div className="flex items-center gap-3">
          <span className="rounded-xl bg-white p-1.5">
            <LogoAcademia academia={{ nombre: d.academia.nombre, logo: d.academia.logo }} tam={36} />
          </span>
          <span className="truncate text-lg font-extrabold tracking-tight">{d.academia.nombre}</span>
        </div>
        <div className={cx('flex flex-col', foto ? 'mt-auto pt-24' : 'pt-10')}>
          <h1 className="text-4xl leading-[1.05] font-extrabold tracking-tight text-balance sm:text-5xl">{p.frase || 'Clases de baile'}</h1>
          {p.intro && <p className="mt-3 max-w-xl text-lg text-white/90">{p.intro}</p>}
          {primera && (
            <p className="mt-4 inline-flex w-fit items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-sm font-bold ring-1 ring-white/30 backdrop-blur">
              <Sparkle size={14} /> {primera}
            </p>
          )}
          <div ref={heroRef} className="mt-5 flex flex-wrap gap-2">
            <a href="#inscribete" className="flex h-14 items-center justify-center rounded-2xl bg-white px-6 text-lg font-bold text-ink-900 shadow-lg active:scale-[0.98]">
              Tu primera clase
            </a>
            {wa && (
              <a href={wa} target="_blank" rel="noreferrer" className="flex h-14 items-center justify-center gap-2 rounded-2xl bg-[#25d366] px-5 font-bold text-white shadow-lg active:scale-[0.98]">
                <MessageCircle size={20} /> WhatsApp
              </a>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
