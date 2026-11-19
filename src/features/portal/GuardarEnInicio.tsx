import { useEffect, useState } from 'react';
import { Share, Smartphone, X } from 'lucide-react';

/**
 * "Ten tu pase a un toque": guardar el portal en la pantalla de inicio, como una app.
 * Android/Chrome: botón que abre la ventana de instalar (el aviso del navegador lo guarda main.tsx en
 * window.__avisoInstalar, porque puede llegar antes de que esta tarjeta exista). iPhone: no hay botón posible; se explica cómo.
 * No sale si ya está instalada, en computadora, o si el alumno dijo "Ahora no".
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

function leerCerrado(clave: string) {
  try {
    return localStorage.getItem(clave) === '1';
  } catch {
    return false;
  }
}

export function GuardarEnInicio({ token }: { token: string }) {
  const clave = `compas:inicio-cerrado:${token.slice(0, 8)}`;
  const [aviso, setAviso] = useState<AvisoInstalar | null>(() => window.__avisoInstalar ?? null);
  const [cerrado, setCerrado] = useState(() => leerCerrado(clave) || yaInstalada());
  useEffect(() => {
    const llego = () => setAviso(window.__avisoInstalar ?? null);
    const instalada = () => setCerrado(true);
    window.addEventListener('compas:instalable', llego);
    window.addEventListener('appinstalled', instalada);
    return () => {
      window.removeEventListener('compas:instalable', llego);
      window.removeEventListener('appinstalled', instalada);
    };
  }, []);

  const iphone = esIphone();
  if (cerrado || (!aviso && !iphone && !esAndroid())) return null;

  const cerrar = () => {
    try {
      localStorage.setItem(clave, '1');
    } catch {
      /* sin almacenamiento: solo se oculta esta vez */
    }
    setCerrado(true);
  };

  return (
    <div className="relative flex items-start gap-3 rounded-3xl bg-superficie p-4 pr-12 ring-1 ring-ink-100">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-brand-600" aria-hidden="true">
        <Smartphone size={22} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-bold">Ten tu pase a un toque</p>
        {aviso ? (
          <>
            <p className="text-sm text-ink-500">Guárdalo en tu pantalla de inicio, como una app.</p>
            <button
              type="button"
              onClick={async () => {
                await aviso.prompt();
                const { outcome } = await aviso.userChoice;
                window.__avisoInstalar = null;
                setAviso(null);
                if (outcome === 'accepted') setCerrado(true);
              }}
              className="mt-2 h-11 rounded-xl bg-brand-500 px-4 text-sm font-bold text-white active:scale-[0.98]"
            >
              Agregar a mi pantalla
            </button>
          </>
        ) : iphone ? (
          <p className="text-sm text-ink-700">
            En Safari toca <Share size={15} className="inline align-[-2px]" aria-label="Compartir" /> <b>Compartir</b> y luego <b>“Agregar a inicio”</b>.
          </p>
        ) : (
          <p className="text-sm text-ink-700">
            En el menú <b>⋮</b> del navegador elige <b>“Agregar a la pantalla principal”</b>.
          </p>
        )}
      </div>
      <button type="button" onClick={cerrar} className="absolute top-2 right-2 flex h-10 w-10 items-center justify-center rounded-full text-ink-500 active:bg-ink-100" aria-label="Ahora no">
        <X size={18} />
      </button>
    </div>
  );
}
