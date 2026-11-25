import { useState } from 'react';
import { Map as IconoMapa, MapPin } from 'lucide-react';
import { mapaEmbed } from '../../domain/publica';

/** El mapa de Google pesa: primero una vista ligera y se carga solo si la persona lo pide. */
export function MapaLigero({ nombre, direccion }: { nombre: string; direccion: string }) {
  const [ver, setVer] = useState(false);
  if (ver)
    return <iframe title={`Mapa de ${nombre}`} src={mapaEmbed(direccion)} referrerPolicy="no-referrer-when-downgrade" className="aspect-[16/10] h-full w-full bg-ink-100 md:aspect-auto md:min-h-72" />;
  return (
    <button
      type="button"
      onClick={() => setVer(true)}
      className="relative flex min-h-24 w-full items-center justify-center overflow-hidden bg-ink-100 md:min-h-72"
      style={{
        backgroundImage:
          'linear-gradient(color-mix(in oklab, var(--marca) 8%, transparent) 1px, transparent 1px), linear-gradient(90deg, color-mix(in oklab, var(--marca) 8%, transparent) 1px, transparent 1px)',
        backgroundSize: '28px 28px',
      }}
    >
      <span className="flex items-center gap-2 md:flex-col">
        <MapPin size={22} className="text-brand-600" aria-hidden="true" />
        <span className="flex min-h-11 items-center gap-2 rounded-full bg-superficie px-4 text-sm font-bold shadow ring-1 ring-ink-100">
          <IconoMapa size={16} /> Ver mapa
        </span>
      </span>
    </button>
  );
}
