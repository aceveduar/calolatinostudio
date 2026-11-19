// Ajustes → Ayuda y errores: ver lo que falló en este equipo y mandarlo a soporte (también para recepción).
import { chromium } from 'playwright-core';
import { revisarPagina } from './revisar.mjs';
const OUT = new URL('./salida/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const browser = await chromium.launch({ channel: 'msedge' });
const ok = (c) => (c ? 'OK' : 'MAL');
const errores = [];
const page = await (await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'es-MX' })).newPage();
page.on('pageerror', (e) => errores.push(e.message));
await page.goto('http://localhost:4173/');
await page.waitForFunction(() => !!window.compasDev);
await page.evaluate(() => window.compasDev.demoCompleta());
await page.reload();
await page.getByText('Monse', { exact: true }).click();
for (const d of '1111') await page.getByRole('button', { name: d, exact: true }).click();
await page.waitForTimeout(600);
const ir = (r) => page.evaluate((r) => { history.pushState(null, '', r); dispatchEvent(new PopStateEvent('popstate')); }, r);

// 1) sin errores
await ir('/ajustes/ayuda');
await page.getByRole('heading', { name: 'Ayuda y errores' }).waitFor();
console.log('1) recepción entra y ve "Todo en orden":', ok((await page.getByText('Todo en orden').count()) === 1));

// 2) un error inesperado (promesa sin atender) se anota; repetido, se cuenta
await page.evaluate(() => { for (let i = 0; i < 3; i++) Promise.reject(new Error('Falla de prueba')); });
await page.waitForTimeout(300);
await ir('/ajustes');
await ir('/ajustes/ayuda');
await page.getByText('Falla de prueba').waitFor({ timeout: 3000 }).catch(() => {});
const t = (await page.locator('main').innerText()).replace(/\s+/g, ' ');
const wa = decodeURIComponent((await page.getByRole('link', { name: /Mandar a soporte/ }).getAttribute('href')).split('text=')[1]);
await page.screenshot({ path: `${OUT}ayuda-errores.png`, fullPage: true });
console.log('2a) el error aparece una vez, con "3 veces":', ok((await page.getByText('Falla de prueba').count()) === 1 && /3 veces/.test(t)), t.slice(0, 160));
console.log('2b) el reporte para WhatsApp lleva versión, equipo y el error:', ok(/^Compás v\d/.test(wa) && /Nube: /.test(wa) && /Falla de prueba/.test(wa)), wa.split('\n').slice(0, 2).join(' | '));
const r = await revisarPagina(page);
console.log('2c) pantalla sin desbordes, botones con nombre y buen contraste:', ok(!r.ancho && !r.sinNombre.length && !r.contraste?.length), JSON.stringify({ ancho: r.ancho, sinNombre: r.sinNombre, contraste: r.contraste }));

// 3) borrar pide confirmar
await page.getByRole('button', { name: 'Borrar lista' }).click();
const antes = await page.getByText('Falla de prueba').count();
await page.getByRole('button', { name: 'Sí, borrar' }).click();
console.log('3) borrar pide confirmación y luego deja "Todo en orden":', ok(antes === 1 && (await page.getByText('Todo en orden').count()) === 1));
console.log('errores:', errores.filter((m) => !/Falla de prueba/.test(m)).length ? errores : 'ninguno');
await browser.close();
