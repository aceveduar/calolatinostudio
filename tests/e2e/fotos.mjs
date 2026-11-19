import { chromium } from 'playwright-core';
const DIR = new URL('./', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const OUT = DIR + 'salida/';
const browser = await chromium.launch({ channel: 'msedge' });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'es-MX' });
const page = await ctx.newPage();
await page.clock.install({ time: new Date('2026-11-13T19:30:00') });
const errores = []; page.on('pageerror', (e) => errores.push(e.message));
const ok = (c) => (c ? 'OK' : 'MAL');
const dlg = page.getByRole('dialog');
await page.goto('http://localhost:4173/');
await page.waitForFunction(() => !!window.compasDev);
await page.evaluate(async () => { await window.compasDev.sembrar(); await window.compasDev.agregarClasesDemo(); await window.compasDev.agregarTiendaDemo(); });
await page.reload();
await page.getByText('Monse', { exact: true }).click();
await page.keyboard.type('1111', { delay: 30 });
await page.getByPlaceholder(/Quién llegó|Buscar…/).waitFor();

// 1) foto desde la ficha (galería)
await page.getByRole('link', { name: 'Alumnos', exact: true }).first().click();
await page.locator('main .divide-y button').first().click();
await page.getByRole('button', { name: /^Poner foto a/ }).click();
await page.locator('input[type=file]:not([capture])').setInputFiles(DIR + 'archivos/ean_agua.png');
await page.getByText('Foto guardada').waitFor();
const alumno = await page.evaluate(async () => (await window.compasDev.db.alumnos.toArray()).find((a) => a.foto));
console.log('1) foto guardada pequeña (JPEG):', ok(alumno?.foto?.startsWith('data:image/jpeg') && alumno.foto.length < 60000), alumno?.foto?.length);
console.log('   se ve en la ficha:', ok((await page.locator('main img[src^="data:image/jpeg"]').count()) >= 1));
await page.getByRole('link', { name: 'Alumnos', exact: true }).first().click();
await page.waitForTimeout(400);
console.log('2) se ve en la lista de alumnos:', ok((await page.locator('main .divide-y img[src^="data:image/jpeg"]').count()) >= 1));

// 3) aviso en vivo: llega un apartado de otro lado (portal / otro equipo)
await page.getByRole('link', { name: 'Entrada' }).first().click();
await page.waitForTimeout(800);
await page.evaluate(async () => {
  const db = window.compasDev.db;
  const prod = (await db.productos.toArray()).find((p) => p.nombre.startsWith('Playera'));
  const al = (await db.alumnos.toArray())[3];
  const a = (await db.academias.toArray())[0];
  await db.pedidos.add({ id: crypto.randomUUID(), academiaId: a.id, createdAt: Date.now(), updatedAt: Date.now(), deletedAt: null, alumnoId: al.id, productoId: prod.id, opcion: 'M', cantidad: 1, precio: prod.precio, estado: 'pendiente', pagoId: null });
});
await page.getByText(/📦 Nuevo apartado: Playera Calo \(M\)/).waitFor({ timeout: 5000 });
await page.screenshot({ path: `${OUT}avisos-vivo.png` });
console.log('3) aviso en vivo de apartado que llegó: OK');
// 4) lo capturado en este equipo no avisa
await page.getByRole('link', { name: 'Más' }).first().click();
await page.getByRole('link', { name: /Interesados/ }).click();
await page.getByRole('button', { name: /Anotar/ }).click();
await dlg.getByRole('textbox').first().fill('Rosa Local');
await dlg.getByPlaceholder('10 dígitos').fill('5511112222');
await dlg.getByRole('button', { name: 'Anotar', exact: true }).click();
await page.getByText('Anotado en interesados').waitFor();
await page.waitForTimeout(1200);
console.log('4) lo anotado aquí no suena ni avisa:', ok((await page.getByText(/📣 Nuevo interesado: Rosa Local/).count()) === 0));

// 5) portal: el alumno pone su foto
let foto = null;
const datos = { hoy: '2026-11-13', alumno: { nombre: 'Ana López', codigo: 'K7P2QX', foto: null }, academia: { nombre: 'Calo Latino Studio', color: '#d6334a', logo: null }, planes: [], clases: [], tienda: [], pedidos: [] };
await ctx.route('**/rest/v1/rpc/portal_alumno', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(foto ? { ...datos, alumno: { ...datos.alumno, foto } } : datos) }));
await ctx.route('**/rest/v1/rpc/portal_foto', (r) => { foto = JSON.parse(r.request().postData() || '{}').p_foto; return r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' }); });
await page.goto('http://localhost:4173/p/AbCdEfGhJkLmNpQrStUvWxYz23');
await page.getByText('Tu pase de entrada').waitFor();
const pide = (await page.getByText('Pon tu foto', { exact: true }).count()) === 1 && (await page.getByRole('button', { name: 'Poner foto' }).count()) === 1;
const sinCamaraForzada = (await page.locator('input[type=file][capture]').count()) === 0; // deja elegir cámara o galería
await page.screenshot({ path: `${OUT}portal-pide-foto.png` });
await page.locator('input[type=file]').last().setInputFiles(DIR + 'archivos/ean_agua.png');
await page.getByRole('img', { name: 'Ana López' }).waitFor({ timeout: 8000 });
const seFue = (await page.getByText('Pon tu foto', { exact: true }).count()) === 0;
console.log('5) portal: tarjeta "Pon tu foto" (cámara o galería), la sube pequeña, la muestra y la tarjeta se va:', ok(pide && sinCamaraForzada && seFue && foto?.startsWith('data:image/jpeg') && foto.length < 60000));
await page.screenshot({ path: `${OUT}portal-foto.png` });
console.log('errores:', errores.length ? errores : 'ninguno');
await browser.close();
