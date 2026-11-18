import { chromium } from 'playwright-core';
const DIR = new URL('./', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const OUT = DIR + 'salida/';
const browser = await chromium.launch({
  channel: 'msedge',
  args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', `--use-file-for-fake-video-capture=${DIR}archivos/ean_agua.mjpeg`],
});
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'es-MX', permissions: ['camera'] });
const page = await ctx.newPage();
await page.clock.install({ time: new Date('2026-11-13T19:30:00') });
const errores = []; page.on('pageerror', (e) => errores.push(e.message));
const ok = (c) => (c ? 'OK' : 'MAL');
const body = async () => (await page.locator('body').innerText()).replace(/\s+/g, ' ');
const dlg = page.getByRole('dialog');
const ir = (r) => page.evaluate((x) => { history.pushState(null, '', x); dispatchEvent(new PopStateEvent('popstate')); }, r);
const lector = async (codigo) => { await page.keyboard.type(codigo, { delay: 8 }); await page.keyboard.press('Enter'); await page.waitForTimeout(600); };
const entrar = async (nombre, pin) => {
  await page.getByText(nombre, { exact: true }).click();
  for (const d of pin) await page.getByRole('button', { name: d, exact: true }).click();
  await page.getByPlaceholder(/Quién llegó|Buscar…/).waitFor();
};

await page.goto('http://localhost:4173/');
await page.waitForFunction(() => !!window.compasDev);
console.log('demo:', JSON.stringify(await page.evaluate(async () => { await window.compasDev.sembrar(); await window.compasDev.agregarClasesDemo(); return window.compasDev.agregarTiendaDemo(); })));
await page.reload();
await entrar('Monse', '1111');

// 1) cámara: lee el código del agua (video falso con un EAN-13 real)
await page.getByRole('button', { name: /^Tienda/ }).click();
await dlg.getByRole('button', { name: /Escanear código de barras/ }).click();
const camara = page.getByRole('dialog', { name: 'Cobrar escaneando' });
await camara.getByText(/Agua 600 ml · \$15/).waitFor({ timeout: 20000 });
await page.screenshot({ path: `${OUT}codigos-1-camara.png` });
console.log('1) la cámara leyó el código del agua: OK');

// 2) número escrito a mano
await camara.getByPlaceholder('O escribe el número').fill('7501000000029');
await camara.getByRole('button', { name: 'Usar' }).click();
await camara.getByText(/Electrolit · \$35/).waitFor();
console.log('2) número escrito a mano: OK');

// 3) código que no existe
await camara.getByPlaceholder('O escribe el número').fill('7509999999999');
await camara.getByRole('button', { name: 'Usar' }).click();
await camara.getByText(/no registrado/).waitFor();
console.log('3) código desconocido avisa: OK');
await camara.getByRole('button', { name: 'Cerrar' }).click();
await page.waitForTimeout(300);
let t = await body();
// el agua pudo leerse más de una vez (2 s entre lecturas del mismo código); al menos una
console.log('4) en la cuenta: agua y electrolit:', ok(/Agua 600 ml/.test(t) && /Electrolit/.test(t)));
await dlg.getByRole('button', { name: /Listo/ }).first().click();
await page.waitForTimeout(300);

// 5) lector USB en Entrada (sin abrir nada): producto a la cuenta
await page.locator('body').click({ position: { x: 5, y: 300 } });
await lector('7501000000036');
t = await body();
const buscador = await page.getByPlaceholder(/Quién llegó|Buscar…/).inputValue();
console.log('5) lector USB suma el refresco y no deja basura en el buscador:', ok(/Refresco/.test(t) && buscador === ''), JSON.stringify(buscador));

// 6) lector USB con el QR de un alumno
const alumno = await page.evaluate(() => new Promise((res) => { const q = indexedDB.open('compas'); q.onsuccess = () => { q.result.transaction('alumnos').objectStore('alumnos').getAll().onsuccess = (e) => res(e.target.result.find((a) => a.activo && !a.deletedAt)); }; }));
await lector(`COMPAS:${alumno.codigo}`);
t = await body();
console.log('6) lector USB con QR de alumno:', ok(t.includes(alumno.nombre)), alumno.nombre);
await page.screenshot({ path: `${OUT}codigos-2-usb.png` });

// 7) dirección: escanear en Productos abre el existente o da de alta
await page.getByRole('button', { name: /cambiar usuario/i }).first().click();
await entrar('Dirección Calo', '1234');
await ir('/ajustes/productos');
await page.getByText('Escanear producto').waitFor();
await page.locator('body').click({ position: { x: 5, y: 300 } });
await lector('7501000000050');
await dlg.waitFor();
const existente = await dlg.getByPlaceholder('Escanéalo o escríbelo').inputValue();
const tituloExistente = (await dlg.innerText()).split('\n')[0];
await page.keyboard.press('Escape');
await page.waitForTimeout(300);
await page.locator('body').click({ position: { x: 5, y: 300 } });
await lector('7509876543210');
await dlg.waitFor();
const nuevo = (await dlg.innerText()).replace(/\s+/g, ' ');
console.log('7) escanear abre el producto existente:', ok(existente === '7501000000050' && /Galletas|Barrita|Dulces|Refresco|Agua|Electrolit|Playera|Gorra|Zapatillas/.test(tituloExistente)), tituloExistente);
console.log('8) código nuevo → alta con el código puesto:', ok(/Nuevo producto/.test(nuevo) && (await dlg.getByPlaceholder('Escanéalo o escríbelo').inputValue()) === '7509876543210'));
// 9) código repetido
await dlg.getByPlaceholder('Escanéalo o escríbelo').fill('7501000000012');
console.log('9) código repetido avisa:', ok((await dlg.getByText(/Ese código ya es de “Agua 600 ml”/).count()) === 1));
await page.screenshot({ path: `${OUT}codigos-3-alta.png` });
console.log('errores:', errores.length ? errores : 'ninguno');
await browser.close();
