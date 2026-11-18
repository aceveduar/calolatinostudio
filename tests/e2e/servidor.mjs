// Servidor de pruebas: sirve la compilación como Cloudflare Pages (con public/_headers y la
// redirección de la app) y junta los avisos de la política de seguridad (CSP).
// Si algo de la app queda bloqueado por la política, el corredor lo reporta y falla.
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import path from 'node:path';

const TIPOS = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.woff': 'font/woff', '.wasm': 'application/wasm', '.txt': 'text/plain',
};

/** Lee las reglas de "/*" de un archivo _headers (formato de Cloudflare Pages). */
export function leerEncabezados(archivo) {
  if (!existsSync(archivo)) return {};
  const h = {};
  let dentro = false;
  for (const linea of readFileSync(archivo, 'utf-8').split('\n')) {
    if (!linea.trim() || linea.trim().startsWith('#')) continue;
    if (!/^\s/.test(linea)) dentro = linea.trim() === '/*';
    else if (dentro) {
      const i = linea.indexOf(':');
      h[linea.slice(0, i).trim()] = linea.slice(i + 1).trim();
    }
  }
  return h;
}

export function servir({ carpeta, puerto, encabezados }) {
  carpeta = path.resolve(carpeta);
  const avisos = [];
  // la nube falsa de las pruebas también se permite (en producción solo *.supabase.co)
  const csp = encabezados['Content-Security-Policy']?.replace('https://*.supabase.co', 'https://*.supabase.co https://prueba.invalid');
  const conReporte = { ...encabezados, ...(csp ? { 'Content-Security-Policy': `${csp}; report-uri /__csp` } : {}) };
  const server = createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    if (url.pathname === '/__csp') {
      let cuerpo = '';
      req.on('data', (d) => (cuerpo += d));
      req.on('end', () => {
        try {
          const r = JSON.parse(cuerpo)['csp-report'] ?? {};
          avisos.push(`${r['violated-directive'] ?? r['effective-directive']} bloqueó ${r['blocked-uri']} en ${r['document-uri']}`);
        } catch {
          avisos.push(cuerpo.slice(0, 200));
        }
        res.writeHead(204).end();
      });
      return;
    }
    let archivo = path.join(carpeta, decodeURIComponent(url.pathname));
    if (!archivo.startsWith(carpeta) || !existsSync(archivo) || statSync(archivo).isDirectory()) archivo = path.join(carpeta, 'index.html');
    res.writeHead(200, { 'Content-Type': TIPOS[path.extname(archivo)] ?? 'application/octet-stream', ...conReporte });
    res.end(readFileSync(archivo));
  });
  return new Promise((ok, mal) => {
    server.once('error', mal);
    server.listen(puerto, () => ok({ avisos, cerrar: () => server.close() }));
  });
}
