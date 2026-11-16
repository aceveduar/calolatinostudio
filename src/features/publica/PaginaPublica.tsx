import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ArrowRight, AtSign, Check, ChevronDown, MapPin, MessageCircle, Navigation, ShoppingBag, Sparkle, Users } from 'lucide-react';
import { supabase } from '../../sync/supabase';
import { LogoAcademia } from '../../components/LogoAcademia';
import { cx } from '../../components/ui';
import { dinero } from '../../domain/dinero';
import { DIAS_CORTOS, hoy } from '../../domain/fechas';
import { estadoCurso } from '../../domain/cursos';
import { PRINCIPAL } from '../../domain/sedes';
import { ERRORES_INSCRIPCION, comoLlegar, mapaEmbed, urlRed, type DatosPublica } from '../../domain/publica';

const DIAS_LARGOS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const SEMANA = [1, 2, 3, 4, 5, 6, 0];
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const horaFin = (h: string, min: number) => {
  const t = Number(h.slice(0, 2)) * 60 + Number(h.slice(3)) + min;
  return `${String(Math.floor(t / 60) % 24).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
};
/** La disciplina de una clase (la manda la base; si es una base vieja, la primera palabra del nombre). */
const disciplinaDe = (c: { clase: string; disciplina?: string | null }) => c.disciplina || c.clase.split(' ')[0];
const diasTexto = (dias: number[]) => SEMANA.filter((x) => dias.includes(x)).map((x) => DIAS_CORTOS[x]).join(' · ');
const DESDE_CERO = /\b(0|b[aá]sico|principiantes?|inicial|desde cero)\b/i;
type Estados = Map<string, ReturnType<typeof estadoCurso>>;

/**
 * Página pública del estudio (la página oficial): portada, disciplinas, horarios por sede, precios,
 * ubicación, eventos, tienda, preguntas e inscripción. No muestra maestros ni datos de alumnos.
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

function Centro({ titulo, children }: { titulo?: string; children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-2 bg-ink-50 px-8 text-center">
      {titulo && <p className="text-lg font-bold">{titulo}</p>}
      <p className="text-ink-500">{children}</p>
    </div>
  );
}

function Vista({ d, slug }: { d: DatosPublica; slug: string }) {
  const p = d.pagina ?? {};
  const sedes = useMemo(() => [{ id: null as string | null, nombre: d.academia.sede_principal, color: d.academia.color ?? '#d6304a' }, ...d.sedes], [d]);
  const conSedes = d.sedes.length > 0;
  const [sede, setSede] = useState<string | null>(null);
  const [disciplina, setDisciplina] = useState<string | null>(null);
  const clasesSede = d.clases.filter((c) => (c.sede_id ?? null) === sede);
  const clasesVista = clasesSede.filter((c) => !disciplina || disciplinaDe(c) === disciplina);
  // los planes "solo de la sede principal" llevan un id fijo (no hay registro de la sede principal)
  const planesSede = d.planes.filter((x) => !x.sede_id || x.sede_id === (sede ?? PRINCIPAL));
  const suelta = planesSede.find((x) => x.tipo === 'suelta' && x.sede_id) ?? planesSede.find((x) => x.tipo === 'suelta');
  const wa = d.academia.whatsapp ? `https://wa.me/52${d.academia.whatsapp}?text=${encodeURIComponent(`Hola, vi la página de ${d.academia.nombre} y quiero información.`)}` : null;

  // la oferta de la primera clase: la que escribió la academia o el precio de la clase suelta
  const esPrincipal = (x: { sede_id: string | null }) => !x.sede_id || x.sede_id === PRINCIPAL;
  const sueltaGeneral =
    d.planes.find((x) => x.tipo === 'suelta' && x.sede_id === PRINCIPAL) ?? d.planes.find((x) => x.tipo === 'suelta' && esPrincipal(x)) ?? d.planes.find((x) => x.tipo === 'suelta');
  const primera = p.primera || (sueltaGeneral ? `Clase de prueba: ${dinero(sueltaGeneral.precio)}` : null);
  const lugares = sedes.flatMap((s) => {
    const u = p.ubicaciones?.[s.id ?? 'principal'];
    return u?.direccion ? [{ ...u, nombre: s.nombre }] : [];
  });
  const redes = (['instagram', 'facebook', 'tiktok'] as const).flatMap((r) => {
    const url = urlRed(r, p.redes?.[r]);
    return url ? [{ red: r, url }] : [];
  });

  // disciplinas (Salsa, Bachata…) con su color, niveles y días: las tarjetas de "¿Qué quieres bailar?"
  const disciplinas = useMemo(() => {
    const m = new Map<string, { nombre: string; color: string; niveles: string[]; dias: Set<number>; veces: number }>();
    for (const c of d.clases) {
      const n = disciplinaDe(c);
      const v = m.get(n) ?? { nombre: n, color: c.color ?? 'var(--marca)', niveles: [], dias: new Set<number>(), veces: 0 };
      v.veces += c.dias.length;
      const nivel = c.clase.slice(n.length).trim();
      if (nivel && !v.niveles.includes(nivel)) v.niveles.push(nivel);
      c.dias.forEach((x) => v.dias.add(x));
      m.set(n, v);
    }
    // primero lo que más se da; niveles en orden (0, 1, 2… y luego los demás)
    return [...m.values()]
      .map((v) => ({ ...v, niveles: v.niveles.sort((a, b) => a.localeCompare(b, 'es', { numeric: true })) }))
      .sort((a, b) => b.veces - a.veces || a.nombre.localeCompare(b.nombre));
  }, [d.clases]);
  const clasesPorSemana = d.clases.reduce((s, c) => s + c.dias.length, 0);
  const desdeCero = d.clases.some((c) => DESDE_CERO.test(c.clase));

  // clases por curso: quién acepta nuevos ahora y cuáles abren grupo pronto
  const dia = hoy();
  const estados: Estados = new Map(d.clases.map((c) => [c.id, estadoCurso(c.curso, dia)]));
  const nuevos = clasesSede.flatMap((c) => {
    const e = estados.get(c.id)!;
    return e.tipo === 'pronto' || e.tipo === 'iniciando' ? [{ c, e }] : [];
  });

  // barra de arriba sólida al pasar la portada; botón fijo abajo cuando no se ve la portada ni el formulario
  const hero = useRef<HTMLDivElement>(null);
  const form = useRef<HTMLDivElement>(null);
  const portada = useRef<HTMLElement>(null);
  const [verBarra, setVerBarra] = useState(false);
  const [solida, setSolida] = useState(false);
  useEffect(() => {
    const vistos = new Map<Element, boolean>();
    const io = new IntersectionObserver(
      (es) => {
        for (const e of es) vistos.set(e.target, e.isIntersecting);
        setVerBarra(![...vistos.values()].some(Boolean));
        // lo de abajo de la pantalla no cuenta: un formulario que apenas asoma no esconde el botón
      },
      { rootMargin: '0px 0px -25% 0px' },
    );
    if (hero.current) io.observe(hero.current);
    if (form.current) io.observe(form.current);
    const io2 = new IntersectionObserver(([e]) => setSolida(!e.isIntersecting), { rootMargin: '-72px 0px 0px 0px', threshold: 0 });
    if (portada.current) io2.observe(portada.current);
    return () => {
      io.disconnect();
      io2.disconnect();
    };
  }, []);

  const verHorario = (n: string) => {
    setDisciplina(n);
    document.getElementById('horarios')?.scrollIntoView({ block: 'start' });
  };
  const enlaces = [
    { a: '#clases', t: 'Clases' },
    ...(planesSede.length ? [{ a: '#precios', t: 'Precios' }] : []),
    ...(lugares.length ? [{ a: '#ubicacion', t: 'Ubicación' }] : []),
    ...(p.preguntas?.length ? [{ a: '#preguntas', t: 'Preguntas' }] : []),
  ];

  return (
    <div className="pp min-h-dvh bg-ink-50 text-ink-900">
      {/* ---------- barra de arriba ---------- */}
      <nav
        className={cx(
          'fixed inset-x-0 top-0 z-40 pt-[env(safe-area-inset-top)] transition-colors duration-300',
          solida ? 'bg-superficie/90 text-ink-900 shadow-sm ring-1 ring-ink-100 backdrop-blur-md' : 'bg-transparent text-white',
        )}
        aria-label="Secciones"
      >
        <div className="mx-auto flex h-16 max-w-5xl items-center gap-3 px-5">
          <a href="#" className="flex min-w-0 items-center gap-2.5" aria-label={`${d.academia.nombre}, ir al inicio`}>
            <span className="rounded-xl bg-white p-1 shadow-sm">
              <LogoAcademia academia={{ nombre: d.academia.nombre, logo: d.academia.logo }} tam={30} />
            </span>
            <span className="truncate font-extrabold tracking-tight">{d.academia.nombre}</span>
          </a>
          <span className="flex-1" />
          <div className="hidden items-center gap-1 md:flex">
            {enlaces.map((e) => (
              <a key={e.a} href={e.a} className={cx('rounded-full px-3 py-2 text-sm font-semibold', solida ? 'hover:bg-ink-100' : 'hover:bg-white/15')}>
                {e.t}
              </a>
            ))}
          </div>
          <a href="#inscribete" className="hidden rounded-full bg-brand-500 px-4 py-2 text-sm font-bold text-white shadow-sm active:scale-95 sm:block">
            Inscríbete
          </a>
        </div>
      </nav>

      {/* ---------- portada ---------- */}
      <header ref={portada} className="relative isolate flex min-h-[92svh] overflow-hidden bg-panel text-white">
        {p.portada ? (
          <>
            <img src={p.portada} alt="" className="pp-paralaje absolute inset-0 -z-10 h-full w-full object-cover" fetchPriority="high" />
            <div className="absolute inset-0 -z-10 bg-gradient-to-t from-black/90 via-black/45 to-black/30" />
          </>
        ) : (
          <div className="absolute inset-0 -z-10" style={{ background: 'radial-gradient(120% 80% at 80% 0%, color-mix(in oklab, var(--marca) 85%, white) 0%, var(--marca) 35%, color-mix(in oklab, var(--marca) 45%, #120f18) 100%)' }}>
            <svg className="absolute -top-24 -right-24 h-[34rem] w-[34rem] opacity-15" viewBox="0 0 64 64" aria-hidden="true">
              <circle cx="32" cy="32" r="17" fill="none" stroke="#fff" strokeWidth="3" strokeDasharray="70 37" strokeLinecap="round" transform="rotate(-30 32 32)" />
              <circle cx="32" cy="32" r="27" fill="none" stroke="#fff" strokeWidth="1.5" strokeDasharray="4 6" />
            </svg>
          </div>
        )}
        <div className="pp-sube mx-auto flex w-full max-w-5xl flex-col justify-end px-5 pt-28 pb-14 sm:pb-16">
          {disciplinas.length > 0 && (
            <p className="mb-4 w-fit rounded-full bg-white/15 px-3 py-1 text-xs font-bold tracking-widest uppercase ring-1 ring-white/25 backdrop-blur">
              {disciplinas
                .map((x) => x.nombre)
                .slice(0, 4)
                .join(' · ')}
            </p>
          )}
          <h1 className="max-w-3xl text-[2.75rem] leading-[1.02] font-extrabold tracking-tight text-balance sm:text-7xl">{p.frase || 'Clases de baile'}</h1>
          {p.intro && <p className="mt-4 max-w-xl text-lg text-pretty text-white/85 sm:text-xl">{p.intro}</p>}
          {primera && (
            <p className="mt-5 inline-flex w-fit items-center gap-1.5 rounded-full bg-white px-3.5 py-1.5 text-sm font-extrabold text-brand-600 shadow-lg">
              <Sparkle size={15} /> {primera}
            </p>
          )}
          <div ref={hero} className="mt-6 flex gap-3">
            <a href="#inscribete" className="flex h-14 flex-1 items-center justify-center gap-2 rounded-2xl bg-brand-500 px-6 text-lg font-bold text-white shadow-xl shadow-black/20 ring-1 ring-white/20 active:scale-[0.98] sm:flex-none">
              Tu primera clase <ArrowRight size={20} aria-hidden="true" />
            </a>
            {wa && (
              <a href={wa} target="_blank" rel="noreferrer" aria-label="WhatsApp" className="flex h-14 w-14 shrink-0 items-center justify-center gap-2 rounded-2xl bg-white/10 font-bold text-white ring-1 ring-white/30 backdrop-blur active:scale-[0.98] sm:w-auto sm:px-5">
                <MessageCircle size={22} /> <span className="hidden sm:inline">WhatsApp</span>
              </a>
            )}
          </div>
          {/* datos que dan confianza, calculados de la app */}
          <dl className="mt-10 grid max-w-xl grid-cols-3 gap-3 border-t border-white/20 pt-6">
            <Dato valor={clasesPorSemana} texto="clases por semana" />
            <Dato valor={disciplinas.length} texto={disciplinas.length === 1 ? 'disciplina' : 'disciplinas'} />
            {desdeCero ? <Dato valor={0} texto="experiencia necesaria" /> : <Dato valor={sedes.length} texto={sedes.length === 1 ? 'sede' : 'sedes'} />}
          </dl>
        </div>
        <a href="#clases" className="pp-rebote absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full p-2 text-white/70 hover:text-white" aria-label="Ver las clases">
          <ChevronDown size={28} />
        </a>
      </header>

      {/* cinta de disciplinas: avanza con el scroll */}
      {disciplinas.length > 1 && (
        <div className="overflow-hidden bg-ink-900 py-4 text-white select-none" aria-hidden="true">
          <div className="pp-cinta flex w-max gap-8 pl-5 text-2xl font-extrabold tracking-tight whitespace-nowrap uppercase sm:text-3xl">
            {Array.from({ length: 4 }, () => disciplinas.map((x) => x.nombre))
              .flat()
              .map((n, i) => (
                <span key={i} className="flex items-center gap-8">
                  <span className={i % 2 ? 'text-transparent [-webkit-text-stroke:1.5px_white]' : ''}>{n}</span>
                  <Sparkle size={22} className="text-brand-500" />
                </span>
              ))}
          </div>
        </div>
      )}

      <main>
        {/* ---------- disciplinas ---------- */}
        {disciplinas.length > 1 && (
          <Seccion id="clases" eyebrow="Nuestras clases" titulo="¿Qué quieres bailar?">
            <div className="pp-carrusel no-scrollbar -mx-5 flex snap-x snap-mandatory gap-3 overflow-x-auto px-[14%] pb-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:grid-cols-[repeat(auto-fit,minmax(14rem,1fr))]">
              {disciplinas.map((x) => (
                <button
                  key={x.nombre}
                  onClick={() => verHorario(x.nombre)}
                  className="group relative flex min-h-48 w-[72vw] shrink-0 snap-center flex-col justify-end overflow-hidden rounded-3xl p-5 text-left text-white shadow-lg active:scale-[0.98] sm:w-auto"
                  style={{ background: `linear-gradient(150deg in oklab, color-mix(in oklab, ${x.color} 80%, white), ${x.color} 45%, color-mix(in oklab, ${x.color} 55%, #120f18))` }}
                >
                  <svg className="absolute -top-8 -right-8 h-36 w-36 opacity-20 transition group-hover:rotate-12" viewBox="0 0 64 64" aria-hidden="true">
                    <circle cx="32" cy="32" r="22" fill="none" stroke="#fff" strokeWidth="4" strokeDasharray="80 60" strokeLinecap="round" />
                  </svg>
                  <span className="text-3xl font-extrabold tracking-tight">{x.nombre}</span>
                  {x.niveles.length > 0 && <span className="mt-1 text-sm font-semibold text-white/85">Niveles: {x.niveles.join(' · ')}</span>}
                  <span className="text-sm text-white/75">{diasTexto([...x.dias])}</span>
                  <span className="mt-3 inline-flex w-fit items-center gap-1 rounded-full bg-white/20 px-3 py-1 text-xs font-bold backdrop-blur">
                    Ver horario <ArrowRight size={14} aria-hidden="true" />
                  </span>
                </button>
              ))}
            </div>
          </Seccion>
        )}

        {/* ---------- horarios ---------- */}
        <Seccion id="horarios" eyebrow={disciplinas.length > 1 ? undefined : 'Nuestras clases'} titulo="Horarios" fondo={disciplinas.length > 1 ? 'superficie' : undefined} idAlterno={disciplinas.length > 1 ? undefined : 'clases'}>
          <div className="space-y-3">
            {conSedes && (
              <div className="flex flex-wrap gap-2" role="tablist" aria-label="Sede">
                {sedes.map((s) => (
                  <button
                    key={s.id ?? 'principal'}
                    role="tab"
                    aria-selected={sede === s.id}
                    onClick={() => setSede(s.id)}
                    className={cx('flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-bold ring-1', sede === s.id ? 'bg-ink-900 text-white ring-ink-900' : 'bg-superficie ring-ink-100')}
                  >
                    <MapPin size={14} /> {s.nombre}
                  </button>
                ))}
              </div>
            )}
            {disciplinas.length > 1 && (
              <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5 sm:mx-0 sm:flex-wrap sm:px-0" aria-label="Disciplina">
                {[null, ...disciplinas.map((x) => x.nombre)].map((n) => (
                  <button
                    key={n ?? 'todas'}
                    aria-pressed={disciplina === n}
                    onClick={() => setDisciplina(n)}
                    className={cx('shrink-0 rounded-full px-3.5 py-1.5 text-sm font-semibold ring-1', disciplina === n ? 'bg-brand-500 text-white ring-brand-500' : 'bg-superficie text-ink-700 ring-ink-100')}
                  >
                    {n ?? 'Todas'}
                  </button>
                ))}
              </div>
            )}
            {nuevos.length > 0 && (
              <div className="space-y-1 rounded-2xl bg-ok-50 p-3 ring-1 ring-ok-600/20">
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
          </div>
          {clasesVista.length === 0 ? (
            <p className="mt-6 text-ink-500">Pronto publicaremos horarios aquí.</p>
          ) : (
            <Horario clases={clasesVista} estados={estados} />
          )}
        </Seccion>

        {/* ---------- precios ---------- */}
        {planesSede.length > 0 && (
          <Seccion id="precios" eyebrow="Precios" titulo={conSedes ? `Planes en ${sedes.find((s) => s.id === sede)?.nombre}` : 'Elige cómo quieres venir'}>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {suelta && (
                <Precio nombre="Clase suelta" detalle="Paga solo cuando vienes" precio={suelta.precio} />
              )}
              {planesSede
                .filter((x) => x.tipo !== 'suelta')
                .map((x, i) => {
                  const porClase = x.tipo === 'paquete' && x.clases ? Math.round(x.precio / x.clases) : null;
                  return (
                    <Precio
                      key={i}
                      nombre={x.nombre}
                      detalle={x.tipo === 'mensual' ? (x.grupos ? `${x.grupos === 1 ? 'Una clase' : `${x.grupos} clases`} durante un mes` : 'Clases ilimitadas durante un mes') : `${x.clases} clases · vigencia ${x.vigencia} días`}
                      precio={x.precio}
                      extra={porClase && suelta && porClase < suelta.precio ? `Te sale en ${dinero(porClase)} por clase` : undefined}
                      destacado={x.tipo === 'mensual' && !x.grupos}
                    />
                  );
                })}
            </div>
            {suelta && <Calculadora planes={planesSede} suelta={suelta} />}
          </Seccion>
        )}

        {/* ---------- franja de la primera clase ---------- */}
        <section className="pp-revela relative overflow-hidden bg-brand-500 text-white">
          <div className="mx-auto flex max-w-5xl flex-col gap-5 px-5 py-12 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-3xl font-extrabold tracking-tight text-balance sm:text-4xl">{primera ?? '¿Listo para tu primera clase?'}</p>
              <p className="mt-1 text-white/85">{desdeCero ? 'No necesitas experiencia ni pareja. Te acompañamos desde el primer paso.' : 'Ven a conocer al grupo y bailar con nosotros.'}</p>
            </div>
            <a href="#inscribete" className="flex h-14 shrink-0 items-center justify-center gap-2 rounded-2xl bg-white px-6 text-lg font-bold text-brand-600 shadow-xl active:scale-[0.98]">
              Apartar mi lugar <ArrowRight size={20} aria-hidden="true" />
            </a>
          </div>
        </section>

        {/* ---------- dónde estamos ---------- */}
        {lugares.length > 0 && (
          <Seccion id="ubicacion" eyebrow="Ubicación" titulo="Dónde estamos">
            <div className="space-y-6">
              {lugares.map((l) => (
                <div key={l.nombre} className="pp-revela grid overflow-hidden rounded-3xl bg-superficie shadow-sm ring-1 ring-ink-100 md:grid-cols-[1.4fr_1fr]">
                  <iframe title={`Mapa de ${l.nombre}`} src={mapaEmbed(l.direccion)} loading="lazy" referrerPolicy="no-referrer-when-downgrade" className="aspect-[16/10] h-full w-full bg-ink-100 md:aspect-auto md:min-h-72" />
                  <div className="flex flex-col gap-3 p-5">
                    {lugares.length > 1 && <p className="text-xs font-extrabold tracking-widest text-brand-600 uppercase">{l.nombre}</p>}
                    <p className="flex gap-2 text-lg font-bold">
                      <MapPin size={20} className="mt-1 shrink-0 text-brand-600" /> {l.direccion}
                    </p>
                    {l.referencias && <p className="text-ink-500">{l.referencias}</p>}
                    <span className="flex-1" />
                    <a href={comoLlegar(l.direccion)} target="_blank" rel="noreferrer" className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-ink-900 font-bold text-white active:scale-[0.98]">
                      <Navigation size={18} /> Cómo llegar
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </Seccion>
        )}

        {/* ---------- eventos ---------- */}
        {d.eventos.length > 0 && (
          <Seccion eyebrow="Agenda" titulo="Próximos eventos" fondo="superficie">
            <ul className="grid gap-3 sm:grid-cols-2">
              {d.eventos.map((e, i) => {
                const [, mm, dd] = e.fecha.split('-').map(Number);
                return (
                  <li key={i} className="pp-revela flex gap-4 rounded-3xl bg-ink-50 p-4 ring-1 ring-ink-100">
                    <span className="flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-2xl bg-brand-500 text-white">
                      <span className="text-2xl leading-none font-extrabold">{dd}</span>
                      <span className="text-xs font-bold uppercase">{MESES[mm - 1]}</span>
                    </span>
                    <span className="min-w-0">
                      <span className="block text-lg font-extrabold">{e.nombre}</span>
                      <span className="block text-sm text-ink-500">
                        {e.hora} · boleto {dinero(e.precio)}
                      </span>
                      {e.descripcion && <span className="mt-1 block text-sm">{e.descripcion}</span>}
                      {e.quedan !== null && <span className={cx('mt-1 block text-sm font-bold', e.quedan === 0 ? 'text-bad-600' : 'text-brand-600')}>{e.quedan === 0 ? 'Agotado' : `Quedan ${e.quedan} lugares`}</span>}
                    </span>
                  </li>
                );
              })}
            </ul>
          </Seccion>
        )}

        {/* ---------- tienda ---------- */}
        {d.tienda.length > 0 && (
          <Seccion eyebrow="Tienda" titulo="Lleva tu estilo">
            <div className="no-scrollbar -mx-5 flex snap-x gap-3 overflow-x-auto px-5 pb-2 sm:mx-0 sm:grid sm:grid-cols-[repeat(auto-fill,minmax(11rem,1fr))] sm:overflow-visible sm:px-0">
              {d.tienda.map((x, i) => (
                <div key={i} className="w-40 shrink-0 snap-start rounded-3xl bg-superficie p-3 text-center shadow-sm ring-1 ring-ink-100 sm:w-auto">
                  {x.foto ? <img src={x.foto} alt="" loading="lazy" className="aspect-[4/3] w-full rounded-2xl object-cover" /> : <span className="flex aspect-[4/3] items-center justify-center rounded-2xl bg-ink-50 text-6xl">{x.emoji}</span>}
                  <p className="mt-2 text-sm font-bold">{x.nombre}</p>
                  <p className="text-sm font-extrabold text-brand-600">{dinero(x.precio)}</p>
                  {x.sobre_pedido && <p className="text-[11px] text-ink-500">Sobre pedido</p>}
                </div>
              ))}
            </div>
            <p className="mt-3 flex items-center gap-1.5 text-sm text-ink-500">
              <ShoppingBag size={16} /> Pídelo en recepción o por WhatsApp.
            </p>
          </Seccion>
        )}

        {/* ---------- preguntas ---------- */}
        {(p.preguntas?.length ?? 0) > 0 && (
          <Seccion id="preguntas" eyebrow="Dudas" titulo="Preguntas frecuentes" fondo="superficie">
            <div className="pp-faq divide-y divide-ink-100 rounded-3xl bg-ink-50 px-5 ring-1 ring-ink-100">
              {p.preguntas!.map((x, i) => (
                <details key={i}>
                  <summary className="py-4 text-lg font-bold">{x.p}</summary>
                  <p className="pb-4 pl-8 text-ink-700">{x.r}</p>
                </details>
              ))}
            </div>
          </Seccion>
        )}

        {/* ---------- inscripción ---------- */}
        <section className="bg-panel text-white">
          <div className="mx-auto grid max-w-5xl gap-8 px-5 py-14 md:grid-cols-[1fr_1.1fr] md:items-start">
            <div className="md:sticky md:top-24">
              <p className="text-xs font-extrabold tracking-widest text-white/60 uppercase">Inscríbete</p>
              <p className="mt-2 text-4xl font-extrabold tracking-tight text-balance">Tu primer paso empieza aquí</p>
              <ul className="mt-5 space-y-3 text-white/85">
                <Punto>Te escribimos por WhatsApp para apartarte lugar</Punto>
                {desdeCero && <Punto>Grupos desde cero, sin necesidad de pareja</Punto>}
                <Punto>Sin compromiso: conoce al grupo y después decides tu plan</Punto>
              </ul>
              {wa && (
                <a href={wa} target="_blank" rel="noreferrer" className="mt-6 inline-flex h-12 items-center gap-2 rounded-2xl bg-[#25d366] px-5 font-bold text-white active:scale-[0.98]">
                  <MessageCircle size={20} /> Escríbenos por WhatsApp
                </a>
              )}
            </div>
            <div ref={form} id="inscribete" className="scroll-mt-24 text-ink-900">
              <Inscripcion d={d} slug={slug} clases={clasesSede.length ? clasesSede : d.clases} primera={primera} estados={estados} />
            </div>
          </div>
        </section>
      </main>

      {/* ---------- pie ---------- */}
      <footer className="border-t border-white/10 bg-panel pb-28 text-white/70 sm:pb-10">
        <div className="mx-auto flex max-w-5xl flex-col gap-6 px-5 pt-10 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="rounded-xl bg-white p-1.5">
              <LogoAcademia academia={{ nombre: d.academia.nombre, logo: d.academia.logo }} tam={36} />
            </span>
            <span>
              <span className="block font-extrabold text-white">{d.academia.nombre}</span>
              {lugares[0] && <span className="block text-sm">{lugares[0].direccion}</span>}
            </span>
          </div>
          {redes.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {redes.map((r) => (
                <a key={r.red} href={r.url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-white ring-1 ring-white/15 hover:bg-white/15">
                  <AtSign size={15} /> {{ instagram: 'Instagram', facebook: 'Facebook', tiktok: 'TikTok' }[r.red]}
                </a>
              ))}
            </div>
          )}
        </div>
        <p className="mx-auto mt-8 max-w-5xl px-5 text-xs text-white/40">
          © {new Date().getFullYear()} {d.academia.nombre} · Hecho con Compás
        </p>
      </footer>

      {/* botón fijo para inscribirse (sobre todo en el celular) */}
      <div
        className={cx(
          'fixed inset-x-0 bottom-0 z-30 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] transition duration-300 sm:hidden',
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

/** Sección a todo lo ancho con su encabezado. */
function Seccion({ id, idAlterno, eyebrow, titulo, fondo, children }: { id?: string; idAlterno?: string; eyebrow?: string; titulo: string; fondo?: 'superficie'; children: ReactNode }) {
  return (
    <section id={id ?? idAlterno} className={cx('scroll-mt-16', fondo === 'superficie' ? 'bg-superficie' : 'bg-ink-50')}>
      {/* el horario necesita su propio ancla aunque comparta sección con "Clases" */}
      {idAlterno && id && <span id={idAlterno} />}
      <div className="mx-auto max-w-5xl px-5 py-14 sm:py-20">
        <div className="pp-revela mb-8">
          {eyebrow && <p className="text-xs font-extrabold tracking-widest text-brand-600 uppercase">{eyebrow}</p>}
          <h2 className="mt-1 text-3xl font-extrabold tracking-tight text-balance sm:text-4xl">{titulo}</h2>
        </div>
        {children}
      </div>
    </section>
  );
}

function Dato({ valor, texto }: { valor: number; texto: string }) {
  return (
    <div>
      <dt className="sr-only">{texto}</dt>
      <dd>
        <span className="sr-only">{valor}</span>
        <Contador n={valor} />
        <span className="block text-xs leading-tight text-white/75">{texto}</span>
      </dd>
    </div>
  );
}

function Precio({ nombre, detalle, precio, extra, destacado }: { nombre: string; detalle: string; precio: number; extra?: string; destacado?: boolean }) {
  return (
    <div className={cx('pp-revela relative flex flex-col rounded-3xl p-5 ring-1', destacado ? 'bg-panel text-white ring-panel' : 'bg-superficie shadow-sm ring-ink-100')}>
      {destacado && <span className="absolute -top-3 left-5 rounded-full bg-brand-500 px-3 py-1 text-xs font-bold text-white">Para venir cuando quieras</span>}
      <p className="text-lg font-extrabold">{nombre}</p>
      <p className={cx('text-sm', destacado ? 'text-white/70' : 'text-ink-500')}>{detalle}</p>
      <p className="mt-4 text-4xl font-extrabold tracking-tight">{dinero(precio)}</p>
      {extra && <p className={cx('mt-1 text-sm font-bold', destacado ? 'text-white/85' : 'text-ok-600')}>{extra}</p>}
    </div>
  );
}

function Punto({ children }: { children: ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-500 text-white">
        <Check size={14} />
      </span>
      {children}
    </li>
  );
}

function Inscripcion({ d, slug, clases, primera, estados }: { d: DatosPublica; slug: string; clases: DatosPublica['clases']; primera: string | null; estados: Estados }) {
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
  const campo = 'h-12 w-full rounded-xl bg-ink-50 px-4 ring-1 ring-ink-100 outline-none placeholder:text-ink-300 focus:ring-2 focus:ring-brand-500';

  if (estado === 'enviado')
    return (
      <section className="rounded-3xl bg-superficie p-8 text-center shadow-2xl" role="status">
        <span className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-ok-600 text-white">
          <Check size={30} />
        </span>
        <p className="text-2xl font-extrabold">¡Listo, {nombre.trim().split(' ')[0]}!</p>
        <p className="mt-1 text-ink-700">
          {esperaEnviada
            ? `Ese grupo ya va avanzado: te escribimos por WhatsApp en cuanto abra el siguiente grupo de ${esperaEnviada}. 💃🕺`
            : `Te escribimos por WhatsApp para darte los detalles. ¡Te esperamos en ${d.academia.nombre}! 💃🕺`}
        </p>
      </section>
    );

  return (
    <section className="rounded-3xl bg-superficie p-6 shadow-2xl">
      <h2 className="text-2xl font-extrabold tracking-tight">Agenda tu primera clase</h2>
      {primera && (
        <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1 text-sm font-bold text-brand-600">
          <Sparkle size={14} /> {primera}
        </p>
      )}
      <p className="mt-2 text-sm text-ink-500">Déjanos tus datos y te escribimos por WhatsApp para apartarte lugar.</p>
      <form
        className="mt-5 space-y-3"
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
          <span className="mb-1 block text-sm font-semibold text-ink-700">Nombre</span>
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} autoComplete="name" className={campo} />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-semibold text-ink-700">WhatsApp (10 dígitos)</span>
          <input value={telefono} onChange={(e) => setTelefono(e.target.value)} inputMode="tel" autoComplete="tel" className={campo} />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-semibold text-ink-700">¿Qué clase te interesa?</span>
          <select value={claseId} onChange={(e) => setClaseId(e.target.value)} className={cx(campo, 'px-3')}>
            <option value="">Todavía no sé / cualquiera</option>
            {clases.map((c) => (
              <option key={c.id} value={c.id}>
                {c.clase} · {c.dias.map((x) => DIAS_CORTOS[x]).join(' ')} {c.hora}
                {estados.get(c.id)?.aceptaNuevos === false ? ' · próximo grupo' : estados.get(c.id)?.tipo === 'pronto' ? ' · grupo nuevo' : ''}
              </option>
            ))}
          </select>
        </label>
        {espera && <p className="rounded-xl bg-warn-50 px-3 py-2 text-sm font-medium text-warn-600">{espera.clase} ya va a medio curso. Déjanos tus datos y te avisamos cuando abra el siguiente grupo.</p>}
        <label className="block">
          <span className="mb-1 block text-sm font-semibold text-ink-700">Algo que quieras decirnos (opcional)</span>
          <input value={mensaje} onChange={(e) => setMensaje(e.target.value)} maxLength={300} placeholder="Ej. nunca he bailado, voy en pareja…" className={campo} />
        </label>
        {error && <p className="rounded-xl bg-bad-50 px-3 py-2 text-sm font-medium text-bad-600">{error}</p>}
        <button type="submit" disabled={!valido || estado === 'enviando'} className="h-14 w-full rounded-2xl bg-brand-500 text-lg font-bold text-white shadow-lg shadow-brand-500/30 active:scale-[0.98] disabled:opacity-50 disabled:shadow-none">
          {estado === 'enviando' ? 'Enviando…' : espera ? 'Avísenme del siguiente grupo' : 'Quiero inscribirme'}
        </button>
        <p className="flex items-center justify-center gap-1.5 text-center text-xs text-ink-500">
          <Users size={13} /> Solo usamos tu número para escribirte sobre las clases.
        </p>
      </form>
    </section>
  );
}


/** Número que cuenta hasta su valor al aparecer (sin animación si se pidió menos movimiento). */
function Contador({ n }: { n: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [v, setV] = useState(n);
  useEffect(() => {
    const el = ref.current;
    if (!el || n < 2 || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    setV(0);
    let raf = 0;
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      const t0 = performance.now();
      const paso = (t: number) => {
        const k = Math.min(1, (t - t0) / 1100);
        setV(Math.round(n * (1 - Math.pow(1 - k, 3))));
        if (k < 1) raf = requestAnimationFrame(paso);
      };
      raf = requestAnimationFrame(paso);
    });
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [n]);
  return (
    <span ref={ref} aria-hidden="true" className="block text-3xl font-extrabold tracking-tight tabular-nums">
      {v}
    </span>
  );
}

const minutos = (h: string) => Number(h.slice(0, 2)) * 60 + Number(h.slice(3));
const enCuanto = (m: number) => (m < 60 ? `En ${m} min` : m < 120 ? 'En 1 h' : `En ${Math.round(m / 60)} h`);

/**
 * Horario por día: abre en hoy (o el siguiente día con clases), con "Ahora" y "Siguiente" en vivo.
 * "Toda la semana" muestra todo junto, para quien quiere planear.
 */
function Horario({ clases, estados }: { clases: DatosPublica['clases']; estados: Estados }) {
  const [ahora, setAhora] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setAhora(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);
  const hoyDia = ahora.getDay();
  const min = ahora.getHours() * 60 + ahora.getMinutes();
  const conClase = SEMANA.filter((x) => clases.some((c) => c.dias.includes(x)));
  // hoy, o el siguiente día que tenga clases
  const porDefecto = [0, 1, 2, 3, 4, 5, 6].map((k) => (hoyDia + k) % 7).find((x) => conClase.includes(x)) ?? 'semana';
  const [elegido, setElegido] = useState<number | 'semana' | null>(null);
  const dia = elegido !== null && (elegido === 'semana' || conClase.includes(elegido)) ? elegido : porDefecto;
  const delDia = (x: number) => clases.filter((c) => c.dias.includes(x)).sort((a, b) => a.hora.localeCompare(b.hora));
  // en vivo (solo hoy): la que está pasando y la siguiente
  const deHoy = delDia(hoyDia);
  const enCurso = new Set(deHoy.filter((c) => minutos(c.hora) <= min && min < minutos(c.hora) + c.duracion).map((c) => c.id));
  const siguiente = deHoy.find((c) => minutos(c.hora) > min);

  const fila = (c: DatosPublica['clases'][number], vivo: boolean) => {
    const e = estados.get(c.id);
    const esAhora = vivo && enCurso.has(c.id);
    const esSiguiente = vivo && siguiente?.id === c.id;
    return (
      <li key={c.id} className={cx('flex items-center gap-3 rounded-2xl bg-superficie px-4 py-3 shadow-sm ring-1 transition', esAhora ? 'ring-2 ring-ok-600' : 'ring-ink-100')}>
        <span className="h-10 w-1.5 shrink-0 rounded-full" style={{ background: c.color ?? 'var(--marca)' }} />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2 font-bold">
            {c.clase}
            {esAhora && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-ok-50 px-2 py-0.5 text-[11px] font-extrabold text-ok-600 uppercase">
                <span className="pp-pulso h-2 w-2 rounded-full bg-ok-600" /> Ahora
              </span>
            )}
            {esSiguiente && <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-extrabold text-brand-600">{enCuanto(minutos(c.hora) - min)}</span>}
          </span>
          {e?.texto && <span className={cx('block text-xs font-semibold', e.aceptaNuevos ? 'text-ok-600' : 'text-ink-500')}>{e.texto}</span>}
        </span>
        <span className="text-right">
          <span className="block text-sm font-semibold text-ink-700 tabular-nums">
            {c.hora}–{horaFin(c.hora, c.duracion)}
          </span>
          {c.precio ? <span className="block text-sm font-bold text-brand-600">{dinero(c.precio)}</span> : null}
        </span>
      </li>
    );
  };

  return (
    <div className="mt-6">
      <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5 pb-1 sm:mx-0 sm:flex-wrap sm:px-0" aria-label="Día">
        {conClase.map((x) => (
          <button
            key={x}
            aria-pressed={dia === x}
            onClick={() => setElegido(x)}
            className={cx(
              'flex shrink-0 flex-col items-center rounded-2xl px-4 py-2 ring-1 transition',
              dia === x ? 'bg-ink-900 text-white ring-ink-900' : 'bg-superficie ring-ink-100 hover:bg-ink-50',
            )}
          >
            <span className="text-sm font-extrabold">{x === hoyDia ? 'Hoy' : DIAS_CORTOS[x]}</span>
            <span className={cx('text-[11px]', dia === x ? 'text-white/70' : 'text-ink-500')}>
              {delDia(x).length} {delDia(x).length === 1 ? 'clase' : 'clases'}
            </span>
          </button>
        ))}
        <button
          aria-pressed={dia === 'semana'}
          onClick={() => setElegido('semana')}
          className={cx('shrink-0 rounded-2xl px-4 py-2 text-sm font-extrabold ring-1 transition', dia === 'semana' ? 'bg-ink-900 text-white ring-ink-900' : 'bg-superficie ring-ink-100 hover:bg-ink-50')}
        >
          Toda la semana
        </button>
      </div>
      {dia === 'semana' ? (
        <div className="mt-5 grid gap-x-6 gap-y-5 lg:grid-cols-2">
          {conClase.map((x) => (
            <div key={x}>
              <p className="mb-2 text-xs font-extrabold tracking-widest text-ink-500 uppercase">{DIAS_LARGOS[x]}</p>
              <ul className="space-y-2">{delDia(x).map((c) => fila(c, x === hoyDia))}</ul>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-5">
          <p className="mb-2 text-xs font-extrabold tracking-widest text-ink-500 uppercase">
            {DIAS_LARGOS[dia]}
            {dia === hoyDia ? ' · hoy' : ''}
          </p>
          <ul className="grid gap-2 lg:grid-cols-2">{delDia(dia).map((c) => fila(c, dia === hoyDia))}</ul>
        </div>
      )}
    </div>
  );
}

/**
 * "¿Qué plan te conviene?": según cuántas veces por semana quiere venir, cuánto le cuesta al mes
 * cada forma de pagar y cuál le sale más barata. Usa los precios reales de la sede.
 */
function Calculadora({ planes, suelta }: { planes: DatosPublica['planes']; suelta: DatosPublica['planes'][number] }) {
  const [veces, setVeces] = useState(2);
  const alMes = veces * 4;
  const opciones = [
    { nombre: 'Clase suelta', costo: suelta.precio * alMes, detalle: `${alMes} × ${dinero(suelta.precio)}` },
    ...planes
      .filter((x) => x.tipo === 'paquete' && x.clases)
      .map((x) => {
        const k = Math.ceil(alMes / x.clases!);
        return { nombre: x.nombre, costo: k * x.precio, detalle: k === 1 ? `${x.clases} clases` : `${k} paquetes de ${x.clases} clases` };
      }),
    ...planes.filter((x) => x.tipo === 'mensual' && !x.grupos).map((x) => ({ nombre: x.nombre, costo: x.precio, detalle: 'ilimitado' })),
  ];
  if (opciones.length < 2) return null;
  const mejor = opciones.reduce((a, b) => (b.costo < a.costo ? b : a));
  const maximo = Math.max(...opciones.map((o) => o.costo));
  const ahorro = suelta.precio * alMes - mejor.costo;

  return (
    <div className="pp-revela mt-8 grid gap-6 rounded-3xl bg-superficie p-5 shadow-sm ring-1 ring-ink-100 sm:p-7 md:grid-cols-2">
      <div>
        <p className="text-xs font-extrabold tracking-widest text-brand-600 uppercase">Calculadora</p>
        <p className="mt-1 text-2xl font-extrabold tracking-tight">¿Qué plan te conviene?</p>
        <label htmlFor="pp-veces" className="mt-5 block text-sm font-semibold text-ink-700">
          ¿Cuántas veces por semana quieres venir?
        </label>
        <p className="mt-1 text-4xl font-extrabold tracking-tight">
          {veces} <span className="text-lg font-bold text-ink-500">{veces === 1 ? 'vez' : 'veces'} por semana</span>
        </p>
        <input
          id="pp-veces"
          type="range"
          min={1}
          max={6}
          step={1}
          value={veces}
          onChange={(e) => setVeces(Number(e.target.value))}
          aria-valuetext={`${veces} ${veces === 1 ? 'vez' : 'veces'} por semana`}
          className="pp-slider mt-2"
          style={{ ['--slider-progress' as string]: `${((veces - 1) / 5) * 100}%` }}
        />
        <div className="flex justify-between text-xs font-semibold text-ink-500" aria-hidden="true">
          {[1, 2, 3, 4, 5, 6].map((x) => (
            <span key={x}>{x}</span>
          ))}
        </div>
        <p className="mt-2 text-sm text-ink-500">Son unas {alMes} clases al mes.</p>
      </div>
      <div aria-live="polite">
        <div className="rounded-2xl bg-panel p-5 text-white">
          <p className="text-sm text-white/70">Te conviene</p>
          <p className="text-2xl font-extrabold">{mejor.nombre}</p>
          <p className="mt-1 text-3xl font-extrabold tracking-tight">
            {dinero(mejor.costo)} <span className="text-base font-bold text-white/70">al mes</span>
          </p>
          <p className="text-sm text-white/70">≈ {dinero(Math.round(mejor.costo / alMes / 100) * 100)} por clase</p>
          {ahorro > 0 && <p className="mt-2 inline-block rounded-full bg-ok-600 px-3 py-1 text-sm font-bold">Ahorras {dinero(ahorro)} vs. pagar por clase</p>}
        </div>
        <ul className="mt-4 space-y-2">
          {opciones
            .slice()
            .sort((a, b) => a.costo - b.costo)
            .map((o) => (
              <li key={o.nombre}>
                <div className="flex items-baseline justify-between gap-2 text-sm">
                  <span className={cx('font-semibold', o === mejor && 'text-brand-600')}>{o.nombre}</span>
                  <span className="font-bold tabular-nums">{dinero(o.costo)}</span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-ink-100">
                  <div
                    className={cx('h-full origin-left rounded-full transition-transform duration-500', o === mejor ? 'bg-brand-500' : 'bg-ink-300')}
                    style={{ transform: `scaleX(${o.costo / maximo})` }}
                  />
                </div>
                <p className="text-[11px] text-ink-500">{o.detalle}</p>
              </li>
            ))}
        </ul>
      </div>
    </div>
  );
}
