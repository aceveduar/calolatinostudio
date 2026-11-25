// Corte de caja con feria y salidas de efectivo: debe haber = feria + cobrado en efectivo − salidas.
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
await page.evaluate(() => { history.pushState(null, '', '/caja'); dispatchEvent(new PopStateEvent('popstate')); });
await page.getByText('Total cobrado').waitFor();
const sedes = page.getByRole('combobox', { name: 'Sede de Caja' });
if (await sedes.count()) await sedes.selectOption({ label: 'Estudio Calo' });
const { efectivo, transferencia, fecha, sede } = await page.evaluate(async () => {
  const { db } = window.compasDev;
  const hoy = new Date().toLocaleDateString('en-CA');
  const original = await db.pagos.toCollection().first();
  const base = { ...original, fecha: hoy, sedeId: null, deletedAt: null, createdAt: Date.now(), updatedAt: Date.now() };
  await db.pagos.bulkAdd([
    { ...base, id: crypto.randomUUID(), concepto: 'Transferencia de prueba', monto: 2000, metodo: 'transferencia', anuladoAt: null },
    { ...base, id: crypto.randomUUID(), concepto: 'Cobro corregido de prueba', monto: 99999, metodo: 'efectivo', anuladoAt: Date.now() },
  ]);
  const vigentes = (await db.pagos.where('fecha').equals(hoy).toArray()).filter((p) => !p.anuladoAt && !p.deletedAt && !p.sedeId);
  const sumar = (metodo) => vigentes.filter((p) => p.metodo === metodo).reduce((s, p) => s + p.monto, 0);
  const academia = await db.academias.toCollection().first();
  return { efectivo: sumar('efectivo'), transferencia: sumar('transferencia'), fecha: hoy, sede: academia.sedePrincipal || 'Sede principal' };
});
const $ = (c) => '$' + (c / 100).toLocaleString('es-MX');

// 1) salida de efectivo
await page.getByRole('button', { name: /Registrar salida de efectivo/ }).click();
const dlg = page.getByRole('dialog', { name: 'Salida de efectivo' });
await dlg.getByPlaceholder(/garrafón/).fill('Garrafón de agua');
await dlg.getByPlaceholder('$0').fill('45');
await dlg.getByRole('button', { name: /Registrar salida de \$45/ }).click();
await page.getByText('Salidas de efectivo · 1').waitFor({ timeout: 5000 });
const t1 = (await page.locator('main').innerText()).replace(/\s+/g, ' ');
console.log('1) la salida queda en Caja (−$45) y como gasto del día:', ok(/Salieron de la caja −\$45/.test(t1) && /Garrafón de agua/.test(t1) && (await page.evaluate(async () => (await window.compasDev.db.gastos.toArray()).some((g) => g.deCaja && g.monto === 4500)))));

// 2) corte: feria + efectivo − salidas
await page.getByRole('button', { name: /Hacer corte de caja/ }).click();
const corte = page.getByRole('dialog', { name: 'Corte de caja' });
await corte.getByLabel('Feria con la que abrió').fill('500');
const esperado = 50000 + efectivo - 4500;
const t2 = (await corte.innerText()).replace(/\s+/g, ' ');
console.log('2a) esperado = feria $500 + efectivo válido − $45 de salida:', ok(t2.includes(`Efectivo esperado en el cajón ${$(esperado)}`)), $(esperado));
console.log('2a) sede, fecha y transferencia separada del cajón:', ok(t2.includes(sede) && t2.includes(`Transferencia ${$(transferencia)}`) && await corte.locator('time').getAttribute('datetime') === fecha));
// cuenta billete por billete y le faltan $20
await corte.getByRole('button', { name: 'Contar billete por billete' }).click();
const contar = async (etiqueta, n) => corte.getByLabel(etiqueta).fill(String(n));
let resto = esperado - 2000;
const billetes = [[100000, 'billete'], [50000, 'billete'], [20000, 'billete'], [10000, 'billete'], [5000, 'billete'], [2000, 'billete'], [1000, 'moneda'], [500, 'moneda'], [100, 'moneda'], [50, 'moneda']];
for (const [v, tipo] of billetes) {
  const n = Math.floor(resto / v);
  if (n > 0) { await contar(`Cuántos de ${$(v)} (${tipo})`, n); resto -= n * v; }
}
const t3 = (await corte.innerText()).replace(/\s+/g, ' ');
const guardar = corte.getByRole('button', { name: 'Guardar corte' });
console.log('2b) al contar faltan $20 y pide explicar qué pasó antes de guardar:', ok(/Faltan \$20/.test(t3) && (await guardar.isDisabled())));
await corte.getByPlaceholder(/cambio de más/).fill('Se dio cambio de más');
await page.screenshot({ path: `${OUT}corte-nuevo.png`, fullPage: true });
const r = await revisarPagina(page);
console.log('2c) sin desbordes, campos con nombre:', ok(!r.ancho && !r.sinNombre.length), JSON.stringify({ ancho: r.ancho, sinNombre: r.sinNombre }));
await guardar.click();
await page.getByText(/Corte hecho a las/).waitFor({ timeout: 5000 });
const c = await page.evaluate(async () => (await window.compasDev.db.cortes.toArray()).sort((a, b) => a.createdAt - b.createdAt).at(-1));
console.log('2d) el corte guarda feria, salidas y la diferencia:', ok(c.fondo === 50000 && c.salidas === 4500 && c.diferencia === -2000 && c.notas === 'Se dio cambio de más'), JSON.stringify({ fondo: c.fondo, salidas: c.salidas, dif: c.diferencia, notas: c.notas }));

// 3) el siguiente corte propone la misma feria
await page.getByRole('button', { name: 'Rehacer' }).click();
const campoFeria = page.getByRole('dialog', { name: 'Corte de caja' }).getByLabel('Feria con la que abrió');
await page.waitForFunction(() => document.querySelector('input[aria-label="Feria con la que abrió"]')?.value === '500', null, { timeout: 5000 }).catch(() => {});
const feria = await campoFeria.inputValue();
console.log('3) el siguiente corte ya propone la feria de $500:', ok(feria === '500'), feria);
console.log('errores:', errores.length ? errores : 'ninguno');
await browser.close();
