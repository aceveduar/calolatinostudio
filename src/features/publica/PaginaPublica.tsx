import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { DetalleEvento } from '../../components/DetalleEvento';
import { ArrowLeft, ArrowRight, AtSign, ChevronDown, MapPin, MessageCircle, Navigation, ShoppingBag, Sparkle } from 'lucide-react';
import { nubePublica as supabase } from '../../app/rpcPublica';
import { LogoAcademia } from '../../components/LogoAcademia';
import { cx, Hoja } from '../../components/ui';
import { ImagenProducto } from '../../components/ImagenProducto';
import { dinero } from '../../domain/dinero';
import { fechaCorta, hoy, sumarDias } from '../../domain/fechas';
import { estadoCurso } from '../../domain/cursos';
import { PRINCIPAL } from '../../domain/sedes';
import { comoLlegar, urlRed, type DatosPublica, REDES, NOMBRE_RED } from '../../domain/publica';
import { leerHuella } from '../../domain/invitar';
import { recordarOrigen } from '../../domain/origen';
import { textoAvisoPrivacidad } from '../../domain/privacidad';
import { AvisoPrivacidad } from './AvisoPrivacidad';
import { DIAS_LARGOS, MESES, disciplinaDe, diasTexto, DESDE_CERO, type Estados } from './comun';
import { Seccion, Dato, Precio, Punto } from './piezas';
import { Inscripcion } from './Inscripcion';
import { Horario } from './Horario';
import { Calculadora } from './Calculadora';
import { MapaLigero } from './Mapa';
import { Comunidad } from './Comunidad';

/**
 * Página pública del estudio (la página oficial): portada, disciplinas, horarios por sede, precios,
 * ubicación, eventos, tienda, preguntas e inscripción. No muestra maestros ni datos de alumnos.
 */
/** Datos que Cloudflare ya escribió en el HTML (functions/a/[slug].ts): la página aparece sin esperar otra petición. */
function incrustados(slug: string): DatosPublica | null {
  const el = document.getElementById('pp-datos');
  if (!el || el.dataset.slug !== slug) return null;
  try {
    const d = JSON.parse(el.textContent ?? '');
    return d?.academia ? (d as DatosPublica) : null;
  } catch {
    return null;
  }
}

export function PaginaPublica({ slug }: { slug: string }) {
  const [datos, setDatos] = useState<DatosPublica | null | 'no' | 'error'>(() => incrustados(slug));
  useEffect(() => {
    if (incrustados(slug)) return;
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
  if (datos === 'error')
    return (
      <Centro titulo="No se pudo cargar" accion={<Reintentar />}>
        Revisa tu conexión e inténtalo de nuevo.
      </Centro>
    );
  if (new URLSearchParams(location.search).has('reglamentos')) {
    const reglamentos = datos.pagina?.reglamentos ?? [];
    return (
      <main className="mx-auto min-h-dvh max-w-2xl px-5 py-6">
        <a href={`/a/${slug}`} className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-brand-600">
          <ArrowLeft size={16} aria-hidden="true" /> {datos.academia.nombre}
        </a>
        <h1 className="mb-4 text-2xl font-extrabold">Reglamentos</h1>
        {reglamentos.length ? (
          <div className="space-y-3">
            {reglamentos.map((r) => (
              <details key={r.id} className="group rounded-2xl bg-superficie ring-1 ring-ink-100">
                <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 font-semibold [&::-webkit-details-marker]:hidden">
                  {r.titulo}<ChevronDown size={16} aria-hidden="true" className="shrink-0 group-open:rotate-180" />
                </summary>
                <div className="space-y-3 break-words border-t border-ink-100 px-4 py-4 text-sm leading-relaxed">
                  {r.texto.trim().split(/\r?\n\s*\r?\n|\r?\n(?=\d+\.\s)/).map((parrafo, i) => {
                    if (!/^\d+\.\s/.test(parrafo)) return <p key={i} className="whitespace-pre-line">{parrafo}</p>;
                    const [encabezado, ...lineas] = parrafo.split(/\r?\n/);
                    return (
                      <div key={i} className="space-y-2 pt-2">
                        <h2 className="font-bold">{encabezado}</h2>
                        {lineas.length > 0 && <p className="whitespace-pre-line">{lineas.join('\n')}</p>}
                      </div>
                    );
                  })}
                </div>
              </details>
            ))}
          </div>
        ) : <p className="text-sm text-ink-500">La academia aún no ha publicado sus reglamentos.</p>}
      </main>
    );
  }
  return <Vista d={datos} slug={slug} />;
}

function Centro({ titulo, children, accion }: { titulo?: string; children: ReactNode; accion?: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-2 bg-ink-50 px-8 text-center">
      {titulo && <p className="text-lg font-bold">{titulo}</p>}
      <p className="text-ink-500">{children}</p>
      {accion}
    </div>
  );
}

/** Un error de conexión debe poder reintentarse aquí mismo (antes solo decía "inténtalo de nuevo"). */
function Reintentar() {
  return (
    <button type="button" onClick={() => location.reload()} className="mt-3 h-12 rounded-2xl bg-brand-500 px-6 font-bold text-white active:scale-[0.98]">
      Reintentar
    </button>
  );
}

function Vista({ d, slug }: { d: DatosPublica; slug: string }) {
  const p = d.pagina ?? {};
  const testimonios = (p.testimonios ?? []).filter((t) => !/^ejemplo\s*:/i.test(t.nombre.trim()));
  const sedes = useMemo(() => [{ id: null as string | null, nombre: d.academia.sede_principal, color: d.academia.color ?? '#d6304a' }, ...d.sedes], [d]);
  const conSedes = d.sedes.length > 0;
  const [sede, setSede] = useState<string | null>(null);
  const [disciplina, setDisciplina] = useState<string | null>(null);
  const clasesSede = d.clases.filter((c) => (c.sede_id ?? null) === sede);
  // llegó con una invitación de un alumno (?de=…): "Vienes de parte de Ana L." y se anota al inscribirse
  const [de] = useState(() => leerHuella(location.search));
  const [invita, setInvita] = useState<string | null>(null);
  // de dónde llegó (anuncio, red social): se anota al entrar y se manda con la inscripción
  const [origen] = useState(recordarOrigen);
  useEffect(() => {
    if (!de || !supabase) return;
    void supabase.rpc('invitado_por', { p_slug: slug, p_de: de }).then(({ data }) => typeof data === 'string' && setInvita(data));
  }, [de, slug]);
  const clasesVista = d.clases.filter((c) => !disciplina || disciplinaDe(c) === disciplina);
  const fechaActual = hoy();
  const cambiosHorario = d.clases.flatMap((c) => Object.entries(c.excepciones ?? {})
    .filter(([fecha]) => fecha >= fechaActual && fecha <= sumarDias(fechaActual, 6))
    .map(([fecha, cambio]) => ({ id: c.id, nombre: c.clase, fecha, cambio })))
    .sort((a, b) => a.fecha.localeCompare(b.fecha));
  // los planes "solo de la sede principal" llevan un id fijo (no hay registro de la sede principal)
  const planesSede = d.planes.filter((x) => !x.sede_id || x.sede_id === (sede ?? PRINCIPAL));
  const suelta = planesSede.find((x) => x.tipo === 'suelta' && x.sede_id) ?? planesSede.find((x) => x.tipo === 'suelta');
  const wa = d.academia.whatsapp ? `https://wa.me/52${d.academia.whatsapp}?text=${encodeURIComponent(`Hola, vi la página de ${d.academia.nombre} y quiero información.`)}` : null;

  // la oferta de la primera clase: la que escribió la academia o el precio de la clase suelta
  const esPrincipal = (x: { sede_id: string | null }) => !x.sede_id || x.sede_id === PRINCIPAL;
  const sueltaGeneral =
    d.planes.find((x) => x.tipo === 'suelta' && x.sede_id === PRINCIPAL) ?? d.planes.find((x) => x.tipo === 'suelta' && esPrincipal(x)) ?? d.planes.find((x) => x.tipo === 'suelta');
  const primera = p.primera || (sueltaGeneral ? `Clase de prueba: ${dinero(sueltaGeneral.precio)}` : null);
  const privacidad = textoAvisoPrivacidad(p.privacidad, { academia: d.academia.nombre, direccion: p.ubicaciones?.principal?.direccion, whatsapp: d.academia.whatsapp });
  const lugares = sedes.flatMap((s) => {
    const u = p.ubicaciones?.[s.id ?? 'principal'];
    return u?.direccion ? [{ ...u, nombre: s.nombre }] : [];
  });
  const redes = REDES.flatMap((r) => {
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

  // siguiente clase de hoy (para la etiqueta en vivo de la portada)
  const siguienteHoy = useMemo(() => {
    const ahora = new Date();
    const min = ahora.getHours() * 60 + ahora.getMinutes();
    return d.clases
      .filter((c) => c.dias.includes(ahora.getDay()) && Number(c.hora.slice(0, 2)) * 60 + Number(c.hora.slice(3)) > min)
      .sort((x, y) => x.hora.localeCompare(y.hora))[0];
  }, [d.clases]);
  // barra de arriba sólida al pasar la portada; botón fijo abajo cuando no se ve la portada ni el formulario
  const hero = useRef<HTMLDivElement>(null);
  const form = useRef<HTMLDivElement>(null);
  const portada = useRef<HTMLElement>(null);
  const [verBarra, setVerBarra] = useState(false);
  const [solida, setSolida] = useState(false);
  useEffect(() => {
    const vistos = new Map<Element, boolean>();
    const actualizar = (es: IntersectionObserverEntry[]) => {
      for (const e of es) vistos.set(e.target, e.isIntersecting || (e.target === form.current && e.boundingClientRect.top < 0));
      setVerBarra(![...vistos.values()].some(Boolean));
    };
    // El botón de la portada cuenta en cuanto se ve, aunque sea abajo de la pantalla (en celulares chicos
    // queda en la parte baja: antes se mostraban los dos botones encimados).
    const io = new IntersectionObserver(actualizar);
    // El formulario, en cambio, solo cuenta si ya se ve bien: si apenas asoma, el botón fijo sigue ayudando.
    const ioForm = new IntersectionObserver(actualizar, { rootMargin: '0px 0px -25% 0px' });
    if (hero.current) io.observe(hero.current);
    if (form.current) ioForm.observe(form.current);
    const io2 = new IntersectionObserver(([e]) => setSolida(!e.isIntersecting), { rootMargin: '-72px 0px 0px 0px', threshold: 0 });
    if (portada.current) io2.observe(portada.current);
    return () => {
      io.disconnect();
      ioForm.disconnect();
      io2.disconnect();
    };
  }, []);

  // Al llegar con #horarios, #precios… (enlaces del portal o compartidos): la página se arma después de
  // cargar los datos, así que el navegador no alcanza a bajar solo; se baja aquí, una vez.
  useEffect(() => {
    const id = decodeURIComponent(location.hash.slice(1));
    if (!id) return;
    const t = setTimeout(() => document.getElementById(id === 'horario' ? 'horarios' : id)?.scrollIntoView({ block: 'start' }), 50);
    return () => clearTimeout(t);
  }, []);

  // Alumno que viene de SU portal (?yo=1): ya es alumno, así que nada de "tu primera clase" ni inscripción;
  // ve horarios, precios y eventos, y un botón para volver a su portal.
  const yo = new URLSearchParams(location.search).has('yo');
  const volverAlPortal = () => (history.length > 1 ? history.back() : undefined);

  // tocar una clase del horario: queda elegida en el formulario
  const [claseSel, setClaseSel] = useState('');
  const opcionesClase = clasesSede.length ? d.clases.filter((c) => (c.sede_id ?? null) === sede || c.id === claseSel) : d.clases;
  const apartar = (id: string) => {
    setClaseSel(id);
    document.getElementById('inscribete')?.scrollIntoView({ block: 'start' });
    setTimeout(() => document.getElementById('pp-nombre')?.focus({ preventScroll: true }), 450);
  };
  const waCon = (texto: string) => (d.academia.whatsapp ? `https://wa.me/52${d.academia.whatsapp}?text=${encodeURIComponent(texto)}` : null);
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
          <a href="#" className="flex min-h-11 min-w-0 items-center gap-2.5" aria-label={`${d.academia.nombre}, ir al inicio`}>
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
          {!yo && (
            <a href="#inscribete" className="hidden rounded-full bg-brand-500 px-4 py-2 text-sm font-bold text-white shadow-sm active:scale-95 sm:block">
              Inscríbete
            </a>
          )}
        </div>
      </nav>

      {/* ---------- portada: texto sobre fondo limpio y la foto como tarjeta ---------- */}
      <header ref={portada} className="relative isolate overflow-hidden bg-panel text-white">
        {/* resplandor del color de la academia (decorativo) */}
        <div className="absolute inset-0 -z-10" aria-hidden="true" style={{ background: 'radial-gradient(60% 70% at 85% 30%, color-mix(in oklab, var(--marca) 55%, transparent), transparent 70%), radial-gradient(50% 60% at 0% 100%, color-mix(in oklab, var(--marca) 30%, transparent), transparent 70%)' }} />
        <div className="mx-auto grid max-w-5xl items-center gap-8 px-5 pt-20 pb-12 md:grid-cols-[1.1fr_1fr] md:gap-12 md:pt-28 md:pb-20">
          {/* foto (en el celular va primero) */}
          <div className="relative order-first md:order-last">
            {p.portada ? (
              <div className="relative overflow-hidden rounded-[2rem] shadow-2xl shadow-black/40 ring-1 ring-white/15 md:rotate-1">
                <img src={p.portada} alt={`Clase en ${d.academia.nombre}`} className="aspect-[16/10] w-full object-cover md:aspect-[4/5]" fetchPriority="high" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
              </div>
            ) : (
              <div className="flex aspect-[4/3] items-center justify-center rounded-[2rem] bg-white/5 ring-1 ring-white/10 md:aspect-[4/5]">
                <span className="rounded-3xl bg-white p-5 shadow-2xl">
                  <LogoAcademia academia={{ nombre: d.academia.nombre, logo: d.academia.logo }} tam={120} />
                </span>
              </div>
            )}
            {/* etiquetas flotantes: la oferta y la siguiente clase de hoy */}
            {primera && (
              <p className="absolute -bottom-4 left-4 flex items-center gap-2 rounded-2xl bg-superficie px-4 py-3 text-sm font-extrabold text-ink-900 shadow-xl ring-1 ring-ink-100 md:-left-6">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-500 text-white">
                  <Sparkle size={16} />
                </span>
                {primera}
              </p>
            )}
            {siguienteHoy && (
              <p className="absolute top-4 right-4 flex items-center gap-2 rounded-full bg-black/55 px-3 py-1.5 text-xs font-bold text-white ring-1 ring-white/20 backdrop-blur md:-right-4">
                <span className="pp-pulso h-2 w-2 rounded-full bg-ok-600" />
                Hoy {siguienteHoy.hora} · {siguienteHoy.clase}
              </p>
            )}
          </div>

          {/* texto */}
          <div className="pp-sube">
            {invita && (
              <p className="mt-3 mb-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-white ring-1 ring-white/20 md:mt-0">
                <span aria-hidden="true">💃</span> Vienes de parte de {invita}
              </p>
            )}
            <h1 className="text-[2.6rem] leading-[1.03] font-extrabold tracking-tight text-balance sm:text-6xl">{p.frase || 'Clases de baile'}</h1>
            {p.intro && <p className="mt-3 max-w-xl text-base text-pretty text-white/80 sm:text-lg">{p.intro}</p>}
            <div ref={hero} className="mt-5 flex gap-2">
              {yo ? (
                <button type="button" onClick={volverAlPortal} className="flex h-14 flex-1 items-center justify-center gap-2 rounded-2xl bg-brand-500 px-6 text-lg font-bold text-white shadow-xl shadow-brand-500/30 active:scale-[0.98] sm:flex-none">
                  <ArrowLeft size={20} aria-hidden="true" /> Volver a mi portal
                </button>
              ) : (
                <a href="#inscribete" className="flex h-14 flex-1 items-center justify-center gap-2 rounded-2xl bg-brand-500 px-6 text-lg font-bold text-white shadow-xl shadow-brand-500/30 active:scale-[0.98] sm:flex-none">
                  Tu primera clase <ArrowRight size={20} aria-hidden="true" />
                </a>
              )}
              {wa && (
                <a href={wa} target="_blank" rel="noreferrer" aria-label="WhatsApp" className="flex h-14 w-14 shrink-0 items-center justify-center gap-2 rounded-2xl bg-white/10 font-bold text-white ring-1 ring-white/20 active:scale-[0.98] sm:w-auto sm:px-5">
                  <MessageCircle size={22} /> <span className="hidden sm:inline">WhatsApp</span>
                </a>
              )}
            </div>
            {!yo && <a href="#horarios" className="mt-1 inline-flex min-h-11 items-center text-sm font-semibold text-white underline underline-offset-4">Ver horarios</a>}
            {/* datos que dan confianza, calculados de la app */}
            <dl className="mt-4 grid max-w-md grid-cols-3 gap-3">
              <Dato valor={clasesPorSemana} texto="clases por semana" />
              <Dato valor={disciplinas.length} texto={disciplinas.length === 1 ? 'disciplina' : 'disciplinas'} />
              <Dato valor={sedes.length} texto={sedes.length === 1 ? 'sede' : 'sedes'} />
            </dl>
          </div>
        </div>
      </header>

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
          <div className="flex flex-wrap gap-3">
            {conSedes && (
              <label className="min-w-32 flex-1 text-xs font-semibold text-ink-700 sm:flex-none">
                Sede
                <select value={sede ?? ''} onChange={(e) => setSede(e.target.value || null)} className="mt-1 block h-11 w-full rounded-xl border border-ink-100 bg-superficie px-2 text-sm font-semibold">
                  {sedes.map((s) => <option key={s.id ?? 'principal'} value={s.id ?? ''}>{s.nombre}</option>)}
                </select>
              </label>
            )}
            {disciplinas.length > 1 && (
              <label className="min-w-32 flex-1 text-xs font-semibold text-ink-700 sm:flex-none">
                Disciplina
                <select value={disciplina ?? ''} onChange={(e) => setDisciplina(e.target.value || null)} className="mt-1 block h-11 w-full rounded-xl border border-ink-100 bg-superficie px-2 text-sm font-semibold">
                  <option value="">Todas</option>
                  {disciplinas.map(({ nombre }) => <option key={nombre}>{nombre}</option>)}
                </select>
              </label>
            )}
          </div>
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
          {cambiosHorario.length > 0 && (
            <div className="mt-4 space-y-1 rounded-2xl bg-warn-50 p-3 text-sm text-ink-800">
              <h3 className="font-bold">Cambios de horario</h3>
              {cambiosHorario.map(({ id, nombre, fecha, cambio }) => (
                <p key={id + fecha}>{fechaCorta(fecha)} · {nombre} · {'cancelada' in cambio ? 'Cancelada' : `${cambio.hora}${cambio.nombre_sede ? ` · ${cambio.nombre_sede}` : ''}`}</p>
              ))}
            </div>
          )}
          {clasesVista.length === 0 ? (
            <p className="mt-6 text-ink-500">Pronto publicaremos horarios aquí.</p>
          ) : (
            <Horario clases={clasesVista} sede={sede} estados={estados} onApartar={yo ? undefined : apartar} wa={(c, dd) => waCon(`Hola, quiero información de la clase de ${c.clase} (${DIAS_LARGOS[dd].toLowerCase()} ${c.hora}) en ${d.academia.nombre}.`)} />
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
                      detalle={x.tipo === 'mensual' ? (x.grupos ? (x.grupos === 1 ? 'Tu grupo fijo, todas sus clases del mes' : `${x.grupos} grupos a elegir, todas sus clases del mes`) : 'Todas las clases que quieras, todo el mes') : `${x.clases} clases · vigencia ${x.vigencia} días`}
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

        {/* ---------- dónde estamos ---------- */}
        {lugares.length > 0 && (
          <Seccion id="ubicacion" titulo="Dónde estamos">
            <div className="space-y-6">
              {lugares.map((l) => (
                <div key={l.nombre} className="pp-revela grid overflow-hidden rounded-3xl bg-superficie shadow-sm ring-1 ring-ink-100 md:grid-cols-[1fr_1fr]">
                  <div className="flex flex-col gap-3 p-5">
                    {lugares.length > 1 && <p className="text-xs font-extrabold tracking-widest text-brand-600 uppercase">{l.nombre}</p>}
                    <p className="flex gap-2 text-lg font-bold">
                      <MapPin size={20} className="mt-1 shrink-0 text-brand-600" /> {l.direccion}
                    </p>
                    {l.referencias && <p className="text-ink-500">{l.referencias}</p>}
                    <span className="flex-1" />
                    <a href={comoLlegar(l.direccion)} target="_blank" rel="noreferrer" className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-ink-900 font-bold text-ink-50 active:scale-[0.98]">
                      <Navigation size={18} /> Cómo llegar
                    </a>
                  </div>
                  <MapaLigero nombre={l.nombre} direccion={l.direccion} />
                </div>
              ))}
            </div>
          </Seccion>
        )}

        {/* ---------- preguntas ---------- */}
        {(p.preguntas?.length ?? 0) > 0 && (
          <Seccion id="preguntas" titulo="Preguntas frecuentes" fondo="superficie">
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

        {/* ---------- inscripción (no para quien ya es alumno) ---------- */}
        {!yo && (
        <section className="bg-panel text-white">
          <div className="mx-auto grid max-w-5xl gap-4 px-5 py-10 md:grid-cols-[1fr_1.1fr] md:items-start md:gap-8 md:py-14">
            <div ref={form} id="inscribete" className="scroll-mt-24 text-ink-900 md:order-2">
              <Inscripcion academia={d.academia.nombre} slug={slug} clases={opcionesClase} primera={primera} estados={estados} claseId={claseSel} onClase={setClaseSel} de={de} origen={origen} privacidad={privacidad} />
            </div>
            <div className="md:sticky md:top-24 md:order-1">
              {desdeCero && <ul className="hidden text-white/85 md:block"><Punto>Grupos desde cero, sin necesidad de pareja</Punto></ul>}
              {wa && (
                <a href={wa} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center gap-2 rounded-xl px-2 text-sm font-semibold text-white underline underline-offset-4 md:mt-3">
                  <MessageCircle size={18} aria-hidden="true" /> Preguntar por WhatsApp
                </a>
              )}
            </div>
          </div>
        </section>
        )}

        {/* ---------- comunidad: fotos y lo que dicen los alumnos ---------- */}
        {((p.galeria?.length ?? 0) > 0 || testimonios.length > 0) && (
          <Seccion id="comunidad" eyebrow="Comunidad" titulo="Así se vive la clase" fondo="superficie">
            <Comunidad galeria={p.galeria ?? []} testimonios={testimonios} creditos={p.creditos} />
          </Seccion>
        )}

        {/* ---------- eventos ---------- */}
        {d.eventos.length > 0 && (
          <Seccion eyebrow="Agenda" titulo="Próximos eventos" fondo="superficie">
            <ul className="grid gap-3 sm:grid-cols-2">
              {d.eventos.map((e, i) => {
                const [yy, mm, dd] = e.fecha.split('-').map(Number);
                const dia = DIA_EVENTO[new Date(yy, mm - 1, dd).getDay()];
                const wa = e.quedan !== 0 ? waCon(`Hola, quiero boletos para ${e.nombre} (${dia} ${dd} de ${MESES[mm - 1]}, ${e.hora}).`) : null;
                // igual que en el portal: flyer arriba, día de la semana en la fecha, lo urgente como etiqueta y
                // abajo una barra con el precio grande y "Quiero ir" (antes el precio iba en gris junto a la hora)
                return (
                  <li key={i} className="pp-revela flex flex-col overflow-hidden rounded-3xl bg-ink-50 ring-1 ring-ink-100">
                    {e.foto && <img src={e.foto} alt={`Flyer de ${e.nombre}`} loading="lazy" className="max-h-96 w-full bg-ink-100 object-contain" />}
                    <div className="flex flex-1 flex-col p-4">
                      <div className="flex gap-4">
                        <span className="flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-2xl bg-brand-500 text-white">
                          <span className="text-[10px] font-bold tracking-wider uppercase opacity-90">{dia}</span>
                          <span className="text-2xl leading-none font-extrabold">{dd}</span>
                          <span className="text-[10px] font-bold uppercase">{MESES[mm - 1]}</span>
                        </span>
                        <span className="min-w-0">
                          <span className="block text-lg leading-tight font-extrabold">{e.nombre}</span>
                          <span className="mt-0.5 block text-sm text-ink-500">{e.hora}</span>
                          {e.quedan !== null && e.quedan > 0 && e.quedan <= 20 && (
                            <span className="mt-1.5 inline-block rounded-full bg-warn-50 px-2.5 py-0.5 text-xs font-extrabold text-warn-600">¡Últimos {e.quedan} lugares!</span>
                          )}
                        </span>
                      </div>
                      <DetalleEvento e={e} />
                      <span className="flex-1" />
                      <span className="mt-3 flex items-center justify-between gap-3 rounded-2xl bg-superficie py-2 pr-2 pl-4 ring-1 ring-ink-100">
                        <span>
                          <span className="block text-lg leading-tight font-extrabold">{e.precio > 0 ? dinero(e.precio) : 'Gratis'}</span>
                          <span className="block text-xs text-ink-500">{e.precio > 0 ? 'boleto' : 'entrada libre'}</span>
                        </span>
                        {e.quedan === 0 ? (
                          <span className="rounded-full bg-bad-50 px-3 py-1 text-sm font-extrabold text-bad-600">Agotado</span>
                        ) : (
                          wa && (
                            <a href={wa} target="_blank" rel="noreferrer" className="flex min-h-11 items-center gap-2 rounded-xl bg-[#15803d] px-5 text-sm font-bold text-white active:scale-[0.98]">
                              <MessageCircle size={18} aria-hidden="true" /> Quiero ir
                            </a>
                          )
                        )}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          </Seccion>
        )}

        {/* ---------- tienda ----------
            Secundaria: la página es para que alguien se inscriba. Antes mostraba TODOS los productos (38 = un tercio
            de la página, empujando las preguntas y la inscripción). Ahora unos cuantos (con foto primero) y
            "Ver toda la tienda"; cada producto abre su detalle. Apartar es desde el portal del alumno. */}
        {d.tienda.length > 0 && <TiendaPublica productos={d.tienda} wa={waCon} />}

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
                <a key={r.red} href={r.url} target="_blank" rel="noreferrer" className="flex min-h-11 items-center gap-1.5 rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-white ring-1 ring-white/15 hover:bg-white/15">
                  <AtSign size={15} /> {NOMBRE_RED[r.red]}
                </a>
              ))}
            </div>
          )}
        </div>
        <p className="mx-auto mt-8 max-w-5xl px-5 text-xs text-white/60">
          © {new Date().getFullYear()} {d.academia.nombre} · <AvisoPrivacidad texto={privacidad} academia={d.academia.nombre} className="underline underline-offset-2 hover:text-white" />
          {!!p.reglamentos?.length && <> · <a href={`/a/${slug}?reglamentos`} className="underline underline-offset-2 hover:text-white">Consultar reglamentos</a></>}
          {' · Hecho con Compás'}
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
          {yo ? (
            <button type="button" onClick={volverAlPortal} tabIndex={verBarra ? 0 : -1} className="flex h-14 flex-1 items-center justify-center gap-2 rounded-2xl bg-brand-500 text-lg font-bold text-white shadow-xl shadow-brand-500/30 active:scale-[0.98]">
              <ArrowLeft size={20} aria-hidden="true" /> Volver a mi portal
            </button>
          ) : (
            <a href="#inscribete" tabIndex={verBarra ? 0 : -1} className="flex h-12 flex-1 items-center justify-center rounded-2xl bg-brand-500 text-base font-bold text-white shadow-xl shadow-brand-500/30 active:scale-[0.98]">
              Quiero mi primera clase
            </a>
          )}
          {wa && (
            <a href={wa} target="_blank" rel="noreferrer" tabIndex={verBarra ? 0 : -1} className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#15803d] text-white shadow-xl" aria-label="Escríbenos por WhatsApp">
              <MessageCircle size={24} />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

/** Tienda de la página: 4 en el celular y 8 en pantallas grandes a la vista; el resto con "Ver toda la tienda". */
function TiendaPublica({ productos, wa }: { productos: DatosPublica['tienda']; wa: (texto: string) => string | null }) {
  const [todos, setTodos] = useState(false);
  const [seleccionado, setSeleccionado] = useState<DatosPublica['tienda'][number] | null>(null);
  const [opcion, setOpcion] = useState<string | null>(null);
  // primero los que tienen foto (se ven mejor y suelen ser la ropa y accesorios), en su orden
  const orden = [...productos].sort((a, b) => Number(!a.foto) - Number(!b.foto));
  const enlace = seleccionado && wa(`Hola, me interesa ${seleccionado.nombre}${opcion ? ` (${opcion})` : ''} que vi en su página. ¿Me comparten la disponibilidad?`);
  return (
    <Seccion titulo="Tienda">
      {/* 4 columnas fijas en pantallas grandes: los 8 a la vista son 2 renglones completos (con 5 quedaba 5 + 3) */}
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {orden.map((x, i) => {
          const tarjeta = (
            <>
              <ImagenProducto foto={x.foto} tam="tarjeta" />
              <span className="mt-2 block text-sm font-bold">{x.nombre}</span>
              <span className="block text-sm font-extrabold text-brand-600">{dinero(x.precio)}</span>
              {x.sobre_pedido && <span className="block text-[11px] text-ink-500">Sobre pedido</span>}
            </>
          );
          return (
            <li key={i} className={cx(!todos && i >= 8 && 'hidden', !todos && i >= 4 && 'max-sm:hidden')}>
              <button
                type="button"
                className="flex h-full w-full flex-col items-stretch rounded-3xl bg-superficie p-3 text-center shadow-sm ring-1 ring-ink-100 active:scale-[0.98]"
                aria-label={`Ver ${x.nombre}, ${dinero(x.precio)}`}
                onClick={() => {
                  setOpcion(null);
                  setSeleccionado(x);
                }}
              >
                {tarjeta}
              </button>
            </li>
          );
        })}
      </ul>
      {productos.length > 4 && (
        <button
          type="button"
          onClick={() => setTodos(!todos)}
          className={cx('mt-3 min-h-11 w-full rounded-2xl text-sm font-bold text-brand-600 ring-1 ring-ink-100 active:bg-ink-50', productos.length <= 8 && 'sm:hidden')}
        >
          {todos ? 'Ver menos' : `Ver toda la tienda (${productos.length})`}
        </button>
      )}
      <p className="mt-3 flex items-center gap-1.5 text-sm text-ink-500">
        <ShoppingBag size={16} aria-hidden="true" /> ¿Ya eres alumno? Puedes apartar o encargar desde Mi pase.
      </p>
      <Hoja abierta={!!seleccionado} onCerrar={() => setSeleccionado(null)} titulo={seleccionado?.nombre}>
        {seleccionado && (
          <div className="space-y-3">
            <ImagenProducto foto={seleccionado.foto} tam={seleccionado.foto ? 224 : 64} ajustar className="mx-auto max-w-full" />
            <p className="text-lg font-extrabold text-brand-600">{dinero(seleccionado.precio)}</p>
            <p className="text-sm text-ink-700">
              {seleccionado.sobre_pedido ? 'Sobre pedido. Pregunta por el plazo de entrega.' : 'Consulta disponibilidad antes de pasar por el producto.'}
            </p>
            {seleccionado.descripcion && <p className="whitespace-pre-line break-words text-sm text-ink-700">{seleccionado.descripcion}</p>}
            {seleccionado.opciones.length > 0 && (
              <div role="group" aria-label="Talla o color">
                <p className="mb-2 text-sm font-semibold text-ink-700">{enlace ? 'Talla o color (opcional)' : 'Tallas y colores'}</p>
                <div className="flex flex-wrap gap-2">
                  {seleccionado.opciones.map((variante) => enlace ? (
                    <button
                      key={variante}
                      type="button"
                      aria-pressed={opcion === variante}
                      className={cx('min-h-11 rounded-xl px-3 text-sm font-semibold ring-1', opcion === variante ? 'bg-brand-500 text-white ring-brand-500' : 'bg-superficie ring-ink-100')}
                      onClick={() => setOpcion(opcion === variante ? null : variante)}
                    >
                      {variante}
                    </button>
                  ) : (
                    <span key={variante} className="rounded-xl bg-superficie px-3 py-2 text-sm ring-1 ring-ink-100">{variante}</span>
                  ))}
                </div>
              </div>
            )}
            {enlace && (
              <a href={enlace} target="_blank" rel="noreferrer" className="flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-[#15803d] px-4 font-bold text-white active:scale-[0.98]">
                <MessageCircle size={20} aria-hidden="true" /> Consultar por WhatsApp
              </a>
            )}
          </div>
        )}
      </Hoja>
    </Seccion>
  );
}

const DIA_EVENTO = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
