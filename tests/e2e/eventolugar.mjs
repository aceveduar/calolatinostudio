// Eventos con más detalle: cómo venir, descripción larga y lugar (aquí, en otra sede o en otro lugar).
// En otro lugar no se aparta el salón; en la página y el portal se ve el lugar con "Cómo llegar".
import { chromium } from 'playwright-core';
import { revisarPagina } from './revisar.mjs';
const OUT = new URL('./salida/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const ok = (c) => (c ? 'OK' : 'MAL');
const b = await chromium.launch({ channel: 'msedge' });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'es-MX' });
const p = await ctx.newPage();
const errores = [];
p.on('pageerror', (e) => errores.push(e.message));
await p.clock.install({ time: new Date('2026-11-18T19:10:00') });
const ir = async (r) => { await p.evaluate((x) => { history.pushState(null, '', x); dispatchEvent(new PopStateEvent('popstate')); }, r); await p.waitForTimeout(500); };
const dlg = p.getByRole('dialog');
const eventos = () => p.evaluate(async () => (await window.compasDev.db.eventos.toArray()).filter((e) => !e.deletedAt));
const renta = (id) => p.evaluate(async (id) => (id ? await window.compasDev.db.rentas.get(id) : null), id);

await p.goto('http://localhost:4173/');
await p.waitForFunction(() => !!window.compasDev);
await p.evaluate(() => window.compasDev.demoCompleta());
await p.reload();
await p.getByText('Dirección Calo', { exact: true }).click();
await p.keyboard.type('1234', { delay: 30 });
await p.waitForTimeout(1200);

// 1) la demo: Navidad es en otro lugar (sin apartar el salón); Día de Muertos aquí, con disfraz
let ev = await eventos();
const navidad = ev.find((e) => e.nombre === 'Baile de Navidad');
const muertos = ev.find((e) => e.nombre === 'Fiesta de Día de Muertos');
console.log('1) en otro lugar no aparta el salón; aquí sí:', ok(navidad.lugar === 'Salón Los Arcos' && !navidad.rentaId && !!muertos.rentaId && muertos.vestimenta === 'Ven disfrazado 💀'));

// 2) crear uno en otro lugar: sin avisos de choque con clases, con descripción de varias líneas
await ir('/agenda/eventos');
await p.getByRole('button', { name: /Nuevo/ }).first().click();
await dlg.getByPlaceholder('Ej. Baile de Navidad').fill('Social en la terraza');
await dlg.locator('input[type=date]').fill('2026-11-25');
await dlg.locator('input[type=time]').fill('19:00'); // a la hora de las clases: aquí chocaría
await dlg.getByPlaceholder('$').fill('120');
await dlg.getByLabel('¿Dónde es?').selectOption({ label: 'En otro lugar (salón de fiestas, terraza…)' });
await dlg.getByPlaceholder('Ej. Salón Los Arcos').fill('Terraza El Mirador');
await dlg.getByPlaceholder('Calle, número y colonia').fill('Calle Ejemplo 12, Col. Lomas');
await dlg.getByPlaceholder(/Ven disfrazado/).fill('De blanco');
await dlg.locator('textarea').fill('Social al aire libre.\nDJ y clase muestra de bachata.');
const sinChoque = (await dlg.getByText(/El salón ya está ocupado/).count()) === 0;
await p.screenshot({ path: `${OUT}eventolugar-form.png`, fullPage: true });
await dlg.getByRole('button', { name: 'Crear evento' }).click();
await p.waitForTimeout(800);
ev = await eventos();
const terraza = ev.find((e) => e.nombre === 'Social en la terraza');
console.log('2) otro lugar a la hora de clases: sin choque, guarda lugar, dirección, cómo venir y varias líneas:', ok(sinChoque && terraza?.lugar === 'Terraza El Mirador' && terraza.direccion === 'Calle Ejemplo 12, Col. Lomas' && terraza.vestimenta === 'De blanco' && terraza.descripcion.includes('\n') && !terraza.rentaId), JSON.stringify(terraza && { lugar: terraza.lugar, renta: terraza.rentaId }));

// 3) el de Día de Muertos se cambia a otro lugar: el salón de aquí queda libre
await ir(`/agenda/eventos/${muertos.id}`);
await p.getByRole('button', { name: /Editar/ }).first().click();
await dlg.getByLabel('¿Dónde es?').selectOption({ label: 'En otro lugar (salón de fiestas, terraza…)' });
await dlg.getByPlaceholder('Ej. Salón Los Arcos').fill('Jardín Las Flores');
await dlg.getByRole('button', { name: 'Guardar cambios' }).click();
await p.waitForTimeout(800);
const r3 = await renta(muertos.rentaId);
const det = (await p.locator('main').innerText()).replace(/\s+/g, ' ');
console.log('3) al cambiarlo a otro lugar se libera el salón y la pantalla dice dónde y cómo venir:', ok(r3?.activo === false && /Jardín Las Flores/.test(det) && /Ven disfrazado/.test(det)));
await p.screenshot({ path: `${OUT}eventolugar-detalle.png` });

// 4) página pública: cómo venir resaltado, descripción con "Ver más" y "Cómo llegar" al mapa
const largo = 'Social de salsa y bachata con concurso de disfraces: premios al mejor disfraz y a la mejor pareja.\nAltar de muertos.\nPan de muerto y chocolate para todos.\nFoto del recuerdo.';
const D = {
  academia: { nombre: 'Calo Latino Studio', color: '#d6334a', logo: null, whatsapp: '5648141057', sede_principal: 'Estudio' },
  pagina: { frase: 'Ven a bailar', preguntas: [] },
  sedes: [],
  clases: [],
  planes: [],
  eventos: [{ nombre: 'Fiesta de Día de Muertos', fecha: '2026-11-30', hora: '20:00', precio: 18000, descripcion: largo, quedan: 30, vestimenta: 'Ven disfrazado 💀', lugar: 'Jardín Las Flores', direccion: 'Av. Ejemplo 450, Col. Centro', otro_lugar: true }],
  tienda: [],
};
await ctx.route('**/rest/v1/rpc/pagina_publica', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(D) }));
const pub = await ctx.newPage();
await pub.goto('http://localhost:4173/a/calo-latino');
await pub.getByText('Próximos eventos').waitFor({ timeout: 8000 });
await pub.getByText('Próximos eventos').scrollIntoViewIfNeeded();
const mapa = await pub.getByRole('link', { name: 'Cómo llegar' }).getAttribute('href');
const verMas = pub.getByRole('button', { name: 'Ver más' });
const hayVerMas = (await verMas.count()) === 1;
await pub.screenshot({ path: `${OUT}eventolugar-pagina.png` });
await verMas.click();
console.log('4) página: "Ven disfrazado" resaltado, lugar con "Cómo llegar" al mapa y "Ver más" en lo largo:', ok((await pub.getByText('Ven disfrazado 💀').count()) === 1 && /google\.com\/maps\/search\/.*Av\.%20Ejemplo%20450/.test(mapa ?? '') && hayVerMas && (await pub.getByRole('button', { name: 'Ver menos' }).count()) === 1), mapa);
const r = await revisarPagina(pub);
console.log('5) sin desbordes, botones con nombre y buen contraste:', ok(!r.ancho && !r.sinNombre.length && !r.contraste?.length), JSON.stringify({ ancho: r.ancho, sinNombre: r.sinNombre, contraste: r.contraste }));
// 6) portal del alumno: si es en su academia, solo el nombre del lugar (ya sabe llegar); si es fuera, dirección y "Cómo llegar"
const base = { hoy: '2026-11-18', alumno: { nombre: 'Ana López', codigo: 'K7P2QX', foto: null }, academia: { nombre: 'Calo Latino Studio', color: '#d6334a', logo: null, whatsapp: '5648141057' }, planes: [], clases: [], tienda: [], pedidos: [] };
const evPortal = (otro) => ({ nombre: otro ? 'Social fuera' : 'Fiesta aquí', fecha: '2026-11-30', hora: '20:00', precio: 18000, descripcion: '', quedan: null, vestimenta: '', lugar: otro ? 'Jardín Las Flores' : 'Estudio Calo', direccion: otro ? 'Av. Ejemplo 450' : 'C. Abasolo 2, Centro', otro_lugar: otro });
let eventosPortal = [evPortal(false)];
await ctx.route('**/rest/v1/rpc/portal_alumno', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ...base, eventos: eventosPortal }) }));
const por = await ctx.newPage();
await por.goto('http://localhost:4173/p/AbCdEfGhJkLmNpQrStUvWxYz23');
await por.getByText('Fiesta aquí').waitFor({ timeout: 8000 });
const aquiCorto = (await por.getByText('Estudio Calo').count()) === 1 && (await por.getByText('C. Abasolo 2, Centro').count()) === 0 && (await por.getByRole('link', { name: 'Cómo llegar' }).count()) === 0;
eventosPortal = [evPortal(true)];
await por.evaluate(() => localStorage.clear());
await por.reload();
await por.getByText('Social fuera').waitFor({ timeout: 8000 });
const fueraCompleto = (await por.getByText('Av. Ejemplo 450').count()) === 1 && (await por.getByRole('link', { name: 'Cómo llegar' }).count()) === 1;
console.log('6) portal: en la academia solo el nombre; fuera, dirección y "Cómo llegar":', ok(aquiCorto && fueraCompleto));
console.log('errores:', errores.length ? errores : 'ninguno');
await b.close();
