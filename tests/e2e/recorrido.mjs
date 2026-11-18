// Recorrido de UX/UI: cada pantalla con cada rol, en celular y PC, claro y oscuro.
// Toma capturas (tests/e2e/salida/recorrido/) y revisa en automático:
//  · nada se sale a lo ancho (scroll horizontal) → MAL
//  · botones y enlaces sin nombre (lectores de pantalla) → MAL
//  · errores de la página → MAL
//  · botones chicos para el dedo (< 40 px) y textos con poco contraste → se listan como aviso
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';
import { revisarPagina } from './revisar.mjs';
const OUT = new URL('./salida/recorrido/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
mkdirSync(OUT, { recursive: true });
const ok = (c) => (c ? 'OK' : 'MAL');
const SOLO = process.env.RECORRIDO; // p. ej. RECORRIDO=m-claro para una sola combinación

const PANTALLAS = {
  dueno: ['/', '/alumnos', '/caja', '/reportes', '/mas', '/pendientes', '/agenda', '/agenda/eventos', '/reportes/gastos', '/alumnos/interesados', '/alumnos/listas', '/encargos', '/ajustes/pagina', '/ajustes/clases', '/ajustes/planes', '/ajustes/productos', '/ajustes/maestros', '/ajustes/sedes', '/ajustes/disciplinas', '/ajustes/usuarios', '/ajustes/mensajes', '/ajustes/academia', '/ajustes/nube', 'ficha'],
  recepcion: ['/', '/alumnos', '/caja', '/agenda', '/mas', '/pendientes'],
  maestro: ['/'],
};
const QUIEN = { dueno: ['Dirección Calo', '1234'], recepcion: ['Monse', '1111'], maestro: ['Profe Luis Herrera', '5555'] };
const COMBOS = [
  ['m', 'claro', { width: 390, height: 844 }, 'light'],
  ['m', 'oscuro', { width: 390, height: 844 }, 'dark'],
  ['pc', 'claro', { width: 1366, height: 860 }, 'light'],
].filter(([d, t]) => !SOLO || SOLO === `${d}-${t}`);

const browser = await chromium.launch({ channel: 'msedge' });
const problemas = [];
const chicos = new Map();
const contraste = new Map();
let revisadas = 0;

for (const [disp, tema, viewport, esquema] of COMBOS) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1, isMobile: disp === 'm', hasTouch: disp === 'm', locale: 'es-MX', colorScheme: esquema });
  const page = await ctx.newPage();
  await page.clock.install({ time: new Date('2026-11-18T19:10:00') });
  const errores = [];
  page.on('pageerror', (e) => errores.push(e.message));
  const ir = (r) => page.evaluate((x) => { history.pushState(null, '', x); dispatchEvent(new PopStateEvent('popstate')); }, r);
  await page.goto('http://localhost:4173/');
  await page.waitForFunction(() => !!window.compasDev);
  await page.evaluate(() => window.compasDev.demoCompleta());
  await page.reload();

  for (const [rol, rutas] of Object.entries(PANTALLAS)) {
    await page.getByText(QUIEN[rol][0], { exact: true }).click();
    for (const d of QUIEN[rol][1]) await page.getByRole('button', { name: d, exact: true }).click();
    await page.waitForTimeout(900);
    for (const ruta of rutas) {
      let r = ruta;
      if (ruta === 'ficha') r = `/alumnos/${await page.evaluate(async () => (await window.compasDev.db.alumnos.filter((a) => a.activo && !a.deletedAt).first()).id)}`;
      await ir(r);
      await page.waitForTimeout(700);
      const antes = errores.length;
      const rev = await revisarPagina(page);
      const id = `${disp}-${tema}-${rol}${r === '/' ? '-inicio' : r.replace(/\//g, '-').replace(/-[0-9a-f-]{36}$/, '-ficha')}`;
      await page.screenshot({ path: `${OUT}${id}.png`, fullPage: true });
      revisadas++;
      if (rev.ancho) problemas.push(`${id}: se sale a lo ancho`);
      if (rev.sinNombre.length) problemas.push(`${id}: ${rev.sinNombre.length} botón(es) sin nombre: ${rev.sinNombre[0]}`);
      if (errores.length > antes) problemas.push(`${id}: error: ${errores.at(-1)}`);
      for (const c of rev.chicos) chicos.set(c, [...(chicos.get(c) ?? []), id]);
      for (const c of rev.contraste) contraste.set(c, [...(contraste.get(c) ?? []), id]);
    }
    await ir('/');
    await page.waitForTimeout(500);
    await page.getByRole('button', { name: /cambiar usuario/i }).first().click();
    await page.getByText('¿Quién eres?').waitFor();
  }
  await ctx.close();
}
await browser.close();

console.log(`pantallas revisadas: ${revisadas}`);
console.log('nada se sale, todo tiene nombre, sin errores:', ok(problemas.length === 0));
for (const p of problemas.slice(0, 40)) console.log('   ', p);
if (chicos.size) {
  console.log(`aviso: ${chicos.size} botones de menos de 40 px (difíciles de tocar):`);
  for (const [n, d] of [...chicos.entries()].sort((a, b) => b[1].length - a[1].length).slice(0, 25)) console.log(`    "${n}" en ${d.length} pantalla(s), p. ej. ${d[0]}`);
}
if (contraste.size) {
  console.log(`aviso: ${contraste.size} textos con poco contraste (difíciles de leer):`);
  for (const [n, d] of [...contraste.entries()].sort((a, b) => b[1].length - a[1].length).slice(0, 30)) console.log(`    ${n} en ${d.length} pantalla(s), p. ej. ${d[0]}`);
}
