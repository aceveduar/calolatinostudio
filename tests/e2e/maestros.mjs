import { chromium } from 'playwright-core';

const OUT = new URL('./salida/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const browser = await chromium.launch({ channel: 'msedge' });
const nuevoCtx = () => browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'es-MX' });
const errores = [];
const ok = (c) => (c ? 'OK' : 'MAL');

// ---------- A) Migración v1 → v2 ----------
{
  const ctx = await nuevoCtx();
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errores.push('A ' + e.message));
  // Página vacía del mismo origen para sembrar una BD con el esquema v1 (Dexie v1 = IDB versión 10)
  await page.route('**/semilla', (r) => r.fulfill({ contentType: 'text/html', body: '<html></html>' }));
  await page.goto('http://localhost:4173/semilla');
  await page.evaluate(async () => {
    const t = Date.now();
    const A = 'aaaaaaaa-0000-4000-8000-000000000001';
    const D = 'dddddddd-0000-4000-8000-000000000001';
    await new Promise((res, rej) => {
      const req = indexedDB.open('compas', 10);
      req.onupgradeneeded = () => {
        const db = req.result;
        const mk = (n, idx = [], opts = { keyPath: 'id' }) => {
          const s = db.createObjectStore(n, opts);
          for (const i of idx) s.createIndex(Array.isArray(i) ? `[${i.join('+')}]` : i, i);
        };
        mk('academias');
        mk('usuarios', ['academiaId']);
        mk('disciplinas', ['academiaId']);
        mk('clases', ['academiaId', 'disciplinaId']);
        mk('planes', ['academiaId']);
        mk('alumnos', ['academiaId', 'nombre', 'codigo']);
        mk('membresias', ['academiaId', 'alumnoId', 'fin']);
        mk('pagos', ['academiaId', 'fecha', 'alumnoId']);
        mk('asistencias', ['academiaId', 'fecha', 'alumnoId', 'membresiaId', ['claseId', 'fecha']]);
        mk('cortes', ['academiaId', 'fecha']);
        const o = db.createObjectStore('outbox', { keyPath: 'seq', autoIncrement: true });
        o.createIndex('table', 'table');
        o.createIndex('id', 'id');
        db.createObjectStore('meta', { keyPath: 'key' });
      };
      req.onsuccess = () => {
        const db = req.result;
        const tx = db.transaction(['academias', 'disciplinas', 'clases', 'meta'], 'readwrite');
        const base = { academiaId: A, createdAt: t, updatedAt: t, deletedAt: null };
        tx.objectStore('academias').put({ id: A, nombre: 'Academia Vieja', moneda: 'MXN', createdAt: t, updatedAt: t, deletedAt: null });
        tx.objectStore('disciplinas').put({ id: D, nombre: 'Salsa', color: '#e8445a', ...base });
        tx.objectStore('clases').put({ id: crypto.randomUUID(), disciplinaId: D, nivel: '1', maestro: 'Profe Luis', dias: [1, 3, 5], horaInicio: '20:00', duracionMin: 60, activo: true, ...base });
        tx.objectStore('clases').put({ id: crypto.randomUUID(), disciplinaId: D, nivel: '2', maestro: 'profe luis ', dias: [2, 4], horaInicio: '20:00', duracionMin: 60, activo: true, ...base });
        tx.objectStore('clases').put({ id: crypto.randomUUID(), disciplinaId: D, nivel: '0', maestro: '', dias: [1], horaInicio: '19:00', duracionMin: 60, activo: true, ...base });
        tx.objectStore('meta').put({ key: 'academiaId', value: A });
        tx.oncomplete = () => { db.close(); res(); };
        tx.onerror = () => rej(tx.error);
      };
      req.onerror = () => rej(req.error);
    });
  });
  await page.goto('http://localhost:4173/');
  await page.waitForTimeout(1500);
  const r = await page.evaluate(async () => {
    const db = await new Promise((res) => { const q = indexedDB.open('compas'); q.onsuccess = () => res(q.result); });
    const all = (n) => new Promise((res) => { const q = db.transaction(n).objectStore(n).getAll(); q.onsuccess = () => res(q.result); });
    const maestros = await all('maestros');
    const clases = await all('clases');
    const outbox = await all('outbox');
    return { version: db.version, maestros: maestros.map((m) => m.nombre), conMaestro: clases.filter((c) => c.maestroId).length, sinMaestro: clases.filter((c) => c.maestroId === null).length, outbox: outbox.length };
  });
  console.log('A) migración:', JSON.stringify(r), ok(r.version >= 20 && r.maestros.length === 1 && r.conMaestro === 2 && r.sinMaestro === 1 && r.outbox === 4));
  await ctx.close();
}

// ---------- B) Flujo de maestros ----------
const ctx = await nuevoCtx();
const page = await ctx.newPage();
page.on('pageerror', (e) => errores.push('B ' + e.message));
page.on('console', (m) => m.type() === 'error' && errores.push('B ' + m.text()));
const shot = (n) => page.screenshot({ path: `${OUT}m-${n}.png` });
const btn = (t) => page.getByRole('button', { name: t });
const pin = async (p) => { for (const d of p) await page.getByRole('button', { name: d, exact: true }).click(); };
const busca = page.getByPlaceholder(/Quién llegó|Buscar…/);

await page.goto('http://localhost:4173/');
await btn('Crear una academia nueva').click();
await page.getByPlaceholder('Ej. Academia Son de Barrio').fill('Academia Sabor');
await page.getByPlaceholder('Ej. Eduardo').fill('Dueño');
await btn('Continuar').click();
await pin('482915');
await page.getByText('Repite tu PIN').waitFor();
await pin('482915');
await busca.waitFor();

// Alta de maestro desde Ajustes > Maestros
const abrirCatalogo = async (nombre) => {
  await page.getByRole('link', { name: 'Más' }).first().click();
  const enlace = page.getByRole('link', { name: new RegExp('^' + nombre) });
  if (!await enlace.isVisible()) await page.getByText('Clases y precios', { exact: true }).click();
  await enlace.click();
};
await abrirCatalogo('Maestros');
await btn('Nuevo maestro').click();
await page.getByPlaceholder('Ej. Profe Luis').fill('Profe Luis');
await page.getByPlaceholder('10 dígitos').fill('5512345678');
await btn('Guardar').click();
await page.getByText('Maestro guardado').waitFor();

// Asignar en Clases: Salsa 1 → Profe Luis; Salsa 0 → nuevo "Profa Karla" desde el selector
await abrirCatalogo('Clases y horarios');
await page.getByRole('button', { name: /Salsa 1/ }).click();
await page.getByRole('dialog').locator('select').nth(1).selectOption({ label: 'Profe Luis' });
await btn('Guardar horario habitual').click();
await page.getByText('Clase guardada').waitFor();
await page.getByRole('button', { name: /Salsa 0/ }).click();
await page.getByRole('dialog').locator('select').nth(1).selectOption({ label: '+ Nuevo maestro…' });
await page.getByPlaceholder('Ej. Profe Luis').fill('Profa Karla');
await btn('Guardar horario habitual').click();
await page.getByText('Clase guardada').waitFor();
await page.waitForTimeout(300);
await shot('1-clases');
const filasClases = await page.locator('main').innerText();
console.log('B1) clases muestran maestro:', ok(filasClases.includes('Profe Luis') && filasClases.includes('Profa Karla')));

await abrirCatalogo('Maestros');
await page.waitForTimeout(300);
await shot('2-maestros');
const lista = await page.locator('main').innerText();
console.log('B2) lista de maestros con sus clases:', ok(lista.includes('Profa Karla') && /Profe Luis[\s\S]*Salsa 1/.test(lista)));

// Cobrar: 2 en Salsa 1, 1 en Salsa 0
await page.getByRole('link', { name: 'Entrada' }).click();
await page.getByRole('button', { name: /cambiar de clase|Elegir clase/ }).first().click();
await page.getByRole('dialog').waitFor();
if (await page.getByRole('button', { name: 'Ver todas las clases' }).count()) await page.getByRole('button', { name: 'Ver todas las clases' }).click();
await page.getByRole('dialog').getByRole('button', { name: /Salsa 1/ }).first().click();
const hero = await page.locator('main').innerText();
console.log('B3) tarjeta muestra maestro:', ok(/con Profe Luis/i.test(hero)));
await shot('3-entrada');
for (const n of ['Ana López', 'Carlos Ruiz']) {
  await busca.fill(n);
  await page.getByText(`Nuevo: ${n}`).click();
  await page.waitForTimeout(9000 / 9);
  await btn('Listo').click();
}
await page.getByRole('button', { name: /cambiar de clase|Elegir clase/ }).first().click();
await page.getByRole('dialog').waitFor();
if (await page.getByRole('button', { name: 'Ver todas las clases' }).count()) await page.getByRole('button', { name: 'Ver todas las clases' }).click();
await page.getByRole('dialog').getByRole('button', { name: /Salsa 0/ }).first().click();
await busca.fill('Diana Pérez');
await page.getByText('Nuevo: Diana Pérez').click();
await btn('Listo').click();

await page.getByRole('link', { name: 'Caja' }).click();
await page.getByText('Cobros y asistencias', { exact: true }).click();
await page.getByText('Por maestro').waitFor();
await page.getByText('Por maestro').scrollIntoViewIfNeeded();
await shot('4-caja');
const caja = (await page.locator('main').innerText()).replace(/\s+/g, ' ');
console.log('B4) caja por maestro:', ok(/Profe Luis Salsa 1 · 2 alumnos \$80/.test(caja) && /Profa Karla Salsa 0 · 1 alumno \$40/.test(caja)));

console.log('errores:', errores.length ? errores : 'ninguno');
await browser.close();
