import { useEffect, useRef, useState } from 'react';
import { Boton } from '../../components/ui';

interface Turnstile {
  render(contenedor: HTMLElement, opciones: {
    sitekey: string; action: string; cData: string; size: 'flexible'; appearance: 'interaction-only';
    callback: (token: string) => void;
    'expired-callback': () => void;
    'error-callback': () => void;
  }): string;
  remove(id: string): void;
}

const widget = () => (window as Window & { turnstile?: Turnstile }).turnstile;
let carga: Promise<Turnstile> | undefined;

function cargarWidget() {
  const listo = widget();
  if (listo) return Promise.resolve(listo);
  if (carga) return carga;
  carga = new Promise<Turnstile>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.async = true;
    const terminar = () => {
      clearTimeout(limite);
      const api = widget();
      if (api) resolve(api);
      else {
        script.remove();
        carga = undefined;
        reject(new Error('Verificación no disponible'));
      }
    };
    const limite = setTimeout(terminar, 10_000);
    script.onload = terminar;
    script.onerror = terminar;
    document.head.append(script);
  });
  return carga;
}

export function RetoAlta({ campana, onToken }: { campana: string; onToken: (reto: string) => void }) {
  const contenedor = useRef<HTMLDivElement>(null);
  const [error, setError] = useState(false);
  const [reintentos, setReintentos] = useState(0);

  useEffect(() => {
    const control = new AbortController();
    const limite = setTimeout(() => control.abort('tiempo'), 8_000);
    let api: Turnstile | undefined;
    let id: string | undefined;
    const fallo = () => {
      if (control.signal.aborted && control.signal.reason !== 'tiempo') return;
      onToken('');
      setError(true);
    };
    void (async () => {
      try {
        const respuesta = await fetch('/api/registro-alumno', { signal: control.signal });
        clearTimeout(limite);
        if (!respuesta.ok) throw new Error('Servicio no disponible');
        const { sitekey } = await respuesta.json();
        if (typeof sitekey !== 'string' || !sitekey) throw new Error('Configuración incompleta');
        api = await cargarWidget();
        if (control.signal.aborted || !contenedor.current) return;
        id = api.render(contenedor.current, {
          sitekey, action: 'registro_alumno', cData: campana, size: 'flexible', appearance: 'interaction-only',
          callback: (reto) => {
            if (control.signal.aborted) return;
            setError(false);
            onToken(reto);
          },
          'expired-callback': fallo,
          'error-callback': fallo,
        });
      } catch {
        fallo();
      } finally {
        clearTimeout(limite);
      }
    })();
    return () => {
      control.abort();
      clearTimeout(limite);
      if (id) api?.remove(id);
    };
  }, [campana, onToken, reintentos]);

  return (
    <div>
      <div ref={contenedor} />
      {error && (
        <div className="space-y-2 text-sm text-ink-600">
          <p role="alert">No pudimos completar la verificación. Reintenta o abre el enlace en Safari o Chrome.</p>
          <Boton type="button" variante="secundario" onClick={() => { setError(false); setReintentos((n) => n + 1); }}>Reintentar verificación</Boton>
        </div>
      )}
    </div>
  );
}
