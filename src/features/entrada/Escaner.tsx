import { useEffect, useRef, useState } from 'react';
import QrScanner from 'qr-scanner';
import { AlertTriangle, CameraOff, Loader2, Check, ScanLine, SwitchCamera, XCircle } from 'lucide-react';
import { Boton, cx } from '../../components/ui';
import { dinero } from '../../domain/dinero';
import { leerQR } from '../../domain/qr';
import type { Movimiento } from '../../domain/rapido';

/** Lo que pasó al leer un QR, para mostrarlo en grande. */
export interface LecturaQR {
  tono: 'ok' | 'aviso' | 'error' | 'leyendo';
  titulo: string;
  detalle: string;
}

const PAUSA_MS = 2000; // tiempo que se ve la confirmación antes de leer el siguiente
const ESPERA_MISMO_CODIGO_MS = 6000; // el mismo QR frente a la cámara no se vuelve a procesar

const ESTILO = {
  ok: { color: 'bg-[#075c30]/90', icono: Check },
  aviso: { color: 'bg-[#7b4b0b]/90', icono: AlertTriangle },
  error: { color: 'bg-[#8f2424]/90', icono: XCircle },
  leyendo: { color: 'bg-black/75', icono: Loader2 },
} as const;

/**
 * Escaneo para la fila: cada QR leído muestra una confirmación grande (nombre + qué pasó),
 * pausa 2 s y queda listo para el siguiente. La cuenta se atiende después, fuera del escáner.
 */
export function Escaner({ clase, onCodigo, movs, onListo }: { clase?: string; onCodigo: (codigo: string) => Promise<LecturaQR>; movs: Movimiento[]; onListo: () => void }) {
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
    let activo = true;
    const s = new QrScanner(
      video.current,
      async (r) => {
        if (!activo || ocupado.current) return;
        const codigo = leerQR(r.data);
        const ahora = Date.now();
        const clave = codigo ?? r.data;
        if (clave === ultimo.current.codigo && ahora - ultimo.current.t < ESPERA_MISMO_CODIGO_MS) return;
        ultimo.current = { codigo: clave, t: ahora };
        ocupado.current = true;
        setLectura({ tono: 'leyendo', titulo: 'Leyendo…', detalle: 'Un momento' });
        const res: LecturaQR = codigo
          ? await alCodigo.current(codigo).catch(() => ({ tono: 'error' as const, titulo: 'No se pudo registrar', detalle: 'Intenta de nuevo' }))
          : { tono: 'error', titulo: 'QR no reconocido', detalle: 'No es una credencial de la academia' };
        if (!activo) return;
        if (res.tono === 'ok') setLeidos((n) => n + 1);
        avisarConSentidos(res.tono);
        setLectura(res);
        temporizador.current = setTimeout(siguiente, PAUSA_MS);
      },
      { returnDetailedScanResult: true, preferredCamera: 'environment', maxScansPerSecond: 8, highlightScanRegion: false },
    );
    escaner.current = s;
    s.start()
      .then(() => QrScanner.listCameras().then((c) => { if (activo) setVariasCamaras(c.length > 1); }))
      .catch((e: unknown) => {
        if (!activo) return;
        const m = String(e);
        setError(/denied|NotAllowed|permission/i.test(m) ? 'Permite el uso de la cámara para escanear (en la barra del navegador).' : 'No se encontró una cámara en este equipo.');
      });
    return () => {
      activo = false;
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
      {clase && <p className="text-sm font-semibold text-ink-700">{clase}</p>}
      <div className="relative aspect-[4/3] max-h-[42dvh] w-full overflow-hidden rounded-2xl bg-black">
        <video ref={video} className="h-full w-full object-cover" muted playsInline />
        {error ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center text-white">
            <CameraOff size={36} />
            <p className="font-semibold">{error}</p>
            <p className="text-sm text-white/80">También puedes buscar al alumno por su nombre o código en Entrada.</p>
          </div>
        ) : lectura ? (
          <div className={cx('absolute inset-0 flex flex-col items-center justify-center gap-2 overflow-y-auto p-3 text-center text-white', ESTILO[lectura.tono].color)}>
            <div role="status" className="max-w-full">
              <Icono size={32} strokeWidth={2.5} aria-hidden="true" className={cx('mx-auto mb-1', lectura.tono === 'leyendo' && 'animate-spin')} />
              <p className="break-words text-lg leading-tight font-extrabold">{lectura.titulo}</p>
              <p className="mt-1 text-sm font-semibold">{lectura.detalle}</p>
            </div>
            {lectura.tono !== 'leyendo' && (
              <button type="button" onClick={siguiente} className="min-h-11 rounded-lg px-3 text-sm font-semibold underline underline-offset-4 active:brightness-75">
                Escanear otro pase
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="pointer-events-none absolute top-1/2 left-1/2 aspect-square h-[64%] -translate-x-1/2 -translate-y-1/2 rounded-2xl border-2 border-white/80" />
            <p className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-2 bg-black/65 px-2 py-2 text-center text-sm font-semibold text-white">
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
          {movs.slice(0, 2).map((m) => (
            <div key={m.key} className="flex items-center gap-2 border-b border-ink-100 px-4 py-2 last:border-0">
              <Check size={16} className="text-ok-600" />
              <span className="min-w-0 flex-1 truncate font-semibold">{m.nombre}</span>
              <span className={cx('text-sm font-bold', !m.monto && 'text-ok-600')}>{m.monto ? dinero(m.monto) : m.beca ? 'Beca' : 'Plan'}</span>
            </div>
          ))}
          {movs.length > 2 && <p className="px-4 py-2 text-xs text-ink-500">+{movs.length - 2} en la cuenta completa</p>}
        </div>
      )}
      <Boton bloque onClick={onListo} disabled={lectura?.tono === 'leyendo'}>
        {total ? `Ver cuenta · ${dinero(total)}` : movs.length ? 'Ver cuenta' : 'Cerrar escáner'}
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
