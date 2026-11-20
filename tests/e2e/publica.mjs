import { chromium } from 'playwright-core';
const OUT = new URL('./salida/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const browser = await chromium.launch({ channel: 'msedge' });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'es-MX' });
const page = await ctx.newPage();
await page.clock.install({ time: new Date('2026-11-13T19:30:00') });
const errores = []; page.on('pageerror', (e) => errores.push(e.message));
const ok = (c) => (c ? 'OK' : 'MAL');
const txt = async () => (await page.locator('main').innerText()).replace(/\s+/g, ' ');
const body = async () => (await page.locator('body').innerText()).replace(/\s+/g, ' ');
const dlg = page.getByRole('dialog');
const ir = (r) => page.evaluate((x) => { history.pushState(null, '', x); dispatchEvent(new PopStateEvent('popstate')); }, r);
const entrar = async (nombre, pin) => {
  await page.getByText(nombre, { exact: true }).click();
  for (const d of pin) await page.getByRole('button', { name: d, exact: true }).click();
  await page.getByPlaceholder(/Quién llegó|Buscar…/).waitFor();
};

await page.goto('http://localhost:4173/');
await page.waitForFunction(() => !!window.compasDev);
console.log('demo:', JSON.stringify(await page.evaluate(async () => { await window.compasDev.sembrar(); await window.compasDev.agregarClasesDemo(); return window.compasDev.agregarInteresadosDemo(); })));
await page.reload();
await entrar('Dirección Calo', '1234');

// 1) ajustes: página publicada con su enlace
await ir('/ajustes/pagina');
await page.getByText('Tu página:').waitFor();
await page.getByRole('button', { name: /^Enlace y WhatsApp/ }).click(); // sección plegada
const slug =await page.getByLabel('Dirección de la página').inputValue();
const abrir = await page.getByRole('link', { name: /Abrir/ }).getAttribute('href');
console.log('1) página pública configurada:', ok(slug === 'calo-latino' && abrir.endsWith('/a/calo-latino')), abrir);

// 2) Alumnos avisa de interesados nuevos
await page.getByRole('link', { name: 'Alumnos', exact: true }).first().click();
await page.getByText(/9 interesados nuevos por contactar/).click();
await page.getByText(/Ya se les escribió \(2\)/).waitFor();
let t = await txt();
console.log('2) interesados juntos por clase:', ok(/Salsa 0 · .{0,20}· 3/i.test(t) && /Bachata 0 · .{0,20}· 3/i.test(t) && /Cualquier clase · 2/i.test(t)), (t.match(/SALSA 0[^·]*·[^·]*· \d/) || [])[0]);
await page.screenshot({ path: `${OUT}publica-1-interesados.png`, fullPage: true });

// 3) avisar a todos los de Salsa 0 que abrió grupo
await page.getByRole('button', { name: /Avisar a todos/ }).first().click();
const enlaces = dlg.getByRole('link');
const n = await enlaces.count();
const href = decodeURIComponent(await enlaces.first().getAttribute('href'));
await enlaces.first().click();
await page.waitForTimeout(300);
const contador = await dlg.getByText(/1 de \d+ avisados/).count();
console.log('3) avisar a todos: mensaje con clase y horario, se marca:', ok(n >= 3 && /Abrimos grupo de Salsa 0 en Calo Latino Studio: .+ a las \d\d:\d\d\. ¿Te apartamos lugar\?/.test(href) && contador === 1), n);
// cerrar las pestañas que abrió WhatsApp
for (const p of ctx.pages()) if (p !== page) await p.close();
await page.keyboard.press('Escape');
await page.waitForTimeout(300);
console.log('   pasa a "ya se les escribió":', ok((await page.getByText(/Ya se les escribió \(3\)/).count()) === 1));

// 4) registrar a uno como alumno
const reg = page.getByRole('button', { name: /^Registrar a .* como alumno$/ }).first();
const nombre = (await reg.getAttribute('aria-label')).replace(/^Registrar a /, '').replace(/ como alumno$/, '');
await reg.click();
await page.getByRole('button', { name: /Vender plan/ }).waitFor();
t = await body();
console.log('5) registrar como alumno abre su ficha:', ok(t.includes(nombre) && /Se inscribió en la página/.test(t)), nombre);

// 5) anotar a mano
await ir('/alumnos/interesados');
await page.getByRole('button', { name: /Anotar/ }).click();
await dlg.getByRole('textbox').first().fill('Rosa Prueba');
await dlg.getByPlaceholder('10 dígitos').fill('55 1111 2222');
await dlg.getByRole('button', { name: 'Anotar', exact: true }).click();
await page.getByText('Anotado en interesados').waitFor();
await page.locator('main').getByText('Rosa Prueba').first().waitFor({ timeout: 5000 }).catch(() => {});
console.log('6) anotar a mano:', ok(/Rosa Prueba/.test(await txt())));

// 6) mensajes editables
await ir('/ajustes/mensajes');
await page.waitForTimeout(300);
t = await txt();
console.log('7) plantillas de interesados editables:', ok(/Interesado: primer mensaje/.test(t) && /Abrimos grupo/.test(t)));

// ---------- página pública (base simulada) ----------
const D = {
  academia: { nombre: 'Calo Latino Studio', color: '#d6304a', logo: null, whatsapp: '5512345678', sede_principal: 'Estudio Calo Latino' },
  sedes: [{ id: 's1', nombre: 'Casa de Cultura', color: '#7c4ddb' }],
  clases: [
    { id: 'c1', clase: 'Salsa 0', color: '#e8445a', dias: [1, 3, 5], hora: '19:00', duracion: 60, sede_id: null, precio: null },
    { id: 'c2', clase: 'Contemporáneo', color: '#0d9488', dias: [2, 5], hora: '11:00', duracion: 120, sede_id: null, precio: 8000 },
    { id: 'c3', clase: 'Salsa Lady Style', color: '#e8445a', dias: [6], hora: '11:00', duracion: 90, sede_id: 's1', precio: null },
  ],
  planes: [
    { nombre: 'Clase suelta', tipo: 'suelta', precio: 6000, clases: 1, vigencia: null, grupos: null, sede_id: '00000000-0000-4000-8000-000000000000' },
    { nombre: 'Bloque completo', tipo: 'paquete', precio: 40000, clases: 8, vigencia: 30, grupos: null, sede_id: '00000000-0000-4000-8000-000000000000' },
    { nombre: 'Clase suelta Casa de Cultura', tipo: 'suelta', precio: 4000, clases: 1, vigencia: null, grupos: null, sede_id: 's1' },
    { nombre: 'Mensual 2 clases', tipo: 'mensual', precio: 45000, clases: null, vigencia: null, grupos: 2, sede_id: 's1' },
  ],
  eventos: [{ nombre: 'Baile de Navidad', fecha: '2026-12-13', hora: '19:00', precio: 18000, descripcion: 'Social con DJ', quedan: 37 }],
  tienda: [{ nombre: 'Playera Calo', precio: 25000, emoji: '👕', foto: null, descripcion: '', opciones: ['CH', 'M'], sobre_pedido: false }],
};
let respuesta = { ok: true };
let inscripcion = null;
await ctx.route('**/rest/v1/rpc/pagina_publica', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(D) }));
await ctx.route('**/rest/v1/rpc/inscribir_interesado', (r) => { inscripcion = JSON.parse(r.request().postData() || '{}'); return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(respuesta) }); });
await page.goto('http://localhost:4173/a/calo-latino');
await page.getByText('Horarios').first().waitFor();
await page.getByRole('button', { name: 'Toda la semana' }).click();
t = await body();
for (const [k, re] of Object.entries({ lunes: /Lunes Salsa 0 19:00–20:00/i, contemp: /Contemporáneo 11:00–13:00 \$80/, suelta: /Clase suelta .{0,40}\$60/, bloque: /Bloque completo 8 clases · vigencia 30 días \$400/, navidad: /Baile de Navidad/, playera: /Playera Calo/ })) if (!re.test(t)) console.log('   falta', k, (t.match(new RegExp(k === 'lunes' ? 'LUNES.{0,80}' : k === 'contemp' ? 'Contempor.{0,60}' : k === 'bloque' ? 'Bloque.{0,80}' : 'zzz', 'i')) || [''])[0]);
console.log('   wa', await page.getByRole('link', { name: /Escríbenos por WhatsApp/ }).count());
console.log('8) página: horario del estudio, precios, evento (sin anunciar cupo de sobra), tienda, WhatsApp:', ok(/Lunes Salsa 0 19:00–20:00/i.test(t) && /Contemporáneo 11:00–13:00 \$80/.test(t) && /Clase suelta .{0,40}\$60/.test(t) && /Bloque completo 8 clases · vigencia 30 días \$400/.test(t) && /Baile de Navidad/.test(t) && !/Quedan 37 lugares/.test(t) && /Playera Calo/.test(t) && (await page.getByRole('link', { name: /Escríbenos por WhatsApp/ }).count()) >= 1));
console.log('   sin maestros ni teléfonos:', ok(!/Profe|Profa|55\d{8}/.test(t.replace('5512345678', ''))));
await page.screenshot({ path: `${OUT}publica-2-pagina.png`, fullPage: true });
await page.getByRole('tab', { name: /Casa de Cultura/ }).click();
t = await body();
console.log('9) por sede: Casa de Cultura con sus clases y precios:', ok(/Sábado Salsa Lady Style/i.test(t) && /Clase suelta .{0,40}\$40/.test(t) && /Mensual 2 clases 2 grupos a elegir, todas sus clases del mes \$450/.test(t) && !/Contemporáneo/.test((await page.locator('#horarios ul').allInnerTexts()).join(' '))));

// inscripción
const boton = page.getByRole('button', { name: 'Quiero inscribirme' });
await page.getByLabel('Nombre').fill('Laura Nueva');
await page.getByLabel('WhatsApp (10 dígitos)').fill('55 1234 567');
let llamadas = 0; page.on('request', (r) => { if (r.url().includes('inscribir_interesado')) llamadas++; });
await boton.click();
const bloqueado = (await page.getByText('Falta 1 dígito').isVisible()) && llamadas === 0 && (await page.getByLabel('WhatsApp (10 dígitos)').getAttribute('aria-invalid')) === 'true';
await page.getByLabel('WhatsApp (10 dígitos)').fill('55 1234 5678');
await page.getByLabel('¿Qué clase te interesa?').selectOption('c3');
respuesta = { error: 'muchos' };
await boton.click();
await page.getByText(/Ya recibimos tu registro/).waitFor();
respuesta = { ok: true };
await boton.click();
await page.getByText(/¡Listo, Laura!/).waitFor();
console.log('10) inscripción: valida teléfono, avisa errores y confirma:', ok(bloqueado && inscripcion.p_slug === 'calo-latino' && inscripcion.p_telefono === '5512345678' && inscripcion.p_clase === 'c3'));
await page.screenshot({ path: `${OUT}publica-3-listo.png` });

// enlace corto no es página pública
await page.goto('http://localhost:4173/a/xy');
await page.waitForTimeout(800);
console.log('11) /a/xy no es página pública:', ok(!(await page.getByText('Quiero inscribirme').count())));
console.log('errores:', errores.length ? errores : 'ninguno');
await browser.close();
