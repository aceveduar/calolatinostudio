import { useState } from 'react';
import { Copy, ExternalLink, Globe, MessageCircle } from 'lucide-react';
import { useSesion } from '../../app/sesion';
import { useAvisos } from '../../components/avisos';
import { Boton, Campo, Entrada, Tarjeta } from '../../components/ui';
import { actualizar } from '../../db/repo';
import { enlacePublico, slugDe, slugValido } from '../../domain/publica';
import { EditorContenido } from './EditorContenido';

/**
 * Página pública del estudio: dirección (/a/<slug>) y WhatsApp de contacto.
 * Muestra horarios, precios, eventos y la tienda; no muestra maestros ni datos de alumnos.
 */
export function EditorPagina() {
  const { academia } = useSesion();
  const avisar = useAvisos();
  const [slug, setSlug] = useState(academia.slug ?? slugDe(academia.nombre));
  const [whats, setWhats] = useState(academia.whatsapp ?? '');
  const [ocupado, setOcupado] = useState(false);
  const tel = whats.replace(/\D/g, '');
  const cambios = slug !== (academia.slug ?? '') || tel !== (academia.whatsapp ?? '');
  const valido = slugValido(slug) && (tel === '' || tel.length === 10);
  const publicada = !!academia.slug;

  const guardarEnlace = async () => {
    await actualizar('academias', academia.id, { slug, whatsapp: tel || null });
  };
  const campos = (
    <div className="space-y-4">
        <Campo etiqueta="Dirección de la página" ayuda="Solo letras, números y guiones.">
          <div className="flex items-center gap-1 rounded-xl bg-superficie pl-3 ring-1 ring-ink-100 focus-within:ring-2 focus-within:ring-brand-500">
            <span className="shrink-0 text-sm text-ink-500">{location.host}/a/</span>
            <input
              value={slug}
              onChange={(e) =>
                setSlug(
                  e.target.value
                    .normalize('NFD')
                    .replace(/[̀-ͯ]/g, '')
                    .toLowerCase()
                    .replace(/\s+/g, '-')
                    .replace(/[^a-z0-9-]/g, '')
                    .slice(0, 40),
                )
              }
              className="h-12 min-w-0 flex-1 bg-transparent pr-3 outline-none"
              aria-label="Dirección de la página"
            />
          </div>
        </Campo>
        <Campo etiqueta="WhatsApp de contacto (opcional)" ayuda="Aparece como botón “Escríbenos por WhatsApp”. 10 dígitos.">
          <Entrada inputMode="tel" value={whats} onChange={(e) => setWhats(e.target.value)} placeholder="Ej. 5512345678" />
        </Campo>
    </div>
  );
  const url = academia.slug ? enlacePublico(academia.slug) : '';

  return (
    <div className="space-y-4">
      <p className="text-sm text-ink-500">
        Tu página para Facebook y WhatsApp: <b>horarios, precios, eventos y tienda</b> salen solos de la app, y quien se inscribe llega a <b>Interesados</b>. No muestra maestros ni
        datos de alumnos.
      </p>
      {!publicada ? (
        <>
          {campos}
          <Boton
            grande
            bloque
            disabled={!valido || ocupado}
            onClick={async () => {
              setOcupado(true);
              try {
                await guardarEnlace();
                avisar('Página publicada');
              } finally {
                setOcupado(false);
              }
            }}
          >
            <Globe size={20} /> Publicar página
          </Boton>
        </>
      ) : (
        <>
          {/* lo que más se usa, arriba: abrirla, copiar el enlace o mandarlo por WhatsApp */}
          <Tarjeta className="space-y-3 p-4">
            <p className="text-sm text-ink-500">Tu página:</p>
            <p className="font-semibold break-all">{url}</p>
            <div className="grid grid-cols-3 gap-2">
              <a href={url} target="_blank" rel="noreferrer">
                <Boton bloque variante="secundario" className="px-2">
                  <ExternalLink size={18} /> Abrir
                </Boton>
              </a>
              <Boton
                variante="secundario"
                className="px-2"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(url);
                    avisar('Enlace copiado: pégalo en tu Facebook');
                  } catch {
                    avisar('No se pudo copiar', 'error');
                  }
                }}
              >
                <Copy size={18} /> Copiar
              </Boton>
              <a href={`https://wa.me/?text=${encodeURIComponent(`Conoce ${academia.nombre}: horarios, precios y tu primera clase 💃 ${url}`)}`} target="_blank" rel="noreferrer">
                <Boton bloque variante="secundario" className="px-2">
                  <MessageCircle size={18} className="shrink-0 text-ok-600" /> Compartir
                </Boton>
              </a>
            </div>
            <p className="text-xs text-ink-500">Se actualiza sola: si cambias un horario o un precio aquí, la página ya lo muestra.</p>
          </Tarjeta>
          <EditorContenido enlace={{ resumen: `/a/${slug}${tel ? ` · WhatsApp ${tel}` : ' · sin WhatsApp'}`, cambios, valido, guardar: guardarEnlace, campos }} />
        </>
      )}
    </div>
  );
}
