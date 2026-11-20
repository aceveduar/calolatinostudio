// Renovar un paquete que aún tiene clases: el nuevo vale desde hoy (si se formaba detrás y se le acababan las
// clases antes de la fecha, se quedaba sin plan habiendo pagado). La mensualidad sigue formándose detrás.
import { chromium } from 'playwright-core';
const OUT = new URL('./salida/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const ok = (c) => (c ? 'OK' : 'MAL');
const b = await chromium.launch({ channel: 'msedge' });
const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'es-MX' })).newPage();
const errores = [];
p.on('pageerror', (e) => errores.push(e.message));
const ir = (ruta) => p.evaluate((r) => { history.pushState(null, '', r); dispatchEvent(new PopStateEvent('popstate')); }, ruta);
await p.goto('http://localhost:4173/');
await p.waitForFunction(() => !!window.compasDev);
await p.evaluate(() => window.compasDev.sembrar());
await p.reload();
await p.getByText('Monse', { exact: true }).click();
await p.keyboard.type('1111', { delay: 30 });
await p.waitForTimeout(1200);

// alumnos con un plan vigente: uno de paquete con clases por usar y uno de mensualidad
const datos = await p.evaluate(async () => {
  const { db } = window.compasDev;
  const d = new Date();
  const hoy = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const planes = await db.planes.toArray();
  const asis = await db.asistencias.toArray();
  const usadas = (id) => asis.filter((a) => a.membresiaId === id && !a.anuladaAt && !a.deletedAt).length;
  const vigentes = (await db.membresias.toArray()).filter((m) => !m.anuladaAt && !m.deletedAt && m.inicio <= hoy && m.fin >= hoy);
  const paq = vigentes.find((m) => m.clasesTotal !== null && usadas(m.id) < m.clasesTotal && planes.find((x) => x.id === m.planId)?.tipo === 'paquete' && !vigentes.some((o) => o.alumnoId === m.alumnoId && o.id !== m.id));
  const men = vigentes.find((m) => planes.find((x) => x.id === m.planId)?.tipo === 'mensual' && !m.claseIds?.length && !vigentes.some((o) => o.alumnoId === m.alumnoId && o.id !== m.id));
  const plan = (m) => planes.find((x) => x.id === m.planId).nombre;
  return { hoy, paq: { alumnoId: paq.alumnoId, plan: plan(paq), quedan: paq.clasesTotal - usadas(paq.id), fin: paq.fin }, men: men && { alumnoId: men.alumnoId, plan: plan(men) } };
});

// 1) paquete: vale desde hoy y lo dice
await ir(`/alumnos/${datos.paq.alumnoId}`);
await p.getByRole('button', { name: /Vender plan/ }).click();
const dlg = p.getByRole('dialog');
await dlg.getByRole('button', { name: new RegExp(datos.paq.plan) }).first().click();
await p.waitForTimeout(300);
const txt = (await dlg.innerText()).replace(/\s+/g, ' ');
await p.screenshot({ path: `${OUT}paquete-1.png` });
console.log('1) renovar paquete con clases: "Vale desde hoy" y cuántas le quedan:', ok(/Vale desde hoy\. Primero usa (la clase que le queda|las \d+ clases que le quedan)/.test(txt) && !/Renovación: empieza/.test(txt)), datos.paq.quedan);
await dlg.getByRole('button', { name: /^Cobrar/ }).click();
await p.getByText(/cobrad[oa]/).first().waitFor({ timeout: 5000 });
const nuevo = await p.evaluate(async (id) => (await window.compasDev.db.membresias.where('alumnoId').equals(id).toArray()).sort((a, b) => b.createdAt - a.createdAt)[0], datos.paq.alumnoId);
console.log('2) el paquete nuevo empieza hoy (no al terminar el actual):', ok(nuevo.inicio === datos.hoy), nuevo.inicio, 'actual vence', datos.paq.fin);

// 3) mensualidad: se sigue formando detrás
if (datos.men) {
  await p.keyboard.press('Escape');
  await ir(`/alumnos/${datos.men.alumnoId}`);
  await p.getByRole('button', { name: /Vender plan/ }).click();
  await dlg.getByRole('button', { name: new RegExp(datos.men.plan) }).first().click();
  await p.waitForTimeout(300);
  console.log('3) renovar mensualidad: empieza al terminar la actual:', ok(/Renovación: empieza cuando termine su plan actual/.test(await dlg.innerText())));

  // 4) cambiar de mensualidad a paquete: se puede abonar lo que le quedaba (apagado de inicio); el anterior termina hoy
  const pesos = (t) => Number(t.match(/\$([\d,]+)/)[1].replace(/,/g, ''));
  const cobrarBtn = dlg.getByRole('button', { name: /^Cobrar \$/ });
  await dlg.getByRole('button', { name: new RegExp(datos.paq.plan) }).first().click();
  const sw = dlg.getByRole('switch', { name: /Abonar lo que le quedaba de su/ });
  await sw.waitFor({ timeout: 3000 });
  const apagado = (await sw.getAttribute('aria-checked')) === 'false';
  const valor = pesos(await sw.innerText());
  const precio = pesos(await cobrarBtn.innerText());
  await sw.click();
  await p.screenshot({ path: `${OUT}paquete-2-abono.png` });
  const boton = await cobrarBtn.innerText();
  console.log('4) cambio de plan: ofrece abonar (apagado) y descuenta al prenderlo:', ok(apagado && valor > 0 && pesos(boton) === precio - valor && /con abono/.test(boton)), valor, precio, boton);
  await cobrarBtn.click();
  await p.getByText(/cobrad[oa]/).first().waitFor({ timeout: 5000 });
  const r = await p.evaluate(async ([id, dia]) => {
    const { db } = window.compasDev;
    const ms = (await db.membresias.where('alumnoId').equals(id).toArray()).sort((a, b) => b.createdAt - a.createdAt);
    const pago = await db.pagos.get(ms[0].pagoId);
    return { anteriorFin: ms[1].fin, monto: pago.monto, concepto: pago.concepto, dia };
  }, [datos.men.alumnoId, datos.hoy]);
  console.log('5) la mensualidad anterior termina hoy y el cobro dice el abono:', ok(r.anteriorFin === r.dia && r.monto === (precio - valor) * 100 && /abono de su mensualidad/.test(r.concepto)), JSON.stringify(r));
}
console.log('errores:', errores.length ? errores : 'ninguno');
await b.close();
