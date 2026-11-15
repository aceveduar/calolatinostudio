/**
 * Timbre corto para avisos (apartado o interesado nuevo). Sin archivos: lo genera el navegador.
 * Los navegadores solo dejan sonar después de que la persona tocó la pantalla; el PIN ya cuenta como toque.
 */
let ctx: AudioContext | null = null;

function contexto(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  ctx ??= new AC();
  return ctx;
}

// Al primer toque se "despierta" el audio, para que el timbre pueda sonar después aunque nadie esté tocando.
if (typeof window !== 'undefined') {
  const despertar = () => void contexto()?.resume().catch(() => undefined);
  window.addEventListener('pointerdown', despertar, { once: true, capture: true });
  window.addEventListener('keydown', despertar, { once: true, capture: true });
}

/** Dos notas suaves (ding-dong). */
export function timbre(): void {
  const c = contexto();
  if (!c || c.state !== 'running') return;
  const t0 = c.currentTime;
  for (const [i, f] of [880, 1318.5].entries()) {
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = 'sine';
    osc.frequency.value = f;
    const t = t0 + i * 0.16;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.25, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
    osc.connect(g).connect(c.destination);
    osc.start(t);
    osc.stop(t + 0.5);
  }
}
