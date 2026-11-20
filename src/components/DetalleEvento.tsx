import { useState } from 'react';
import { MapPin, Shirt } from 'lucide-react';
import type { DetalleDeEvento } from '../domain/publica';

const LARGO = 140;

/** Enlace al mapa (Google Maps abre la app en el celular). */
const enlaceMapa = (direccion: string) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(direccion)}`;

/**
 * Detalle de un evento: cómo venir (resaltado), la descripción completa (con "Ver más" si es larga) y dónde es,
 * con "Cómo llegar". Se usa igual en la página pública y en el portal del alumno.
 */
export function DetalleEvento({ e }: { e: DetalleDeEvento }) {
  const [todo, setTodo] = useState(false);
  const texto = e.descripcion?.trim() ?? '';
  const largo = texto.length > LARGO || texto.split('\n').length > 3;
  return (
    <>
      {e.vestimenta?.trim() && (
        <span className="mt-1.5 inline-flex items-center gap-1.5 rounded-full bg-warn-50 px-2.5 py-1 text-xs font-extrabold text-warn-600">
          <Shirt size={14} aria-hidden="true" /> {e.vestimenta.trim()}
        </span>
      )}
      {texto && (
        <span className="mt-1 block text-sm">
          <span className={largo && !todo ? 'line-clamp-3 whitespace-pre-line' : 'whitespace-pre-line'}>{texto}</span>
          {largo && (
            <button type="button" onClick={() => setTodo(!todo)} className="mt-0.5 min-h-8 text-sm font-semibold text-brand-600">
              {todo ? 'Ver menos' : 'Ver más'}
            </button>
          )}
        </span>
      )}
      {e.lugar?.trim() && (
        <span className="mt-1.5 flex items-start gap-1.5 text-sm">
          <MapPin size={16} className="mt-0.5 shrink-0 text-brand-600" aria-hidden="true" />
          <span className="min-w-0">
            <span className={e.otro_lugar ? 'font-bold' : 'font-semibold'}>{e.lugar.trim()}</span>
            {e.direccion?.trim() && (
              <>
                <span className="block text-xs text-ink-500">{e.direccion.trim()}</span>
                <a href={enlaceMapa(e.direccion.trim())} target="_blank" rel="noreferrer" className="inline-flex min-h-8 items-center text-sm font-semibold text-brand-600 underline-offset-2 hover:underline">
                  Cómo llegar
                </a>
              </>
            )}
          </span>
        </span>
      )}
    </>
  );
}
