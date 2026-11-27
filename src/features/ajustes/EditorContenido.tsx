import { useEffect, useRef, useState, type ReactNode } from 'react';
import { avisoPrivacidadBase } from '../../domain/privacidad';
import { Link } from 'react-router-dom';
import { useAvisarSiSale } from '../../app/sinGuardar';
import { ChevronDown, ImagePlus, Plus, Trash2 } from 'lucide-react';
import { prepararFotoGaleria, prepararPortada } from '../../app/fotos';
import { nombreSede, useSedes } from '../../app/sedes';
import { useSesion } from '../../app/sesion';
import { useAvisos } from '../../components/avisos';
import { Boton, Campo, Entrada, Tarjeta, cx } from '../../components/ui';
import { actualizar } from '../../db/repo';
import type { ContenidoPagina } from '../../db/types';
import { esTestimonioDeEjemplo, PREGUNTAS_SUGERIDAS, REDES, NOMBRE_RED } from '../../domain/publica';

const areaTexto =
  'w-full rounded-xl bg-superficie px-4 py-3 ring-1 ring-ink-100 outline-none focus:ring-2 focus:ring-brand-500 placeholder:text-ink-300 resize-y';

/** Fotos de la galería: pocas y ligeras (viajan con la academia a todos los equipos). */
const MAX_GALERIA = 8;

/** Quita lo vacío para no guardar basura (y que "sin cambios" se compare bien). */
function limpio(c: ContenidoPagina): ContenidoPagina {
  const o: ContenidoPagina = {};
  if (c.frase?.trim()) o.frase = c.frase.trim();
  if (c.intro?.trim()) o.intro = c.intro.trim();
  if (c.portada) o.portada = c.portada;
  if (c.primera?.trim()) o.primera = c.primera.trim();
  const ub = Object.entries(c.ubicaciones ?? {}).filter(([, u]) => u.direccion.trim());
  if (ub.length) o.ubicaciones = Object.fromEntries(ub.map(([k, u]) => [k, { direccion: u.direccion.trim(), ...(u.referencias?.trim() ? { referencias: u.referencias.trim() } : {}) }]));
  const pr = (c.preguntas ?? []).filter((x) => x.p.trim() && x.r.trim()).map((x) => ({ p: x.p.trim(), r: x.r.trim() }));
  if (pr.length) o.preguntas = pr;
  const redes = Object.fromEntries(Object.entries(c.redes ?? {}).filter(([, v]) => v?.trim()).map(([k, v]) => [k, v!.trim()]));
  if (Object.keys(redes).length) o.redes = redes;
  if (c.galeria?.length) o.galeria = c.galeria.slice(0, MAX_GALERIA);
  if (c.creditos?.trim()) o.creditos = c.creditos.trim();
  const te = (c.testimonios ?? []).filter((x) => x.texto.trim() && x.nombre.trim()).map((x) => ({ texto: x.texto.trim(), nombre: x.nombre.trim(), ...(x.detalle?.trim() ? { detalle: x.detalle.trim() } : {}), ...(x.testimonioId ? { testimonioId: x.testimonioId } : {}) }));
  if (te.length) o.testimonios = te;
  if (c.privacidad?.trim()) o.privacidad = c.privacidad.trim();
  const reglamentos = (c.reglamentos ?? [])
    .filter((r) => r.titulo.trim() && r.texto.trim())
    .map((r) => ({ id: r.id, titulo: r.titulo.trim(), texto: r.texto.trim() }));
  if (reglamentos.length) o.reglamentos = reglamentos;
  return o;
}

/**
 * Contenido de la página pública: lo que convence a alguien de venir (portada, primera clase,
 * dónde estamos, preguntas frecuentes y redes). Horarios, precios y eventos salen solos de la app.
 */
/** Lo que el editor de la página agrega al mismo guardado: dirección de la página y WhatsApp. */
export interface EnlaceYWhats {
  /** "calo-latino · WhatsApp 55 1234 5678" (lo que se ve con la sección cerrada) */
  resumen: string;
  cambios: boolean;
  valido: boolean;
  guardar: () => Promise<void>;
  campos: ReactNode;
}

export function EditorContenido({ enlace }: { enlace?: EnlaceYWhats }) {
  const { academia } = useSesion();
  const avisar = useAvisos();
  const sedes = useSedes();
  const guardado = limpio(academia.pagina ?? {});
  const [c, setC] = useState<ContenidoPagina>(() => ({ ...guardado, preguntas: guardado.preguntas ?? PREGUNTAS_SUGERIDAS.map((x) => ({ ...x })) }));
  const [ocupado, setOcupado] = useState(false);
  const [reglamentoAbierto, setReglamentoAbierto] = useState<string | null>(null);
  const [testimonioAbierto, setTestimonioAbierto] = useState<number | null>(null);
  const testimonios = c.testimonios ?? [];
  const visibles = testimonios.filter((t) => t.texto.trim() && t.nombre.trim() && !esTestimonioDeEjemplo(t.nombre)).length;
  const archivo = useRef<HTMLInputElement>(null);
  const galeria = useRef<HTMLInputElement>(null);
  const cambiosContenido = JSON.stringify(limpio(c)) !== JSON.stringify(guardado);
  const cambios = cambiosContenido || !!enlace?.cambios;
  const reglamentos = c.reglamentos ?? [];
  const reglamentosCompletos = reglamentos.every((r) => r.titulo.trim() && r.texto.trim());
  const valido = (enlace?.valido ?? true) && reglamentosCompletos;
  // "editó algo": las preguntas sugeridas que se precargan cuentan para Guardar, pero no para avisar al salir
  const [inicial] = useState(() => JSON.stringify(limpio(c)));
  const editado = !reglamentosCompletos || (cambiosContenido && JSON.stringify(limpio(c)) !== inicial);
  // con cambios sin guardar: pregunta antes de salir por un enlace de la app o al cerrar la pestaña
  // y, por si sale con el botón atrás del teléfono o se cierra la app, un borrador en este teléfono
  const claveBorrador = `compas:borradorPagina:${academia.id}`;
  const avisoSalir = useAvisarSiSale(editado || !!enlace?.cambios, 'los cambios de tu página', () => {
    try {
      localStorage.removeItem(claveBorrador);
    } catch {
      /* nada */
    }
  });
  const [borrador, setBorrador] = useState<ContenidoPagina | null>(() => {
    try {
      const b = localStorage.getItem(claveBorrador);
      const x = b ? (JSON.parse(b) as ContenidoPagina) : null;
      return x && JSON.stringify(limpio(x)) !== JSON.stringify(guardado) ? x : null;
    } catch {
      return null;
    }
  });
  useEffect(() => {
    if (borrador) return; // primero que decida si lo recupera
    const t = setTimeout(() => {
      try {
        if (editado) localStorage.setItem(claveBorrador, JSON.stringify(c));
        else localStorage.removeItem(claveBorrador);
      } catch {
        /* sin espacio: solo queda el aviso al salir */
      }
    }, 600);
    return () => clearTimeout(t);
  }, [c, editado, borrador, claveBorrador]);
  const pon = (p: Partial<ContenidoPagina>) => setC((x) => ({ ...x, ...p }));
  const lugares = [{ clave: 'principal', nombre: nombreSede(null, sedes, academia) }, ...sedes.map((s) => ({ clave: s.id, nombre: s.nombre }))];
  const preguntas = c.preguntas ?? [];
  // cada sección cerrada muestra su resumen: así la página entera cabe en una pantalla, como un menú
  const [abiertas, setAbiertas] = useState<string[]>([]);
  const abrir = (id: string) => setAbiertas((a) => (a.includes(id) ? a.filter((x) => x !== id) : [...a, id]));
  const conDireccion = lugares.filter((l) => c.ubicaciones?.[l.clave]?.direccion?.trim()).length;
  const redes = REDES.filter((r) => c.redes?.[r]?.trim());
  const n = (k: number, uno: string, varios: string) => `${k} ${k === 1 ? uno : varios}`;
  const plegable = (id: string) => ({ abierta: abiertas.includes(id), onAbrir: () => abrir(id) });

  return (
    <div className="rounded-3xl bg-superficie px-4 ring-1 ring-ink-100">
      {avisoSalir}
      {borrador && (
        <div className="-mx-4 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-t-3xl bg-warn-50 px-4 py-3 text-sm text-warn-600">
          <span className="min-w-48 flex-1 font-semibold">Tienes cambios sin guardar de la última vez.</span>
          <span className="ml-auto flex gap-2">
            <Boton
              variante="secundario"
              onClick={() => {
                try {
                  localStorage.removeItem(claveBorrador);
                } catch {
                  /* nada */
                }
                setBorrador(null);
              }}
            >
              Descartar
            </Boton>
            <Boton
              onClick={() => {
                setC(borrador);
                setBorrador(null);
              }}
            >
              Recuperar
            </Boton>
          </span>
        </div>
      )}
      <Bloque id="portada" {...plegable('portada')} resumen={c.portada ? (c.frase ? `Foto · “${c.frase}”` : 'Foto · falta la frase') : 'Falta la foto de portada'} falta={!c.portada} titulo="Portada" ayuda="Lo primero que ve la gente. Una foto de una clase con ambiente funciona mejor que el logo.">
        <div className="overflow-hidden rounded-2xl bg-ink-100 ring-1 ring-ink-100">
          {c.portada ? <img src={c.portada} alt="Foto de portada" className="aspect-[16/9] w-full object-cover" /> : <div className="flex aspect-[16/9] items-center justify-center text-sm text-ink-500">Sin foto de portada</div>}
        </div>
        <div className="flex gap-2">
          <Boton variante="secundario" className="flex-1" onClick={() => archivo.current?.click()}>
            <ImagePlus size={18} /> {c.portada ? 'Cambiar foto' : 'Subir foto'}
          </Boton>
          {c.portada && (
            <Boton variante="fantasma" onClick={() => pon({ portada: null })} aria-label="Quitar foto de portada">
              <Trash2 size={18} className="text-bad-600" />
            </Boton>
          )}
        </div>
        <input
          ref={archivo}
          type="file"
          accept="image/*"
          hidden
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (!f) return;
            try {
              pon({ portada: await prepararPortada(f) });
            } catch (err) {
              avisar(err instanceof Error ? err.message : 'No se pudo usar esa foto', 'error');
            }
          }}
        />
        <Campo etiqueta="Frase principal">
          <Entrada value={c.frase ?? ''} onChange={(e) => pon({ frase: e.target.value })} maxLength={80} placeholder="Aprende a bailar salsa y bachata" />
        </Campo>
        <Campo etiqueta="Texto corto (opcional)">
          <textarea className={areaTexto} rows={2} value={c.intro ?? ''} onChange={(e) => pon({ intro: e.target.value })} maxLength={240} placeholder="Clases para todos los niveles, desde cero. Ambiente familiar y mucho sabor." />
        </Campo>
        <Campo etiqueta="Tu primera clase" ayuda="Aparece junto al botón para inscribirse. Vacío: muestra el precio de la clase suelta.">
          <Entrada value={c.primera ?? ''} onChange={(e) => pon({ primera: e.target.value })} maxLength={80} placeholder="Ej. Tu primera clase es gratis" />
        </Campo>
      </Bloque>

      <Bloque id="galeria" {...plegable('galeria')} resumen={(c.galeria?.length ?? 0) ? n(c.galeria!.length, 'foto', 'fotos') : 'Sin fotos todavía'} falta={!(c.galeria?.length ?? 0)} titulo="Galería" ayuda={`Fotos de clases y eventos (hasta ${MAX_GALERIA}). A la gente le gusta ver el ambiente: grupos, parejas bailando, eventos.`}>
        {(c.galeria?.length ?? 0) > 0 && (
          <div className="grid grid-cols-3 gap-2">
            {c.galeria!.map((f, i) => (
              <div key={i} className="relative">
                <img src={f} alt={`Foto ${i + 1} de la galería`} className="aspect-square w-full rounded-xl object-cover" />
                <button
                  onClick={() => pon({ galeria: c.galeria!.filter((_, j) => j !== i) })}
                  className="absolute top-1 right-1 rounded-full bg-black/60 p-1.5 text-white"
                  aria-label={`Quitar foto ${i + 1}`}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
        {(c.galeria?.length ?? 0) < MAX_GALERIA && (
          <Boton variante="secundario" bloque onClick={() => galeria.current?.click()}>
            <ImagePlus size={18} /> Agregar fotos
          </Boton>
        )}
        <input
          ref={galeria}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={async (e) => {
            const archivos = [...(e.target.files ?? [])];
            e.target.value = '';
            try {
              const nuevas = await Promise.all(archivos.slice(0, MAX_GALERIA - (c.galeria?.length ?? 0)).map(prepararFotoGaleria));
              setC((x) => ({ ...x, galeria: [...(x.galeria ?? []), ...nuevas] }));
            } catch (err) {
              avisar(err instanceof Error ? err.message : 'No se pudo usar esa foto', 'error');
            }
          }}
        />
        <Campo etiqueta="Créditos de las fotos (solo si no son tuyas)" ayuda="Algunas licencias piden nombrar al autor. Si las fotos son tuyas, déjalo vacío.">
          <Entrada value={c.creditos ?? ''} onChange={(e) => pon({ creditos: e.target.value })} placeholder="Ej. Fotos: Ana Pérez (CC BY-SA 4.0)" />
        </Campo>
      </Bloque>

      <Bloque id="testimonios" {...plegable('testimonios')} resumen={n(visibles, 'visible al guardar', 'visibles al guardar')} falta={!visibles} titulo="Testimonios" ayuda="Edita las citas que se muestran en el sitio. Los testimonios enviados por alumnos se revisan en la bandeja de Testimonios.">
        <Link to="/alumnos/testimonios" className="inline-flex min-h-11 items-center text-sm font-semibold text-brand-600">Ir a la bandeja de Testimonios</Link>
        {(c.testimonios ?? []).map((x, i) => {
          const lista = c.testimonios ?? [];
          const ponT = (p: Partial<typeof x>) => pon({ testimonios: lista.map((y, j) => (j === i ? { ...y, ...p } : y)) });
          return (
            <Tarjeta key={i} className="p-3">
              <button type="button" aria-expanded={testimonioAbierto === i} onClick={() => setTestimonioAbierto(testimonioAbierto === i ? null : i)} className="flex min-h-11 w-full items-center justify-between gap-2 text-left">
                <span className="min-w-0">
                  <span className="block break-words text-sm font-semibold">{x.nombre || 'Nuevo testimonio'}</span>
                  <span className="block text-xs text-ink-500">{esTestimonioDeEjemplo(x.nombre) ? 'Ejemplo oculto en el sitio' : !x.texto.trim() || !x.nombre.trim() ? 'Falta completar' : x.texto.slice(0, 72) + (x.texto.length > 72 ? '…' : '')}</span>
                </span>
                <ChevronDown size={16} aria-hidden="true" className={cx('shrink-0 text-ink-500', testimonioAbierto === i && 'rotate-180')} />
              </button>
              {testimonioAbierto === i && <div className="mt-2 space-y-2">
              <textarea className={areaTexto} rows={4} value={x.texto} onChange={(e) => ponT({ texto: e.target.value })} maxLength={240} placeholder="¿Qué dijo?" aria-label={`Testimonio ${i + 1}`} />
              <div className="flex items-center gap-2">
                <Entrada value={x.nombre} onChange={(e) => ponT({ nombre: e.target.value })} placeholder="Nombre" aria-label={`Nombre ${i + 1}`} />
                <Entrada value={x.detalle ?? ''} onChange={(e) => ponT({ detalle: e.target.value })} placeholder="Ej. Alumna de bachata" aria-label={`Detalle ${i + 1}`} />
                <button type="button" onClick={() => { pon({ testimonios: lista.filter((_, j) => j !== i) }); setTestimonioAbierto(null); }} className="rounded-xl p-3 text-ink-500 active:bg-ink-100" aria-label={`Quitar testimonio ${i + 1}`}>
                  <Trash2 size={18} />
                </button>
              </div>
              </div>}
            </Tarjeta>
          );
        })}
        <Boton variante="secundario" bloque onClick={() => { setTestimonioAbierto(testimonios.length); pon({ testimonios: [...testimonios, { texto: '', nombre: '' }] }); }}>
          <Plus size={18} /> Agregar testimonio
        </Boton>
      </Bloque>

      <Bloque id="ubicacion" {...plegable('ubicacion')} resumen={conDireccion === lugares.length ? (lugares.length > 1 ? 'Todas con dirección' : 'Con dirección') : `${conDireccion} de ${lugares.length} con dirección`} falta={!c.ubicaciones?.principal?.direccion?.trim()} titulo="Dónde estamos" ayuda="Con la dirección aparece el mapa y el botón “Cómo llegar”.">
        <p className="rounded-xl bg-ink-50 px-3 py-2 text-xs text-ink-500">
          Los lugares son tus sedes. ¿Das clases en otro lugar? Agrégalo en{' '}
          <Link to="/ajustes/sedes" state={{ desdeAjustes: true }} className="font-semibold text-brand-600 underline underline-offset-2">
            Sedes
          </Link>
          . Si dejas la dirección vacía, ese lugar no se muestra.
        </p>
        {lugares.map((l) => {
          const u = c.ubicaciones?.[l.clave] ?? { direccion: '' };
          const ponU = (p: Partial<typeof u>) => pon({ ubicaciones: { ...(c.ubicaciones ?? {}), [l.clave]: { ...u, ...p } } });
          return (
            <div key={l.clave} className="space-y-2">
              {lugares.length > 1 && <p className="text-sm font-bold">{l.nombre}</p>}
              <Campo etiqueta="Dirección">
                <Entrada value={u.direccion} onChange={(e) => ponU({ direccion: e.target.value })} placeholder="Calle, número, colonia, ciudad" />
              </Campo>
              <Campo etiqueta="Referencias (opcional)">
                <Entrada value={u.referencias ?? ''} onChange={(e) => ponU({ referencias: e.target.value })} placeholder="Ej. Segundo piso, junto a la farmacia. Hay estacionamiento." />
              </Campo>
            </div>
          );
        })}
      </Bloque>

      <Bloque id="preguntas" {...plegable('preguntas')} resumen={preguntas.length ? n(preguntas.length, 'pregunta', 'preguntas') : 'Ninguna'} titulo="Preguntas frecuentes" ayuda="Las dudas que frenan a quien nunca ha venido. Revisa que las respuestas sean ciertas para tu academia.">
        {preguntas.map((x, i) => (
          <Tarjeta key={i} className="space-y-2 p-3">
            <div className="flex items-center gap-2">
              <Entrada value={x.p} onChange={(e) => pon({ preguntas: preguntas.map((y, j) => (j === i ? { ...y, p: e.target.value } : y)) })} placeholder="Pregunta" aria-label={`Pregunta ${i + 1}`} className="font-semibold" />
              <button onClick={() => pon({ preguntas: preguntas.filter((_, j) => j !== i) })} className="rounded-xl p-3 text-ink-500 active:bg-ink-100" aria-label={`Quitar pregunta ${i + 1}`}>
                <Trash2 size={18} />
              </button>
            </div>
            <textarea className={areaTexto} rows={2} value={x.r} onChange={(e) => pon({ preguntas: preguntas.map((y, j) => (j === i ? { ...y, r: e.target.value } : y)) })} placeholder="Respuesta" aria-label={`Respuesta ${i + 1}`} />
          </Tarjeta>
        ))}
        <Boton variante="secundario" bloque onClick={() => pon({ preguntas: [...preguntas, { p: '', r: '' }] })}>
          <Plus size={18} /> Agregar pregunta
        </Boton>
      </Bloque>

      <Bloque id="redes" {...plegable('redes')} resumen={redes.length ? redes.map((r) => NOMBRE_RED[r]).join(', ') : 'Ninguna'} titulo="Redes sociales" ayuda="Tu usuario (@calolatino) o el enlace completo. La que dejes vacía no aparece en tu página.">
        {REDES.map((r) => (
          <Campo key={r} etiqueta={NOMBRE_RED[r]}>
            <Entrada value={c.redes?.[r] ?? ''} onChange={(e) => pon({ redes: { ...(c.redes ?? {}), [r]: e.target.value } })} placeholder={r === 'youtube' ? '@canal' : '@usuario'} autoCapitalize="off" />
          </Campo>
        ))}
      </Bloque>

      <Bloque id="reglamentos" {...plegable('reglamentos')} resumen={reglamentos.length ? n(reglamentos.length, 'reglamento', 'reglamentos') : 'Sin reglamentos'} titulo="Reglamentos" ayuda="Agrega un reglamento por modalidad. Al guardar, los alumnos podrán consultarlos desde la página pública y su pase.">
        {reglamentos.map((r) => {
          const abierto = reglamentoAbierto === r.id;
          return (
            <div key={r.id} className="rounded-xl bg-ink-50">
              <button type="button" aria-expanded={abierto} onClick={() => setReglamentoAbierto(abierto ? null : r.id)} className="flex min-h-11 w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm font-semibold">
                <span className="min-w-0 break-words">{r.titulo.trim() || 'Nuevo reglamento'}</span>
                <ChevronDown size={16} aria-hidden="true" className={cx('shrink-0 text-ink-500', abierto && 'rotate-180')} />
              </button>
              {abierto && <div className="space-y-2 px-3 pb-3">
                <Campo etiqueta="Modalidad">
                  <Entrada value={r.titulo} placeholder="Ej. Salsa Casino" onChange={(e) => pon({ reglamentos: reglamentos.map((a) => a.id === r.id ? { ...a, titulo: e.target.value } : a) })} />
                </Campo>
                <Campo etiqueta="Texto del reglamento">
                  <textarea value={r.texto} rows={9} className={areaTexto} onChange={(e) => pon({ reglamentos: reglamentos.map((a) => a.id === r.id ? { ...a, texto: e.target.value } : a) })} />
                </Campo>
                <Boton variante="fantasma" onClick={() => {
                  pon({ reglamentos: reglamentos.filter((a) => a.id !== r.id) });
                  setReglamentoAbierto(null);
                }}>
                  <Trash2 size={16} aria-hidden="true" /> Quitar reglamento
                </Boton>
              </div>}
            </div>
          );
        })}
        <Boton variante="secundario" onClick={() => {
          const id = crypto.randomUUID();
          pon({ reglamentos: [...reglamentos, { id, titulo: '', texto: '' }] });
          setReglamentoAbierto(id);
        }}>
          <Plus size={16} aria-hidden="true" /> Agregar reglamento
        </Boton>
        {!reglamentosCompletos && <p className="text-sm text-warn-600">Completa la modalidad y el texto de cada reglamento para guardar.</p>}
      </Bloque>

      <Bloque id="privacidad" {...plegable('privacidad')} resumen={c.privacidad?.trim() ? 'Personalizado' : 'Usa la base general'} titulo="Aviso de privacidad" ayuda="Obligatorio en México porque la página pide nombre y teléfono. Si lo dejas vacío se usa una base general con el nombre y el WhatsApp de tu academia. Revísalo, de preferencia con quien lleve tus asuntos legales.">
        <textarea
          className={areaTexto}
          rows={8}
          value={c.privacidad ?? ''}
          onChange={(e) => pon({ privacidad: e.target.value })}
          maxLength={4000}
          placeholder={avisoPrivacidadBase({ academia: academia.nombre, direccion: c.ubicaciones?.principal?.direccion, whatsapp: academia.whatsapp })}
          aria-label="Aviso de privacidad"
        />
        {!c.privacidad?.trim() && (
          <Boton
            variante="secundario"
            bloque
            onClick={() => pon({ privacidad: avisoPrivacidadBase({ academia: academia.nombre, direccion: c.ubicaciones?.principal?.direccion, whatsapp: academia.whatsapp }) })}
          >
            Usar la base para editarla
          </Boton>
        )}
      </Bloque>

      {enlace && (
        <Bloque id="enlace" {...plegable('enlace')} resumen={enlace.resumen} titulo="Enlace y WhatsApp" ayuda="Casi nunca se cambian. Si cambias la dirección, los enlaces que ya compartiste dejan de funcionar.">
          {enlace.campos}
        </Bloque>
      )}

      {/* un solo botón para todo (antes "Guardar cambios" arriba y "Guardar contenido" abajo: era fácil perder un cambio).
          Aparece solo cuando hay algo por guardar: así también avisa "tienes cambios sin guardar" */}
      {cambios && (
      <div className="sticky bottom-0 -mx-1 animate-sube bg-gradient-to-t from-superficie via-superficie to-transparent px-1 pt-4 pb-3">
        <Boton
          grande
          bloque
          disabled={!cambios || !valido || ocupado}
          onClick={async () => {
            setOcupado(true);
            try {
              if (enlace?.cambios) await enlace.guardar();
              if (cambiosContenido) await actualizar('academias', academia.id, { pagina: limpio(c) });
              try {
                localStorage.removeItem(claveBorrador);
              } catch {
                /* nada */
              }
              avisar('Página actualizada');
            } finally {
              setOcupado(false);
            }
          }}
        >
          {!valido ? 'Revisa el enlace o el WhatsApp' : 'Guardar cambios'}
        </Boton>
      </div>
      )}
    </div>
  );
}



/**
 * Una sección del editor: cerrada muestra su título y un resumen ("6 fotos", "Falta la foto de portada"); al
 * tocarla se abre ahí mismo. Antes todo estaba abierto (≈7,000 px de página) con atajos para saltar.
 */
function Bloque({
  id,
  titulo,
  ayuda,
  resumen,
  falta,
  abierta,
  onAbrir,
  children,
}: {
  id: string;
  titulo: string;
  ayuda?: string;
  resumen: string;
  falta?: boolean;
  abierta: boolean;
  onAbrir: () => void;
  children: ReactNode;
}) {
  return (
    <section id={`seccion-${id}`} className="scroll-mt-20 border-t border-ink-100">
      <button type="button" onClick={onAbrir} aria-expanded={abierta} className="flex min-h-16 w-full items-center gap-3 py-3 text-left active:bg-ink-50">
        <span className="min-w-0 flex-1">
          <span className="block text-base font-extrabold">{titulo}</span>
          <span className={cx('block truncate text-sm', falta ? 'font-semibold text-warn-600' : 'text-ink-500')}>{resumen}</span>
        </span>
        <ChevronDown size={20} className={cx('shrink-0 text-ink-300 transition', abierta && 'rotate-180')} aria-hidden="true" />
      </button>
      {abierta && (
        <div className="space-y-3 pb-5">
          {ayuda && <p className="text-xs text-ink-500">{ayuda}</p>}
          {children}
        </div>
      )}
    </section>
  );
}
