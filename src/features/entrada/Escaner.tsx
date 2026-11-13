import { useEffect, useRef, useState } from 'react';
import QrScanner from 'qr-scanner';
import { AlertTriangle, CameraOff, Check, ScanLine, SwitchCamera, XCircle } from 'lucide-react';
import { Boton, cx } from '../../components/ui';
import { dinero } from '../../domain/dinero';
import { leerQR } from '../../domain/qr';
import type { Movimiento } from '../../domain/rapido';

/** Lo que pasó al leer un QR, para mostrarlo en grande. */
export interface LecturaQR {
  tono: 'ok' | 'aviso' | 'error';
  titulo: string;
  detalle: string;
}

const PAUSA_MS = 2000; // tiempo que se ve la confirmación antes de leer el siguiente
const ESPERA_MISMO_CODIGO_MS = 6000; // el mismo QR frente a la cámara no se vuelve a procesar

const ESTILO = {
  ok: { fondo: 'bg-[#15924b]/95', icono: Check },
  aviso: { fondo: 'bg-[#b7791f]/95', icono: AlertTriangle },
  error: { fondo: 'bg-[#c53030]/95', icono: XCircle },
} as const;

/**
 * Escaneo para la fila: cada QR leído muestra una confirmación grande (nombre + qué pasó),
 * pausa 2 s y queda listo para el siguiente. "Terminar" cierra la cámara y deja la cuenta para el cambio.
 */
export function Escaner({ onCodigo, movs, onListo }: { onCodigo: (codigo: string) => Promise<LecturaQR>; movs: Movimiento[]; onListo: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const escaner = useRef<QrScanner | null>(null);
  const ultimo = useRef<{ codigo: string; t: number }>({ codigo: '', t: 0 });
  const ocupado = useRef(false);
  const temporizador = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [error, setError] = useState('');
  const [lectura, setLectura] = useState<LecturaQR | null>(null);
  const [leidos, setLeidos] = useState(0);
  const [variasCamaras, setVariasCamaras] = useState(false);
  const [frente, setFrente] = useState<'environment' | 'user'>('environment');
  const alCodigo = useRef(onCodigo);
  alCodigo.current = onCodigo;

  const siguiente = () => {
    clearTimeout(temporizador.current);
    setLectura(null);
    ocupado.current = false;
  };

  useEffect(() => {
    if (!video.current) return;
    const s = new QrScanner(
      video.current,
      async (r) => {
        if (ocupado.current) return;
        const codigo = leerQR(r.data);
        const ahora = Date.now();
        const clave = codigo ?? r.data;
        if (clave === ultimo.current.codigo && ahora - ultimo.current.t < ESPERA_MISMO_CODIGO_MS) return;
        ultimo.current = { codigo: clave, t: ahora };
        ocupado.current = true;
        const res: LecturaQR = codigo
          ? await alCodigo.current(codigo).catch(() => ({ tono: 'error' as const, titulo: 'No se pudo registrar', detalle: 'Intenta de nuevo' }))
          : { tono: 'error', titulo: 'QR no reconocido', detalle: 'No es una credencial de la academia' };
        if (res.tono === 'ok') setLeidos((n) => n + 1);
        avisarConSentidos(res.tono);
        setLectura(res);
        temporizador.current = setTimeout(siguiente, PAUSA_MS);
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
      clearTimeout(temporizador.current);
      s.stop();
      s.destroy();
      escaner.current = null;
    };
  }, []);

  const total = movs.filter((m) => m.metodo === 'efectivo').reduce((s, m) => s + m.monto, 0);
  const Icono = lectura ? ESTILO[lectura.tono].icono : Check;

  return (
    <div className="space-y-3">
      <div className="relative aspect-square w-full overflow-hidden rounded-3xl bg-black">
        <video ref={video} className="h-full w-full object-cover" muted playsInline />
        {error ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center text-white">
            <CameraOff size={36} />
            <p className="font-semibold">{error}</p>
          </div>
        ) : lectura ? (
          // Confirmación grande: imposible de no ver
          <button
            type="button"
            onClick={siguiente}
            className={cx('absolute inset-0 flex flex-col items-center justify-center gap-2 p-6 text-center text-white animate-aparece', ESTILO[lectura.tono].fondo)}
            role="status"
            aria-live="assertive"
          >
            <span className="flex h-20 w-20 items-center justify-center rounded-full bg-white/20 animate-pop">
              <Icono size={48} strokeWidth={3} />
            </span>
            <span className="mt-2 text-2xl leading-tight font-extrabold">{lectura.titulo}</span>
            <span className="text-xl font-semibold text-white/90">{lectura.detalle}</span>
            <span className="absolute inset-x-0 bottom-0 h-1.5 bg-white/30">
              <span className="block h-full origin-left bg-white" style={{ animation: `vaciar ${PAUSA_MS}ms linear forwards` }} />
            </span>
            <span className="absolute bottom-4 text-sm font-medium text-white/80">Toca para escanear el siguiente</span>
          </button>
        ) : (
          <>
            <div className="pointer-events-none absolute inset-[18%] rounded-3xl border-4 border-white/80" />
            <p className="absolute inset-x-0 bottom-3 flex items-center justify-center gap-2 text-center text-base font-semibold text-white drop-shadow">
              <ScanLine size={18} /> {leidos ? 'Listo para el siguiente' : 'Apunta al QR de la credencial'}
            </p>
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
          <p className="border-b border-ink-100 px-4 py-2 text-xs font-bold tracking-wider text-ink-500 uppercase">En la cuenta · {movs.length}</p>
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
        {total ? `Terminar · cobrar ${dinero(total)}` : 'Terminar'}
      </Boton>
    </div>
  );
}

/** Vibración y un tono corto: confirmación aunque haya música en el salón. */
function avisarConSentidos(tono: LecturaQR['tono']) {
  navigator.vibrate?.(tono === 'ok' ? 60 : [80, 60, 80]);
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ac = new Ctx();
    const notas = tono === 'ok' ? [880, 1320] : [330, 247];
    notas.forEach((f, i) => {
      const o = ac.createOscillator();
      const g = ac.createGain();
      o.frequency.value = f;
      o.connect(g).connect(ac.destination);
      const t = ac.currentTime + i * 0.12;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.25, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.11);
      o.start(t);
      o.stop(t + 0.12);
    });
    setTimeout(() => void ac.close(), 600);
  } catch {
    /* sin audio: queda la vibración y la pantalla */
  }
}
