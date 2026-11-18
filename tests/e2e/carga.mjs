// Rendimiento con una academia grande: ~600 alumnos y un año de asistencias y cobros.
// Mide cuánto tarda cada pantalla en mostrar sus datos (celular). Falla si alguna pasa de 2.5 s.
import { chromium } from 'playwright-core';
const OUT = new URL('./salida/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const LIMITE = 2500;
const browser = await chromium.launch({ channel: 'msedge' });
const page = await (await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'es-MX' })).newPage();
const errores = [];
page.on('pageerror', (e) => errores.push(e.message));
const ok = (c) => (c ? 'OK' : 'MAL');
const ir = (r) => page.evaluate((x) => { history.pushState(null, '', x); dispatchEvent(new PopStateEvent('popstate')); }, r);

await page.goto('http://localhost:4173/');
await page.waitForFunction(() => !!window.compasDev);
const t0 = Date.now();
const datos = await page.evaluate(async () => {
  const dev = window.compasDev;
  await dev.demoCompleta();
  const actuales = await dev.db.alumnos.count();
  if (actuales < 600) await dev.ampliar(600 - actuales);
  // un año de historia: ~60,000 entradas (600 alumnos × 2 por semana × 50 semanas)
  const OBJETIVO = 60_000;
  const db = dev.db;
  const academiaId = (await db.academias.toCollection().first()).id;
  const alumnos = await db.alumnos.toArray();
  const clases = (await db.clases.toArray()).filter((c) => !c.deletedAt && c.dias.length);
  const usuario = (await db.usuarios.toCollection().first()).id;
  const hoy = new Date();
  const f = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const asis = [];
  const pagos = [];
  let semilla = 7;
  const r = () => ((semilla = (semilla * 16807) % 2147483647) / 2147483647);
  for (let dia = 365; dia >= 43; dia--) {
    const d = new Date(hoy);
    d.setDate(d.getDate() - dia);
    const delDia = clases.filter((c) => c.dias.includes(d.getDay()));
    for (const c of delDia) {
      const n = Math.round(OBJETIVO / (322 * Math.max(1, clases.length * 2 / 7))) + Math.floor(r() * 6);
      for (let i = 0; i < n; i++) {
        const a = alumnos[Math.floor(r() * alumnos.length)];
        const ts = d.getTime();
        const pagoId = r() < 0.35 ? crypto.randomUUID() : null;
        if (pagoId) pagos.push({ id: pagoId, academiaId, alumnoId: a.id, planId: null, concepto: 'Clase suelta', monto: 6000, metodo: r() < 0.7 ? 'efectivo' : 'transferencia', usuarioId: usuario, fecha: f(d), anuladoAt: null, anuladoMotivo: null, anuladoPor: null, createdAt: ts, updatedAt: ts, deletedAt: null });
        asis.push({ id: crypto.randomUUID(), academiaId, alumnoId: a.id, nombreVisitante: null, claseId: c.id, fecha: f(d), membresiaId: null, pagoId, usuarioId: usuario, anuladaAt: null, createdAt: ts, updatedAt: ts, deletedAt: null });
      }
    }
  }
  await db.asistencias.bulkAdd(asis);
  await db.pagos.bulkAdd(pagos);
  return { alumnos: await db.alumnos.count(), asistencias: await db.asistencias.count(), pagos: await db.pagos.count(), membresias: await db.membresias.count() };
});
console.log('datos:', JSON.stringify(datos), `(${Math.round((Date.now() - t0) / 1000)} s en generarse)`);
await page.reload();
await page.getByText('Dirección Calo', { exact: true }).click();
await page.keyboard.type('1234', { delay: 30 });
const buscador = page.getByPlaceholder(/Quién llegó|Buscar…/);
await buscador.waitFor();

const tiempos = {};
async function medir(nombre, accion, listo) {
  const inicio = Date.now();
  await accion();
  try {
    await page.waitForFunction(listo, null, { timeout: 15_000, polling: 50 });
    tiempos[nombre] = Date.now() - inicio;
  } catch {
    tiempos[nombre] = 99_999;
  }
}
const textoMain = (re) => new Function(`return ${re}.test(document.querySelector('main')?.innerText ?? '')`);
const nombre = await page.evaluate(async () => (await window.compasDev.db.alumnos.orderBy('nombre').filter((a) => !a.deletedAt && a.activo).first()).nombre);
const primera = nombre.split(' ')[0];

await medir('Entrada: buscar alumno', () => buscador.fill(primera.slice(0, 4)), new Function(`return (document.querySelector('main')?.innerText ?? '').includes(${JSON.stringify(nombre)})`));
await buscador.fill('');
for (const [n, ruta, re] of [
  ['Alumnos', '/alumnos', /alumnos/i],
  ['Ficha del alumno', null, /plan|clases/i],
  ['Caja', '/caja', /efectivo/i],
  ['Pendientes', '/pendientes', /renovar|deben|extrañamos|todo al día/i],
  ['Listas del mes', '/alumnos/listas', /lista|grupo/i],
  ['Reportes', '/reportes', /ingresos/i],
  ['Gastos y lo que deja cada clase', '/reportes/gastos', /deja cada clase/i],
  ['Agenda', '/agenda', /hoy|lun|mar|mié/i],
]) {
  if (ruta === null) {
    const id = await page.evaluate(async (x) => (await window.compasDev.db.alumnos.where('nombre').equals(x).first()).id, nombre);
    await medir(n, () => ir(`/alumnos/${id}`), new Function(`return (document.body.innerText.includes(${JSON.stringify(nombre)})) && ${re}.test(document.body.innerText)`));
  } else await medir(n, () => ir(ruta), textoMain(re));
  await page.waitForTimeout(300);
}
await page.screenshot({ path: `${OUT}carga-gastos.png`, fullPage: true });

// cobro: de tocar al alumno a que quede registrado
await ir('/');
await buscador.waitFor();
const antes = await page.evaluate(() => window.compasDev.db.asistencias.count());
for (const [n, ms] of Object.entries(tiempos)) console.log(`${ms <= LIMITE ? 'OK ' : 'MAL'} ${n.padEnd(34)} ${ms === 99_999 ? 'no cargó' : `${ms} ms`}`);
const peor = Math.max(...Object.values(tiempos));
console.log(`peor: ${peor} ms con ${datos.asistencias} asistencias y ${datos.pagos} cobros:`, ok(peor <= LIMITE));
console.log('errores:', errores.length ? errores : 'ninguno', antes > 0 ? '' : '');
await browser.close();
