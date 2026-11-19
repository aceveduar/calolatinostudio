/**
 * De dónde llegó quien se inscribe en la página pública: un anuncio (utm_source/utm_campaign, o los
 * identificadores que agregan Facebook y Google a sus anuncios), una red social, WhatsApp o Google.
 * Sirve para saber qué trae gente sin instalar nada de terceros. Texto corto y sin datos personales.
 */
const REDES: [RegExp, string][] = [
  [/(^|\.)(facebook\.com|fb\.com|fb\.me)$/, 'facebook'],
  [/(^|\.)instagram\.com$/, 'instagram'],
  [/(^|\.)(tiktok\.com)$/, 'tiktok'],
  [/(^|\.)(wa\.me|whatsapp\.com)$/, 'whatsapp'],
  [/(^|\.)google\.[a-z.]+$/, 'google'],
  [/(^|\.)(bing\.com)$/, 'bing'],
];

const limpio = (s: string | null | undefined, max = 40) =>
  (s ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9áéíóúñü _.-]/g, '')
    .trim()
    .slice(0, max);

export function origenVisita(busqueda: string, referente: string, hostPropio: string): string | null {
  const q = new URLSearchParams(busqueda);
  const fuente = limpio(q.get('utm_source'));
  const campana = limpio(q.get('utm_campaign'));
  if (fuente) return campana ? `${fuente} · ${campana}` : fuente;
  if (q.has('fbclid')) return 'facebook · anuncio o publicación';
  if (q.has('gclid')) return 'google · anuncio';
  if (q.has('ttclid')) return 'tiktok · anuncio';
  let host = '';
  try {
    host = referente ? new URL(referente).hostname.replace(/^www\./, '') : '';
  } catch {
    host = '';
  }
  if (!host || host === hostPropio.replace(/^www\./, '')) return null;
  for (const [re, nombre] of REDES) if (re.test(host)) return nombre;
  return limpio(host, 60) || null;
}

const CLAVE = 'pp-origen';

/** Se anota al llegar (la primera vez en esta visita) y se manda con la inscripción. */
export function recordarOrigen(): string | null {
  try {
    const ya = sessionStorage.getItem(CLAVE);
    if (ya !== null) return ya || null;
    const o = origenVisita(location.search, document.referrer, location.hostname);
    sessionStorage.setItem(CLAVE, o ?? '');
    return o;
  } catch {
    return origenVisita(location.search, document.referrer, location.hostname);
  }
}
