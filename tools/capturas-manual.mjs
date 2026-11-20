// Genera las capturas del manual "Cómo se usa" (public/ayuda/*.jpg) con la demo, en tamaño de celular.
// Uso: npm run test:e2e -- --sin-build (o cualquier corrida que deje dist-prueba) y luego: node tools/capturas-manual.mjs
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { leerEncabezados, servir } from '../tests/e2e/servidor.mjs';
const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(RAIZ, 'public', 'ayuda');
const servidor = await servir({ carpeta: path.join(RAIZ, 'dist-prueba'), puerto: 4175, encabezados: leerEncabezados(path.join(RAIZ, 'public', '_headers')) });
const b = await chromium.launch({ channel: 'msedge' });
const p = await (await b.newContext({ viewport: { width: 390, height: 760 }, deviceScaleFactor: 1.5, isMobile: true, hasTouch: true, locale: 'es-MX' })).newPage();
await p.clock.install({ time: new Date('2026-11-18T19:12:00') });
await p.goto('http://localhost:4175/');
await p.waitForFunction(() => !!window.compasDev);
await p.evaluate(() => window.compasDev.demoCompleta());
await p.reload();
await p.getByText('Dirección', { exact: false }).first().click();
await p.keyboard.type('1234', { delay: 30 });
await p.waitForTimeout(1500);
const foto = (n) => p.screenshot({ path: path.join(OUT, `${n}.jpg`), type: 'jpeg', quality: 72 });
const ir = async (r) => { await p.evaluate((x) => { history.pushState(null, '', x); dispatchEvent(new PopStateEvent('popstate')); }, r); await p.waitForTimeout(1500); };

// Entrada con una cuenta abierta
const fichas = p.locator('main button').filter({ hasText: /Plan|Paga/ });
await fichas.filter({ hasText: 'Paga' }).nth(0).click();
await fichas.filter({ hasText: 'Paga' }).nth(1).click();
await p.waitForTimeout(700);
await foto('entrada');
await p.getByRole('button', { name: 'Listo', exact: true }).click();
await p.waitForTimeout(500);

// Ficha y vender plan
const id = await p.evaluate(async () => (await window.compasDev.db.membresias.toArray()).find((m) => m.fin >= '2026-11-25' && !m.anuladaAt)?.alumnoId);
await ir(`/alumnos/${id}`);
await foto('ficha');
await p.getByRole('button', { name: /Vender plan/ }).click();
await p.waitForTimeout(700);
await foto('vender');
await p.getByRole('dialog').getByRole('button', { name: /^Cobrar/ }).click();
await p.getByRole('button', { name: 'Enviar ticket' }).click();
await p.getByRole('dialog', { name: /Ticket de compra/ }).locator('img').waitFor();
await p.waitForTimeout(800);
await foto('ticket');
await p.keyboard.press('Escape');

// Pendientes, Reportes y corte
await ir('/pendientes');
await foto('pendientes');
await ir('/reportes');
await p.getByText(/Dejaron de venir ·/).waitFor({ timeout: 20000 });
await foto('reportes');
await ir('/caja');
await p.getByRole('button', { name: /Hacer corte de caja/ }).click();
await p.getByRole('dialog', { name: 'Corte de caja' }).getByLabel('Feria con la que abrió').fill('500');
await p.waitForTimeout(500);
await foto('corte');
await b.close();
servidor.cerrar();
console.log('capturas en', OUT);
