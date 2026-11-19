import { chromium } from 'playwright-core';
const OUT = new URL('./salida/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const browser = await chromium.launch({ channel: 'msedge' });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'es-MX' });
const page = await ctx.newPage();
const errores = []; page.on('pageerror', (e) => errores.push(e.message));
const ok = (c) => (c ? 'OK' : 'MAL');

const TOKEN = 'AbCdEfGhJkLmNpQrStUvWxYz23';
const DATOS = {
  hoy: '2026-11-14',
  alumno: { nombre: 'Ana López', codigo: 'K7P2QX' },
  academia: { nombre: 'Calo Latino Studio', color: '#d6334a', logo: null },
  planes: [
    { plan: 'Paquete 8 clases', tipo: 'paquete', beca: false, inicio: '2026-11-01', fin: '2026-11-30', clases: 8, usadas: 5, },
    { plan: 'Mensualidad', tipo: 'mensual', beca: false, inicio: '2026-12-01', fin: '2026-12-31', clases: null, usadas: 0 },
  ],
  clases: [
    { fecha: '2026-11-13', clase: 'Salsa 1', color: '#e8445a' },
    { fecha: '2026-11-11', clase: 'Bachata 0', color: '#7c4ddb' },
    { fecha: '2026-11-08', clase: 'Salsa 1', color: '#e8445a' },
  ],
  tienda: [
    { nombre: 'Playera Calo', precio: 25000, emoji: '👕', foto: null, descripcion: '' },
    { nombre: 'Agua', precio: 1500, emoji: '💧', foto: null, descripcion: '' },
  ],
};
let respuesta = DATOS;
let tokenPedido = null;
await ctx.route('**/rest/v1/rpc/portal_alumno', async (route) => {
  tokenPedido = JSON.parse(route.request().postData() || '{}').p_token;
  if (respuesta === 'caida') return route.abort();
  await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(respuesta) });
});

// 1) portal con datos
await page.goto(`http://localhost:4173/p/${TOKEN}`);
await page.getByText('Tu pase de entrada').waitFor();
await page.waitForTimeout(500);
let t = (await page.locator('body').innerText()).replace(/\s+/g, ' ');
console.log('1) portal: QR, plan, clases, tienda:', ok(tokenPedido === TOKEN && /(días|tardes|noches), Ana/.test(t) && /5 de 8 clases usadas/.test(t) && (await page.getByRole('img', { name: 'Te quedan 3 clases' }).count()) === 1 && /Después sigue: Mensualidad/.test(t) && /Bachata 0/.test(t) && /Playera Calo/.test(t) && (await page.getByRole('button', { name: 'Mostrar mi pase en grande' }).count()) === 1));
await page.screenshot({ path: `${OUT}portal-1.png`, fullPage: true });

// 2) sin internet: se ve lo último guardado
respuesta = 'caida';
await page.reload();
await page.getByText('Tu pase de entrada').waitFor();
await page.waitForTimeout(500);
t = (await page.locator('body').innerText()).replace(/\s+/g, ' ');
console.log('2) sin conexión muestra lo guardado:', ok(/Sin conexión/.test(t) && /5 de 8 clases usadas/.test(t)));

// 3) enlace regenerado: ya no funciona y borra lo guardado
respuesta = null;
await page.reload();
await page.getByText('Este enlace ya no funciona').waitFor();
const guardado = await page.evaluate((tk) => localStorage.getItem('compas-portal:' + tk), TOKEN);
console.log('3) enlace viejo no funciona y no deja datos:', ok(guardado === null));

// 4) sin plan / beca
respuesta = { ...DATOS, planes: [{ plan: 'Beca', tipo: 'paquete', beca: true, inicio: '2026-10-01', fin: '2027-03-29', clases: null, usadas: 30 }], tienda: [] };
await page.reload();
await page.getByText('Tu pase de entrada').waitFor();
t = (await page.locator('body').innerText()).replace(/\s+/g, ' ');
console.log('4) becado:', ok(/Beca Beca/.test(t) && !/En la academia/.test(t)));

// 5) token inválido no se trata como portal (va a la app)
await page.goto('http://localhost:4173/p/corto');
await page.waitForTimeout(800);
console.log('5) token corto no abre portal:', ok(!(await page.getByText('Tu pase de entrada').count())));

// 6) desde la app: el mensaje "Su portal" lleva el enlace
await page.goto('http://localhost:4173/');
await page.waitForFunction(() => !!window.compasDev);
await page.evaluate(async () => { await window.compasDev.sembrar(); });
await page.reload();
await page.getByText('Monse', { exact: true }).click();
for (const d of '1111') await page.getByRole('button', { name: d, exact: true }).click();
await page.getByPlaceholder(/Quién llegó|Buscar…/).waitFor();
await page.getByRole('link', { name: 'Alumnos', exact: true }).click();
await page.locator('main .divide-y button').first().click();
await page.getByRole('button', { name: /WhatsApp/ }).first().click();
const enlace = page.getByRole('dialog').getByRole('link', { name: /Su portal/ });
await enlace.waitFor();
const href = decodeURIComponent(await enlace.getAttribute('href'));
const m = href.match(/\/p\/([A-Za-z0-9]{26})\b/);
console.log('6) mensaje con enlace personal de 26 caracteres:', ok(!!m), m?.[1]);
await page.screenshot({ path: `${OUT}portal-2-whats.png` });
// el mismo enlace al volver a abrir (no se regenera)
await page.keyboard.press('Escape');
await page.getByRole('button', { name: /WhatsApp/ }).first().click();
const href2 = decodeURIComponent(await page.getByRole('dialog').getByRole('link', { name: /Su portal/ }).getAttribute('href'));
console.log('   el enlace se conserva:', ok(href2.includes(m?.[1])));
const abrir = page.getByRole('dialog').getByRole('link', { name: 'Abrir su portal' });
const hrefAbrir = await abrir.getAttribute('href');
console.log('7) botón Abrir su portal con el mismo enlace:', ok(hrefAbrir?.endsWith('/p/' + m?.[1]) && (await page.getByRole('dialog').getByRole('button', { name: 'Copiar enlace' }).count()) === 1));
console.log('errores:', errores.length ? errores : 'ninguno');
await browser.close();
