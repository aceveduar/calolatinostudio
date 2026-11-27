import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { chromium } from 'playwright-core';
import { servir } from './servidor.mjs';

const carpeta = process.argv[2] ?? 'dist-prueba';
const worker = await readFile(`${carpeta}/sw.js`, 'utf8');
const origen = await servir({ carpeta, puerto: 4173, encabezados: {} });
let revision = 1;
const servidor = createServer(async (req, res) => {
  if (req.url === '/sw.js') {
    res.writeHead(200, { 'Content-Type': 'text/javascript', 'Cache-Control': 'no-cache' });
    res.end(`${worker}\n// revisión de prueba ${revision}`);
    return;
  }
  const respuesta = await fetch(`http://localhost:4173${req.url}`);
  res.writeHead(respuesta.status, { 'Content-Type': respuesta.headers.get('content-type') });
  res.end(Buffer.from(await respuesta.arrayBuffer()));
});
await new Promise((resolve) => servidor.listen(0, resolve));
const url = `http://localhost:${servidor.address().port}/`;
const browser = await chromium.launch({ channel: 'chrome' });

try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(url);
  await page.waitForFunction(() => window.compasDev);
  await page.evaluate(() => window.compasDev.sembrar());
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.reload();
  await page.getByText('Monse', { exact: true }).click();
  await page.keyboard.type('1111', { delay: 30 });
  await page.getByPlaceholder(/Quién llegó|Buscar…/).waitFor();
  await page.waitForFunction(() => navigator.serviceWorker.controller && performance.now() > 8200);

  revision++;
  await page.evaluate(async () => (await navigator.serviceWorker.ready).update().then(() => null));
  const boton = page.getByRole('button', { name: 'Actualizar', exact: true });
  await boton.waitFor();
  assert.ok(await page.evaluate(async () => !!(await navigator.serviceWorker.ready).waiting));
  await Promise.all([page.waitForEvent('framenavigated', { timeout: 15000 }), boton.click()]);
  await page.getByPlaceholder(/Quién llegó|Buscar…/).waitFor();
  assert.equal(await boton.count(), 0);
  assert.ok(await page.evaluate(async () => !(await navigator.serviceWorker.ready).waiting));
  console.log('Chrome de escritorio activó un worker real y quitó el aviso sin recarga manual: OK');
} finally {
  await browser.close();
  servidor.close();
  origen.cerrar();
}
