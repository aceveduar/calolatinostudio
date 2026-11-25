import { useEffect, useState } from 'react';
import { Bookmark, ChevronDown, Share } from 'lucide-react';

/**
 * Guardar el portal en la pantalla de inicio.
 * Android/Chrome: botón que abre la ventana de instalar (el aviso del navegador lo guarda main.tsx en
 * window.__avisoInstalar, porque puede llegar antes de que esta tarjeta exista). iPhone: no hay botón posible; se explica cómo.
 * La ayuda se abre bajo el QR y se oculta cuando el pase ya está instalado.
 */

interface AvisoInstalar extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}
declare global {
  interface Window {
    __avisoInstalar?: AvisoInstalar | null;
  }
}

const yaInstalada = () => matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;
const esIphone = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const esAndroid = () => /Android/.test(navigator.userAgent);

export function GuardarEnInicio() {
  const [aviso, setAviso] = useState<AvisoInstalar | null>(() => window.__avisoInstalar ?? null);
  const [instalada, setInstalada] = useState(yaInstalada);
  const [abierta, setAbierta] = useState(false);
  const [instalando, setInstalando] = useState(false);
  useEffect(() => {
    const llego = () => setAviso(window.__avisoInstalar ?? null);
    const instalada = () => setInstalada(true);
    window.addEventListener('compas:instalable', llego);
    window.addEventListener('appinstalled', instalada);
    return () => {
      window.removeEventListener('compas:instalable', llego);
      window.removeEventListener('appinstalled', instalada);
    };
  }, []);

  const iphone = esIphone();
  if (instalada || (!aviso && !iphone && !esAndroid())) return null;

  async function instalar() {
    if (!aviso || instalando) return;
    setInstalando(true);
    try {
      await aviso.prompt();
      const { outcome } = await aviso.userChoice;
      if (outcome === 'accepted') setInstalada(true);
    } catch {
      // Si el navegador bloquea el diálogo, quedan disponibles los pasos manuales.
    } finally {
      window.__avisoInstalar = null;
      setAviso(null);
      setInstalando(false);
    }
  }

  return (
    <div className="mt-2">
      <button type="button" aria-expanded={abierta} aria-controls="guardar-pase" onClick={() => setAbierta(!abierta)} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl text-sm font-bold text-brand-600 active:bg-brand-50">
        <Bookmark size={17} aria-hidden="true" /> Guardar mi pase
        <ChevronDown size={15} className={abierta ? 'rotate-180' : undefined} aria-hidden="true" />
      </button>
      <div id="guardar-pase" hidden={!abierta} className="rounded-2xl bg-brand-50 p-3 text-sm text-ink-700">
        {aviso ? (
          <div className="space-y-2">
            <p>Agrega el pase a tu pantalla de inicio para abrirlo cuando llegues a clase.</p>
            <button
              type="button"
              onClick={() => void instalar()}
              disabled={instalando}
              className="min-h-11 rounded-xl bg-superficie px-4 font-bold text-brand-600 ring-1 ring-brand-500/20 active:scale-[0.98]"
            >
              Agregar a mi pantalla
            </button>
          </div>
        ) : iphone ? (
          <p>
            Si abriste el pase desde WhatsApp, ábrelo en Safari. Toca <Share size={15} className="inline align-[-2px]" aria-hidden="true" /> <b>Compartir</b> y luego <b>Agregar a inicio</b>.
          </p>
        ) : (
          <p>
            Si abriste el pase desde WhatsApp, ábrelo en Chrome. En el menú <b>⋮</b>, elige <b>Agregar a la pantalla principal</b> o <b>Instalar aplicación</b>.
          </p>
        )}
        <p className="mt-2 text-xs text-ink-600">Si pierdes el enlace, pide tu pase en recepción.</p>
      </div>
    </div>
  );
}
