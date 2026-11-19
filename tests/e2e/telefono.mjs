// Teléfono repetido (aviso, no bloqueo) y aviso en la hoja de WhatsApp cuando el equipo no está conectado a la nube.
import { chromium } from 'playwright-core';
const OUT = new URL('./salida/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const browser = await chromium.launch({ channel: 'msedge' });
const ok = (c) => (c ? 'OK' : 'MAL');
const errores = [];
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'es-MX' });
const page = await ctx.newPage();
page.on('pageerror', (e) => errores.push(e.message));
await page.goto('http://localhost:4173/');
await page.waitForFunction(() => !!window.compasDev);
await page.evaluate(() => window.compasDev.demoCompleta());
await page.reload();
await page.getByText('Monse', { exact: true }).click();
for (const d of '1111') await page.getByRole('button', { name: d, exact: true }).click();
await page.waitForTimeout(600);
const ir = (r) => page.evaluate((r) => { history.pushState(null, '', r); dispatchEvent(new PopStateEvent('popstate')); }, r);
const alguien = await page.evaluate(async () => (await window.compasDev.db.alumnos.toArray()).find((a) => a.activo && a.telefono.length === 10));

// 1) alta con un teléfono que ya existe: avisa, pero deja registrar
await ir('/alumnos');
await page.getByRole('button', { name: 'Nuevo' }).click();
await page.getByPlaceholder('Nombre y apellido').fill('Hermana Prueba');
await page.getByPlaceholder('10 dígitos').fill(alguien.telefono.replace(/(\d{2})(\d{4})(\d{4})/, '$1 $2 $3'));
const aviso = page.getByText(/Este teléfono ya lo tiene/);
await aviso.waitFor({ timeout: 3000 }).catch(() => {});
const t = (await aviso.count()) ? await aviso.innerText() : '';
await page.screenshot({ path: `${OUT}telefono-repetido.png` });
console.log('1a) avisa quién ya tiene ese teléfono:', ok(t.includes(alguien.nombre)), t);
console.log('1b) se puede registrar de todos modos:', ok(await page.getByRole('button', { name: 'Registrar alumno' }).isEnabled()));
await page.getByPlaceholder('10 dígitos').fill('5500000001');
console.log('1c) con un teléfono nuevo no avisa:', ok((await page.getByText(/Este teléfono ya lo tiene/).count()) === 0));

// 2) hoja de WhatsApp en un equipo sin conectar a la nube
await ir(`/alumnos/${alguien.id}`);
await page.getByRole('button', { name: 'WhatsApp' }).click();
const sinNube = page.getByText(/no está conectado a la nube/);
await sinNube.waitFor({ timeout: 3000 }).catch(() => {});
await page.screenshot({ path: `${OUT}whatsapp-sin-nube.png` });
console.log('2) la hoja de WhatsApp avisa que el portal no abrirá sin nube:', ok((await sinNube.count()) === 1));
console.log('errores:', errores.length ? errores : 'ninguno');
await browser.close();
