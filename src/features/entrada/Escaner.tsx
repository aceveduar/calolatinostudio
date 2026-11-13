import { useEffect, useRef, useState } from 'react';
import QrScanner from 'qr-scanner';
import { CameraOff, Check, SwitchCamera } from 'lucide-react';
import { Boton, cx } from '../../components/ui';
import { dinero } from '../../domain/dinero';
import { leerQR } from '../../domain/qr';
import type { Movimiento } from '../../domain/rapido';

const ESPERA_MISMO_CODIGO_MS = 4000;

/**
 * Escaneo continuo: la cámara queda abierta para la fila; cada QR leído cobra o da entrada
 * igual que un toque en la cuadrícula. Abajo se ve lo que lleva la cuenta.
 */
export function Escaner({ onCodigo, movs, onListo }: { onCodigo: (codigo: string) => void; movs: Movimiento[]; onListo: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const escaner = useRef<QrScanner | null>(null);
  const ultimo = useRef<{ codigo: string; t: number }>({ codigo: '', t: 0 });
  const [error, setError] = useState('');
  const [destello, setDestello] = useState(false);
  const [variasCamaras, setVariasCamaras] = useState(false);
  const [frente, setFrente] = useState<'environment' | 'user'>('environment');
  const alCodigo = useRef(onCodigo);
  alCodigo.current = onCodigo;

  useEffect(() => {
    if (!video.current) return;
    const s = new QrScanner(
      video.current,
      (r) => {
        const codigo = leerQR(r.data);
        if (!codigo) return;
        const ahora = Date.now();
        if (codigo === ultimo.current.codigo && ahora - ultimo.current.t < ESPERA_MISMO_CODIGO_MS) return;
        ultimo.current = { codigo, t: ahora };
        setDestello(true);
        setTimeout(() => setDestello(false), 350);
        alCodigo.current(codigo);
      },
      { returnDetailedScanResult: true, preferredCamera: 'environment', maxScansPerSecond: 8, highlightScanRegion: false },
    );
    escaner.current = s;
    s.start()
      .then(() => QrScanner.listCameras().then((c) => setVariasCamaras(c.length > 1)))
      .catch((e: unknown) => {
        const m = String(e);
        setError(/denied|NotAllowed|permission/i.test(m) ? 'Permite el uso de la cámara para escanear (en la barra del navegador).' : 'No se encontró una cámara en este equipo.');
      });
    return () => {
      s.stop();
      s.destroy();
      escaner.current = null;
    };
  }, []);

  const total = movs.filter((m) => m.metodo === 'efectivo').reduce((s, m) => s + m.monto, 0);

  return (
    <div className="space-y-3">
      <div className="relative aspect-square w-full overflow-hidden rounded-3xl bg-black">
        <video ref={video} className="h-full w-full object-cover" muted playsInline />
        {error ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center text-white">
            <CameraOff size={36} />
            <p className="font-semibold">{error}</p>
          </div>
        ) : (
          <>
            {/* marco guía */}
            <div className={cx('pointer-events-none absolute inset-[18%] rounded-3xl border-4 transition-colors', destello ? 'border-[#4cc982]' : 'border-white/80')} />
            <p className="absolute inset-x-0 bottom-3 text-center text-sm font-semibold text-white/90 drop-shadow">Apunta al QR de la credencial</p>
            {variasCamaras && (
              <button
                onClick={() => {
                  const sig = frente === 'environment' ? 'user' : 'environment';
                  setFrente(sig);
                  void escaner.current?.setCamera(sig);
                }}
                className="absolute top-3 right-3 rounded-full bg-black/40 p-2.5 text-white"
                aria-label="Cambiar cámara"
              >
                <SwitchCamera size={20} />
              </button>
            )}
          </>
        )}
      </div>

      {movs.length > 0 && (
        <div className="rounded-2xl bg-superficie ring-1 ring-ink-100">
          {movs.slice(0, 4).map((m) => (
            <div key={m.key} className="flex items-center gap-2 border-b border-ink-100 px-4 py-2 last:border-0">
              <Check size={16} className="text-ok-600" />
              <span className="min-w-0 flex-1 truncate font-semibold">{m.nombre}</span>
              <span className={cx('text-sm font-bold', !m.monto && 'text-ok-600')}>{m.monto ? dinero(m.monto) : 'Plan'}</span>
            </div>
          ))}
        </div>
      )}
      <Boton grande bloque onClick={onListo}>
        {total ? `Listo · cobrar ${dinero(total)}` : 'Listo'}
      </Boton>
    </div>
  );
}
