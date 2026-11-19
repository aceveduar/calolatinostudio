import { useRef, useState, type ReactNode } from 'react';
import { avisoPrivacidadBase } from '../../domain/privacidad';
import { ImagePlus, Plus, Trash2 } from 'lucide-react';
import { prepararFotoGaleria, prepararPortada } from '../../app/fotos';
import { nombreSede, useSedes } from '../../app/sedes';
import { useSesion } from '../../app/sesion';
import { useAvisos } from '../../components/avisos';
import { Boton, Campo, Entrada, Tarjeta, cx } from '../../components/ui';
import { actualizar } from '../../db/repo';
import type { ContenidoPagina } from '../../db/types';
import { PREGUNTAS_SUGERIDAS } from '../../domain/publica';

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
  const te = (c.testimonios ?? []).filter((x) => x.texto.trim() && x.nombre.trim()).map((x) => ({ texto: x.texto.trim(), nombre: x.nombre.trim(), ...(x.detalle?.trim() ? { detalle: x.detalle.trim() } : {}) }));
  if (te.length) o.testimonios = te;
  if (c.privacidad?.trim()) o.privacidad = c.privacidad.trim();
  return o;
}

/**
 * Contenido de la página pública: lo que convence a alguien de venir (portada, primera clase,
 * dónde estamos, preguntas frecuentes y redes). Horarios, precios y eventos salen solos de la app.
 */
export function EditorContenido() {
  const { academia } = useSesion();
  const avisar = useAvisos();
  const sedes = useSedes();
  const guardado = limpio(academia.pagina ?? {});
  const [c, setC] = useState<ContenidoPagina>(() => ({ ...guardado, preguntas: guardado.preguntas ?? PREGUNTAS_SUGERIDAS.map((x) => ({ ...x })) }));
  const [ocupado, setOcupado] = useState(false);
  const archivo = useRef<HTMLInputElement>(null);
  const galeria = useRef<HTMLInputElement>(null);
  const cambios = JSON.stringify(limpio(c)) !== JSON.stringify(guardado);
  const pon = (p: Partial<ContenidoPagina>) => setC((x) => ({ ...x, ...p }));
  const lugares = [{ clave: 'principal', nombre: nombreSede(null, sedes, academia) }, ...sedes.map((s) => ({ clave: s.id, nombre: s.nombre }))];
  const preguntas = c.preguntas ?? [];

  return (
    <div className="space-y-5">
      <Bloque titulo="Portada" ayuda="Lo primero que ve la gente. Una foto de una clase con ambiente funciona mejor que el logo.">
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

      <Bloque titulo="Dónde estamos" ayuda="Con la dirección aparece el mapa y el botón “Cómo llegar”.">
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

      <Bloque titulo="Preguntas frecuentes" ayuda="Las dudas que frenan a quien nunca ha venido. Revisa que las respuestas sean ciertas para tu academia.">
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

      <Bloque titulo="Galería" ayuda={`Fotos de clases y eventos (hasta ${MAX_GALERIA}). A la gente le gusta ver el ambiente: grupos, parejas bailando, eventos.`}>
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
      </Bloque>

      <Campo etiqueta="Créditos de las fotos (solo si no son tuyas)" ayuda="Algunas licencias piden nombrar al autor. Si las fotos son tuyas, déjalo vacío.">
        <Entrada value={c.creditos ?? ''} onChange={(e) => pon({ creditos: e.target.value })} placeholder="Ej. Fotos: Ana Pérez (CC BY-SA 4.0)" />
      </Campo>

      <Bloque titulo="Testimonios" ayuda="Lo que dicen tus alumnos (por ejemplo, de tus reseñas de Facebook). Es lo que más confianza da a quien no te conoce.">
        {(c.testimonios ?? []).map((x, i) => {
          const lista = c.testimonios ?? [];
          const ponT = (p: Partial<typeof x>) => pon({ testimonios: lista.map((y, j) => (j === i ? { ...y, ...p } : y)) });
          return (
            <Tarjeta key={i} className="space-y-2 p-3">
              <textarea className={areaTexto} rows={2} value={x.texto} onChange={(e) => ponT({ texto: e.target.value })} maxLength={240} placeholder="¿Qué dijo?" aria-label={`Testimonio ${i + 1}`} />
              <div className="flex items-center gap-2">
                <Entrada value={x.nombre} onChange={(e) => ponT({ nombre: e.target.value })} placeholder="Nombre" aria-label={`Nombre ${i + 1}`} />
                <Entrada value={x.detalle ?? ''} onChange={(e) => ponT({ detalle: e.target.value })} placeholder="Ej. Alumna de bachata" aria-label={`Detalle ${i + 1}`} />
                <button onClick={() => pon({ testimonios: lista.filter((_, j) => j !== i) })} className="rounded-xl p-3 text-ink-500 active:bg-ink-100" aria-label={`Quitar testimonio ${i + 1}`}>
                  <Trash2 size={18} />
                </button>
              </div>
            </Tarjeta>
          );
        })}
        <Boton variante="secundario" bloque onClick={() => pon({ testimonios: [...(c.testimonios ?? []), { texto: '', nombre: '' }] })}>
          <Plus size={18} /> Agregar testimonio
        </Boton>
      </Bloque>

      <Bloque titulo="Redes sociales" ayuda="Tu usuario (@calolatino) o el enlace completo.">
        {(['instagram', 'facebook', 'tiktok'] as const).map((r) => (
          <Campo key={r} etiqueta={{ instagram: 'Instagram', facebook: 'Facebook', tiktok: 'TikTok' }[r]}>
            <Entrada value={c.redes?.[r] ?? ''} onChange={(e) => pon({ redes: { ...(c.redes ?? {}), [r]: e.target.value } })} placeholder="@usuario" autoCapitalize="off" />
          </Campo>
        ))}
      </Bloque>

      <Bloque titulo="Aviso de privacidad" ayuda="Obligatorio en México porque la página pide nombre y teléfono. Si lo dejas vacío se usa una base general con el nombre y el WhatsApp de tu academia. Revísalo, de preferencia con quien lleve tus asuntos legales.">
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

      <div className="sticky bottom-0 -mx-1 bg-gradient-to-t from-ink-50 via-ink-50 to-transparent px-1 pt-4 pb-2">
        <Boton
          grande
          bloque
          disabled={!cambios || ocupado}
          onClick={async () => {
            setOcupado(true);
            try {
              await actualizar('academias', academia.id, { pagina: limpio(c) });
              avisar('Página actualizada');
            } finally {
              setOcupado(false);
            }
          }}
        >
          {cambios ? 'Guardar contenido' : 'Sin cambios'}
        </Boton>
      </div>
    </div>
  );
}

function Bloque({ titulo, ayuda, children }: { titulo: string; ayuda?: string; children: ReactNode }) {
  return (
    <section className={cx('space-y-3 border-t border-ink-100 pt-5')}>
      <div>
        <h3 className="text-base font-extrabold">{titulo}</h3>
        {ayuda && <p className="text-xs text-ink-500">{ayuda}</p>}
      </div>
      {children}
    </section>
  );
}
