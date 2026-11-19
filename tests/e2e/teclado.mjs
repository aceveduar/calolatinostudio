// PC solo con teclado: entrar con PIN, cobrar con Enter, y que al tabular SIEMPRE se vea dónde está el foco.
import { chromium } from 'playwright-core';
const browser = await chromium.launch({ channel: 'msedge' });
const page = await (await browser.newContext({ viewport: { width: 1366, height: 860 }, locale: 'es-MX' })).newPage();
const errores = [];
page.on('pageerror', (e) => errores.push(e.message));
const ok = (c) => (c ? 'OK' : 'MAL');
const ir = (r) => page.evaluate((x) => { history.pushState(null, '', x); dispatchEvent(new PopStateEvent('popstate')); }, r);
const activo = () => page.evaluate(() => (document.activeElement?.getAttribute('aria-label') || document.activeElement?.textContent || '').trim().slice(0, 40));

await page.goto('http://localhost:4173/');
await page.waitForFunction(() => !!window.compasDev);
await page.evaluate(() => window.compasDev.demoCompleta());
await page.reload();

// 1) entrar sin mouse: Tab hasta "Dirección Calo", Enter y el PIN tecleado
await page.getByText('Dirección Calo', { exact: true }).waitFor(); // esperar a que aparezcan los usuarios
let llego = false;
for (let i = 0; i < 15 && !llego; i++) {
  await page.keyboard.press('Tab');
  llego = /Dirección Calo/.test(await activo());
}
if (llego) await page.keyboard.press('Enter');
await page.keyboard.type('1234', { delay: 40 });
const busca = page.getByPlaceholder(/Quién llegó|Buscar…/);
await busca.waitFor({ timeout: 10_000 }).catch(() => {});
console.log('1) entrar con Tab, Enter y el PIN tecleado:', ok(llego && (await busca.isVisible())));

// 2) cobrar sin mouse: escribir el nombre (sin hacer clic en el buscador) y Enter
const alumno = await page.evaluate(async () => {
  const db = window.compasDev.db;
  const todos = await db.alumnos.filter((a) => a.activo && !a.deletedAt).toArray();
  return todos.find((a) => todos.filter((b) => b.nombre.toLowerCase().includes(a.nombre.toLowerCase())).length === 1)?.nombre;
});
await page.locator('body').click({ position: { x: 5, y: 5 } }).catch(() => {});
await page.keyboard.type(alumno.toLowerCase(), { delay: 15 });
await page.waitForTimeout(400);
const enBuscador = await busca.inputValue();
await page.keyboard.press('Enter');
await page.waitForTimeout(800);
const cobrado = await page.getByRole('button', { name: /^Deshacer/ }).count();
console.log('2) escribir el nombre sin tocar el buscador y Enter da la entrada:', ok(enBuscador.toLowerCase() === alumno.toLowerCase() && cobrado > 0), alumno);
if (await page.getByRole('button', { name: 'Listo' }).isVisible().catch(() => false)) await page.getByRole('button', { name: 'Listo' }).focus().then(() => page.keyboard.press('Enter'));
await page.waitForTimeout(300);
await page.keyboard.press('Escape');

// 3) al tabular siempre se ve el foco (contorno o sombra), en las pantallas principales
const sinFoco = new Map();
for (const ruta of ['/', '/alumnos', '/caja', '/reportes', '/pendientes', '/agenda', '/mas', '/ajustes/clases', '/ajustes/planes']) {
  await ir(ruta);
  await page.waitForTimeout(700);
  await page.evaluate(() => document.activeElement?.blur?.());
  for (let i = 0; i < 30; i++) {
    await page.keyboard.press('Tab');
    const r = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body) return null;
      const s = getComputedStyle(el);
      const contorno = s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0;
      const sombra = s.boxShadow && s.boxShadow !== 'none';
      return contorno || sombra ? null : (el.getAttribute('aria-label') || el.textContent || el.tagName).trim().slice(0, 40);
    });
    if (r) sinFoco.set(r, [...(sinFoco.get(r) ?? []), ruta]);
  }
}
console.log('3) al tabular siempre se ve dónde está el foco:', ok(sinFoco.size === 0), sinFoco.size ? [...sinFoco.entries()].slice(0, 12).map(([k, v]) => `"${k}" (${v[0]})`).join(' · ') : '');

// 4) una hoja con teclado: se abre con Enter, el foco entra, Esc la cierra y regresa el foco
await ir('/ajustes/clases');
await page.waitForTimeout(600);
const nueva = page.getByRole('button', { name: /Nueva clase/ });
await nueva.focus();
await page.keyboard.press('Enter');
await page.getByRole('dialog').waitFor();
// la hoja mueve el foco en el siguiente cuadro de pantalla: esperar ese instante
const dentro = await page.waitForFunction(() => !!document.activeElement?.closest('[role=dialog]'), null, { timeout: 2000 }).then(() => true, () => false);
await page.keyboard.press('Escape');
await page.getByRole('dialog').waitFor({ state: 'detached' });
await page.waitForFunction(() => /Nueva clase/.test(document.activeElement?.textContent ?? ''), null, { timeout: 2000 }).catch(() => {});
const regreso = /Nueva clase/.test(await activo());
console.log('4) hoja con teclado: entra el foco, Esc cierra y regresa:', ok(dentro && regreso && !(await page.getByRole('dialog').count())));
console.log('errores:', errores.length ? errores : 'ninguno');
await browser.close();
