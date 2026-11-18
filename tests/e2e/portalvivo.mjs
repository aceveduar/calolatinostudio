// Portal del alumno: próxima clase, pase en grande, plan con círculo y renovar por WhatsApp, logros. Sin nube.
import { chromium } from 'playwright-core';
const OUT = new URL('./salida/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const browser = await chromium.launch({ channel: 'msedge' });
const ok = (c) => (c ? 'OK' : 'MAL');
const errores = [];
const TOKEN = 'AbCdEfGhJkLmNpQrStUvWxYz23';
const base = {
  hoy: '2026-11-18',
  alumno: { nombre: 'Ana López', codigo: 'K7P2QX', foto: null },
  academia: { nombre: 'Calo Latino Studio', color: '#d6334a', logo: null, whatsapp: '5648141057', slug: 'calo-latino' },
  planes: [{ plan: 'Paquete 8 clases', tipo: 'paquete', beca: false, inicio: '2026-11-01', fin: '2026-11-30', clases: 8, usadas: 7 }],
  clases: [{ fecha: '2026-11-16', clase: 'Salsa 1', color: '#e8445a' }],
  horario: [
    { clase: 'Salsa 1', color: '#e8445a', dias: [1, 3], hora: '19:00', duracion: 60 },
    { clase: 'Bachata 0', color: '#7c4ddb', dias: [3], hora: '20:00', duracion: 60 },
  ],
  logros: { total: 24, desde: '2025-09-03', semanas: ['2026-11-16', '2026-11-09', '2026-11-02', '2026-10-26'] },
  tienda: [],
};

async function abrir(datos, { pc = false, oscuro = false, hora = '2026-11-18T17:30:00' } = {}) {
  const ctx = await browser.newContext({ viewport: pc ? { width: 1280, height: 900 } : { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: !pc, hasTouch: true, locale: 'es-MX', colorScheme: oscuro ? 'dark' : 'light' });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errores.push(e.message));
  await page.clock.install({ time: new Date(hora) });
  await ctx.route('**/rest/v1/rpc/portal_alumno', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(datos) }));
  await page.goto(`http://localhost:4173/p/${TOKEN}`);
  await page.getByText('Tu pase de entrada').waitFor();
  await page.waitForTimeout(600);
  return { page, ctx, t: (await page.locator('body').innerText()).replace(/\s+/g, ' ') };
}

// 1) lo nuevo, en celular
let { page, ctx, t } = await abrir(base);
console.log('1) saludo según la hora:', ok(/Buenas tardes, Ana/.test(t)));
console.log('2) próxima clase con cuánto falta:', ok(/Tu próxima clase Salsa 1 Hoy · en 1 h 30 min 19:00 – 20:00/i.test(t)), t.match(/Tu próxima clase.{0,60}/i)?.[0]);
console.log('3) su semana:', ok(/Lun 19:00 Salsa 1/.test(t) && /Mié 19:00 Salsa 1 · 20:00 Bachata 0/.test(t)));
console.log('4) plan: círculo con 1 clase y aviso:', ok((await page.getByRole('img', { name: 'Te quedan 1 clase' }).count()) === 1 && /Por terminar/.test(t)));
const wa = await page.getByRole('link', { name: 'Renovar por WhatsApp' }).getAttribute('href');
console.log('5) renovar por WhatsApp con mensaje listo:', ok(/wa\.me\/525648141057\?text=.*K7P2QX.*Paquete%208%20clases/.test(wa)));
console.log('6) logros: total, racha e insignia siguiente:', ok(/24 clases/.test(t) && /🔥 4 semanas seguidas/.test(t) && /Te falta 1 clase para 💃 Bailador/.test(t) && /desde septiembre de 2025/.test(t)));
await page.screenshot({ path: `${OUT}portal-vivo-m-1.png` });
await page.screenshot({ path: `${OUT}portal-vivo-m-full.png`, fullPage: true });
await page.getByRole('button', { name: 'Mostrar mi pase', exact: true }).click();
const dlg = page.getByRole('dialog', { name: 'Mi pase de entrada' });
await dlg.waitFor();
const caja = await dlg.getByRole('img', { name: 'Tu código QR' }).boundingBox();
console.log('7) pase en grande (QR ≥ 300 px):', ok(caja && caja.width >= 300), Math.round(caja?.width ?? 0));
await page.screenshot({ path: `${OUT}portal-vivo-m-pase.png` });
await dlg.getByRole('button', { name: 'Listo' }).click();
await page.waitForTimeout(300);
console.log('8) se cierra con "Listo":', ok(!(await dlg.isVisible())));
await ctx.close();

// 2) durante la clase: "ahora"
({ page, ctx, t } = await abrir(base, { hora: '2026-11-18T19:20:00' }));
console.log('9) en clase: "Está empezando":', ok(/Está empezando, ¡corre!/.test(t)));
await ctx.close();

// 3) sin plan y sin horario: invita a preguntar y a ver el horario
({ page, ctx, t } = await abrir({ ...base, planes: [], horario: [], logros: { total: 0, desde: null, semanas: [] } }));
console.log('10) sin plan: preguntar por planes; sin horario: enlace al horario:', ok(/Pagas por clase/.test(t) && (await page.getByRole('link', { name: 'Preguntar por planes' }).count()) === 1 && (await page.getByRole('link', { name: /Ver el horario/ }).getAttribute('href')) === '/a/calo-latino#horario' && !/Tus logros/.test(t)));
await ctx.close();

// 4) datos de una base anterior (sin horario ni logros): no truena
({ page, ctx, t } = await abrir({ ...base, horario: undefined, logros: undefined, academia: { nombre: 'Calo Latino Studio', color: '#d6334a', logo: null } }));
console.log('11) base anterior: sigue funcionando:', ok(/Tu pase de entrada/i.test(t) && /Paquete 8 clases/.test(t) && /Pregunta en recepción/.test(t)));
await ctx.close();

// 5) capturas en PC y modo oscuro
({ page, ctx } = await abrir(base, { oscuro: true }));
await page.screenshot({ path: `${OUT}portal-vivo-m-oscuro.png`, fullPage: true });
await ctx.close();
({ page, ctx } = await abrir(base, { pc: true }));
await page.screenshot({ path: `${OUT}portal-vivo-pc.png` });
await ctx.close();

console.log('errores:', errores.length ? errores : 'ninguno');
await browser.close();
