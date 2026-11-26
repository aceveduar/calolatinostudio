// ¿Los números cuadran? Con la academia grande (5,000 alumnos, 6 meses):
//  A) los datos son coherentes por dentro (planes, entradas, cobros);
//  B) lo que muestran Caja, Reportes y Gastos es igual a la suma directa de los cobros y gastos.
import { chromium } from 'playwright-core';
const browser = await chromium.launch({ channel: 'msedge' });
const page = await (await browser.newContext({ viewport: { width: 1366, height: 900 }, locale: 'es-MX' })).newPage();
const errores = [];
page.on('pageerror', (e) => errores.push(e.message));
const ok = (c) => (c ? 'OK' : 'MAL');
const ir = (r) => page.evaluate((x) => { history.pushState(null, '', x); dispatchEvent(new PopStateEvent('popstate')); }, r);
const pesos = (t) => Math.round(Number(t.replace(/[^0-9.]/g, '')) * 100);
const dinero = (c) => `$${(c / 100).toLocaleString('es-MX')}`;
await page.clock.install({ time: new Date('2026-11-18T19:05:00') });

await page.goto('http://localhost:4173/');
await page.waitForFunction(() => !!window.compasDev);
await page.evaluate(async () => {
  const dev = window.compasDev;
  await dev.sembrar();
  for (const t of dev.db.tables.map((x) => x.name)) if (!['academias', 'usuarios', 'meta'].includes(t)) await dev.db.table(t).clear();
  await dev.academiaGrande({ alumnos: 5000, meses: 6 });
  await dev.db.outbox.clear();
});

// A) coherencia por dentro
const A = await page.evaluate(async () => {
  const db = window.compasDev.db;
  const [mems, asis, pagos, planes] = await Promise.all([db.membresias.toArray(), db.asistencias.toArray(), db.pagos.toArray(), db.planes.toArray()]);
  const pagoPorId = new Map(pagos.map((p) => [p.id, p]));
  const planPorId = new Map(planes.map((p) => [p.id, p]));
  const memPorId = new Map(mems.map((m) => [m.id, m]));
  const usadas = new Map();
  for (const a of asis) if (a.membresiaId && !a.anuladaAt) usadas.set(a.membresiaId, (usadas.get(a.membresiaId) ?? 0) + 1);
  const paquetesPasados = mems.filter((m) => m.clasesTotal !== null && (usadas.get(m.id) ?? 0) > m.clasesTotal).length;
  const sinCubrir = asis.filter((a) => {
    if (a.anuladaAt) return false;
    if (a.debe) return false;
    if (a.pagoId) return !pagoPorId.has(a.pagoId);
    const m = a.membresiaId && memPorId.get(a.membresiaId);
    return !m || a.fecha < m.inicio || a.fecha > m.fin;
  }).length;
  const planSinCobro = mems.filter((m) => (planPorId.get(m.planId)?.precio ?? 0) > 0 && pagoPorId.get(m.pagoId)?.monto !== planPorId.get(m.planId)?.precio).length;
  const cobrosRaros = pagos.filter((p) => !(p.monto > 0) || (p.planId && !planPorId.has(p.planId))).length;
  return { paquetesPasados, sinCubrir, planSinCobro, cobrosRaros, n: { mems: mems.length, asis: asis.length, pagos: pagos.length } };
});
console.log('A1) ningún paquete con más clases usadas que las que compró:', ok(A.paquetesPasados === 0), A.paquetesPasados);
console.log('A2) toda entrada la cubre un plan vigente, un cobro o un fiado:', ok(A.sinCubrir === 0), A.sinCubrir);
console.log('A3) todo plan con precio tiene su cobro por ese monto:', ok(A.planSinCobro === 0), A.planSinCobro);
console.log('A4) ningún cobro sin monto o con un plan que no existe:', ok(A.cobrosRaros === 0), A.cobrosRaros, JSON.stringify(A.n));

// sumas directas (lo que debería mostrar cada pantalla)
const suma = (desde, hasta, filtro = 'todo') =>
  page.evaluate(async ([d, h, f]) => {
    const ps = (await window.compasDev.db.pagos.where('fecha').between(d, h, true, true).toArray()).filter((p) => !p.anuladoAt && !p.deletedAt && (f !== 'efectivo' || p.metodo === 'efectivo'));
    return ps.reduce((s, p) => s + p.monto, 0);
  }, [desde, hasta, filtro]);
const gastosMes = () => page.evaluate(async () => (await window.compasDev.db.gastos.where('fecha').between('2026-11-01', '2026-11-30', true, true).toArray()).filter((g) => !g.deletedAt).reduce((s, g) => s + g.monto, 0));

await page.reload();
await page.getByText('Dirección Calo', { exact: true }).click();
await page.keyboard.type('1234', { delay: 30 });
await page.getByPlaceholder(/Quién llegó|Buscar…/).waitFor({ timeout: 60_000 });

// B1) Caja: total de varios días (todas las sedes) contra la suma de cobros de ese día
await ir('/caja');
const totalVisible = page.locator('p', { hasText: 'Total cobrado' }).locator('xpath=following-sibling::p[1]');
const fechaHoy = '2026-11-18';
await totalVisible.waitFor();
const global = await suma(fechaHoy, fechaHoy);
const sedeCaja = page.getByRole('combobox', { name: 'Sede de Caja' });
await sedeCaja.selectOption('todas');
const textoAlCambiar = await totalVisible.textContent({ timeout: 100 }).catch(() => null);
console.log('B0) cambiar de sede oculta el total anterior mientras recalcula:', ok(textoAlCambiar === null || pesos(textoAlCambiar) === global));
const fallasCaja = [];
for (let d = 0; d < 6; d++) {
  await page.waitForTimeout(500);
  const fecha = await page.evaluate((x) => { const f = new Date('2026-11-18T12:00:00'); f.setDate(f.getDate() - x); return f.toISOString().slice(0, 10); }, d);
  await page.getByText('Total cobrado').waitFor();
  const total = pesos(await page.locator('p', { hasText: 'Total cobrado' }).locator('xpath=following-sibling::p[1]').innerText());
  const directo = await suma(fecha, fecha);
  if (total !== directo) fallasCaja.push(`${fecha}: pantalla ${dinero(total)} vs ${dinero(directo)}`);
  await page.getByRole('button', { name: 'Día anterior' }).click();
}
console.log('B1) Caja de 6 días = suma de sus cobros:', ok(fallasCaja.length === 0), fallasCaja.join(' | '));

// B2) corte de caja de hoy: efectivo esperado = cobros en efectivo de hoy (sede principal)
await ir('/caja');
await page.waitForTimeout(500);
await page.getByRole('button', { name: 'Ir a hoy' }).click().catch(() => {});
await page.waitForTimeout(300);
await sedeCaja.selectOption({ label: 'Estudio Calo' });
await page.waitForTimeout(400);
await page.getByRole('button', { name: /Hacer corte de caja/ }).click();
const dlg = page.getByRole('dialog');
await dlg.waitFor();
const importeEsperado = dlg.getByText('Efectivo esperado en el cajón', { exact: true })
  .locator('xpath=following-sibling::p[1]').filter({ hasText: /^\$/ });
const esperado = pesos(await importeEsperado.innerText());
const efectivoHoy = await page.evaluate(async () => (await window.compasDev.db.pagos.where('fecha').equals('2026-11-18').toArray()).filter((p) => !p.anuladoAt && !p.deletedAt && p.metodo === 'efectivo' && !p.sedeId).reduce((s, p) => s + p.monto, 0));
console.log('B2) corte: efectivo esperado = efectivo cobrado hoy en la sede:', ok(esperado === efectivoHoy), dinero(esperado), 'vs', dinero(efectivoHoy));
await page.keyboard.press('Escape');

// B3) Reportes: ingresos de los últimos 30 días
await ir('/reportes');
await page.getByText('Ingresos').first().waitFor({ timeout: 20_000 });
await page.getByRole('button', { name: '30 días' }).click().catch(() => {});
await page.getByText(/Utilidad de /).waitFor({ timeout: 20_000 }); // con 30 días se leen más datos: esperar a que termine
await page.waitForTimeout(300);
const tRep = (await page.locator('main').innerText()).replace(/\s+/g, ' ');
const ingresosRep = pesos(tRep.match(/Ingresos (\$[\d,.]+)/)?.[1] ?? '0');
const directo30 = await suma('2026-10-20', '2026-11-18');
console.log('B3) Reportes: ingresos 30 días = suma directa:', ok(ingresosRep === directo30), dinero(ingresosRep), 'vs', dinero(directo30));
const utilRep = tRep.match(/Utilidad de [^$]*?(-?\$[\d,.]+)/)?.[1];

// B4) Gastos y utilidad del mes
await ir('/reportes/gastos');
await page.getByText(/deja cada clase/).waitFor({ timeout: 20_000 });
await page.waitForTimeout(500);
const tG = (await page.locator('main').innerText()).replace(/\s+/g, ' ');
const ingresosG = pesos(tG.match(/Ingresos (\$[\d,.]+)/)?.[1] ?? '0');
const gastosG = pesos(tG.match(/Gastos registrados (\$[\d,.]+)/)?.[1] ?? '0');
const [ingMes, gasMes] = [await suma('2026-11-01', '2026-11-30'), await gastosMes()];
console.log('B4) Gastos: ingresos del mes = suma directa:', ok(ingresosG === ingMes), dinero(ingresosG), 'vs', dinero(ingMes));
console.log('B5) Gastos: gastos del mes = suma directa:', ok(gastosG === gasMes), dinero(gastosG), 'vs', dinero(gasMes));
const utilG = tG.match(/Utilidad[^$]*?(-?\$[\d,.]+)/)?.[1];
console.log('B6) utilidad igual en Reportes y en Gastos:', ok(!!utilRep && utilRep === utilG), utilRep, 'vs', utilG);
console.log('errores:', errores.length ? errores : 'ninguno');
await browser.close();
