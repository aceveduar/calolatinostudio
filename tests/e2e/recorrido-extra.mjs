// Segunda vuelta de UX/UI: lo que el recorrido de pantallas no ve.
//  1) Academia recién creada (sin datos): lo primero que ve una academia nueva.
//  2) Hojas que se abren encima (vender plan, corte de caja, nuevo producto…).
//  3) Página pública y portal del alumno (con datos simulados).
// En celular claro y oscuro. Mismas revisiones que recorrido.mjs (revisar.mjs).
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';
import { revisarPagina } from './revisar.mjs';
const OUT = new URL('./salida/recorrido-extra/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
mkdirSync(OUT, { recursive: true });
const ok = (c) => (c ? 'OK' : 'MAL');
const browser = await chromium.launch({ channel: 'msedge' });
const problemas = [];
const avisos = new Map();
let revisadas = 0;

async function revisar(page, id, errores) {
  await page.waitForTimeout(500);
  const r = await revisarPagina(page);
  await page.screenshot({ path: `${OUT}${id}.png`, fullPage: true });
  revisadas++;
  if (r.ancho) problemas.push(`${id}: se sale a lo ancho`);
  if (r.sinNombre.length) problemas.push(`${id}: botón sin nombre: ${r.sinNombre[0]}`);
  if (errores.length) problemas.push(`${id}: error: ${errores.splice(0).join(' | ')}`);
  for (const c of r.chicos) avisos.set(`chico: "${c}"`, [...(avisos.get(`chico: "${c}"`) ?? []), id]);
  for (const c of r.contraste) avisos.set(`contraste: ${c}`, [...(avisos.get(`contraste: ${c}`) ?? []), id]);
}

for (const [tema, esquema] of [['claro', 'light'], ['oscuro', 'dark']]) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'es-MX', colorScheme: esquema });
  await ctx.route(/rest\/v1\/(?!rpc\/(pagina_publica|portal_alumno))/, (r) => r.fulfill({ status: 201, body: '[]' }));
  await ctx.route(/maps\.google\.com/, (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<body></body>' }));
  const page = await ctx.newPage();
  await page.clock.install({ time: new Date('2026-11-18T19:10:00') });
  const errores = [];
  page.on('pageerror', (e) => errores.push(e.message));
  const ir = async (r) => { await page.evaluate((x) => { history.pushState(null, '', x); dispatchEvent(new PopStateEvent('popstate')); }, r); await page.waitForTimeout(600); };

  // 1) academia nueva, sin datos
  await page.goto('http://localhost:4173/');
  await revisar(page, `${tema}-alta`, errores);
  await page.getByRole('button', { name: 'Crear una academia nueva' }).click();
  await page.getByPlaceholder('Ej. Academia Son de Barrio').fill('Academia Nueva');
  await page.getByPlaceholder('Ej. Eduardo').fill('Ana');
  await page.getByRole('button', { name: 'Continuar' }).click();
  for (const d of '482915') await page.getByRole('button', { name: d, exact: true }).click();
  await page.getByText('Repite tu PIN').waitFor();
  for (const d of '482915') await page.getByRole('button', { name: d, exact: true }).click();
  await page.getByPlaceholder(/Quién llegó|Buscar…/).waitFor();
  for (const r of ['/', '/alumnos', '/caja', '/reportes', '/pendientes', '/agenda', '/agenda/eventos', '/reportes/gastos', '/alumnos/interesados', '/alumnos/listas', '/encargos', '/ajustes/clases', '/ajustes/productos', '/ajustes/pagina']) {
    await ir(r);
    await revisar(page, `${tema}-vacia${r === '/' ? '-inicio' : r.replace(/\//g, '-')}`, errores);
  }

  // 2) hojas, con la demo completa
  await page.evaluate(async () => {
    indexedDB.deleteDatabase('compas');
  });
  await page.goto('http://localhost:4173/');
  await page.waitForFunction(() => !!window.compasDev);
  await page.evaluate(() => window.compasDev.demoCompleta());
  await page.reload();
  await page.getByText('Dirección Calo', { exact: true }).click();
  for (const d of '1234') await page.getByRole('button', { name: d, exact: true }).click();
  await page.getByPlaceholder(/Quién llegó|Buscar…/).waitFor();
  const alumno = await page.evaluate(async () => (await window.compasDev.db.alumnos.filter((a) => a.activo && !a.deletedAt).first()).id);
  const hojas = [
    ['vender-plan', `/alumnos/${alumno}`, /^Vender plan$/],
    ['editar-alumno', `/alumnos/${alumno}`, /^Editar$/],
    ['corte-caja', '/caja', /Hacer corte de caja/],
    ['nuevo-producto', '/ajustes/productos', /Nuevo producto/],
    ['nueva-clase', '/ajustes/clases', /Nueva clase/],
    ['nuevo-plan', '/ajustes/planes', /Nuevo plan/],
    ['nuevo-usuario', '/ajustes/usuarios', /Nuevo usuario/],
    ['tienda', '/', /^Tienda|Productos/],
  ];
  for (const [n, ruta, boton] of hojas) {
    await ir(ruta);
    const b = page.getByRole('button', { name: boton }).first();
    if (!(await b.count())) {
      problemas.push(`${tema}-hoja-${n}: no encontré el botón ${boton}`);
      continue;
    }
    await b.click();
    await page.getByRole('dialog').first().waitFor({ timeout: 5000 }).catch(() => {});
    await revisar(page, `${tema}-hoja-${n}`, errores);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  }

  // 3) página pública y portal, con datos simulados a partir de la demo
  const datos = await page.evaluate(async () => {
    const db = window.compasDev.db;
    const a = (await db.academias.toArray())[0];
    const ds = await db.disciplinas.toArray();
    const sedes = (await db.sedes.toArray()).filter((s) => !s.deletedAt && s.activo);
    const clases = (await db.clases.toArray()).filter((c) => !c.deletedAt && c.activo).map((k) => {
      const d = ds.find((x) => x.id === k.disciplinaId);
      return { id: k.id, clase: `${d?.nombre ?? 'Clase'} ${k.nivel}`.trim(), color: d?.color ?? null, dias: k.dias, hora: k.horaInicio, duracion: k.duracionMin, sede_id: k.sedeId ?? null, precio: k.precioSuelta ?? null, curso: k.curso ?? null, disciplina: d?.nombre ?? null };
    });
    const planes = (await db.planes.toArray()).filter((x) => !x.deletedAt && x.activo && x.precio > 0).map((x) => ({ nombre: x.nombre, tipo: x.tipo, precio: x.precio, clases: x.clases, vigencia: x.vigenciaDias, grupos: x.grupos ?? null, sede_id: x.sedeId ?? null }));
    return { academia: { nombre: a.nombre, color: a.color ?? null, logo: null, whatsapp: a.whatsapp ?? '5512345678', sede_principal: a.sedePrincipal || 'Estudio' }, pagina: a.pagina ?? {}, sedes: sedes.map((s) => ({ id: s.id, nombre: s.nombre, color: s.color })), clases, planes, eventos: [], tienda: [] };
  });
  await ctx.route('**/rest/v1/rpc/pagina_publica', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(datos) }));
  await page.goto('http://localhost:4173/a/calo-latino');
  await page.getByRole('heading', { level: 1 }).waitFor();
  await revisar(page, `${tema}-pagina-publica`, errores);

  const portal = {
    hoy: '2026-11-18',
    alumno: { nombre: 'Ana López', codigo: 'K7P2QX', foto: null },
    academia: { nombre: 'Calo Latino Studio', color: '#d6304a', logo: null, whatsapp: '5648141057', slug: 'calo-latino' },
    planes: [{ plan: 'Paquete 8 clases', tipo: 'paquete', beca: false, inicio: '2026-11-01', fin: '2026-11-30', clases: 8, usadas: 7 }],
    clases: [{ fecha: '2026-11-16', clase: 'Salsa 1', color: '#e8445a' }],
    horario: [{ clase: 'Salsa 1', color: '#e8445a', dias: [1, 3], hora: '19:00', duracion: 60 }],
    logros: { total: 24, desde: '2025-09-03', semanas: ['2026-11-16', '2026-11-09'] },
    tienda: [{ id: 'p1', nombre: 'Playera Calo', precio: 25000, emoji: '👕', foto: null, descripcion: '', opciones: ['CH', 'M'], disponibles: 4 }],
    pedidos: [],
  };
  await ctx.route('**/rest/v1/rpc/portal_alumno', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(portal) }));
  await page.goto('http://localhost:4173/p/AbCdEfGhJkLmNpQrStUvWxYz23');
  await page.getByText('Tu pase de entrada').waitFor();
  await revisar(page, `${tema}-portal`, errores);
  await ctx.close();
}
await browser.close();

console.log(`pantallas y hojas revisadas: ${revisadas}`);
console.log('nada se sale, todo tiene nombre, sin errores:', ok(problemas.length === 0));
for (const p of problemas.slice(0, 30)) console.log('   ', p);
if (avisos.size) {
  console.log(`aviso: ${avisos.size} detalles:`);
  for (const [n, d] of [...avisos.entries()].sort((a, b) => b[1].length - a[1].length).slice(0, 40)) console.log(`    ${n} en ${d.length}, p. ej. ${d[0]}`);
}
