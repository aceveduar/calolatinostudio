import { chromium } from 'playwright-core';
const OUT = new URL('./salida/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const browser = await chromium.launch({ channel: 'msedge' });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'es-MX' });
const page = await ctx.newPage();
await page.clock.install({ time: new Date('2026-11-13T19:30:00') });
const errores = []; page.on('pageerror', (e) => errores.push(e.message));
const ok = (c) => (c ? 'OK' : 'MAL');
const txt = async () => (await page.locator('main').innerText()).replace(/\s+/g, ' ');
const dlg = page.getByRole('dialog');
const ir = (r) => page.evaluate((x) => { history.pushState(null, '', x); dispatchEvent(new PopStateEvent('popstate')); }, r);
const entrar = async (nombre, pin) => {
  await page.getByText(nombre, { exact: true }).click();
  for (const d of pin) await page.getByRole('button', { name: d, exact: true }).click();
  await page.getByPlaceholder(/Quién llegó|Buscar…/).waitFor();
};

await page.goto('http://localhost:4173/');
await page.waitForFunction(() => !!window.compasDev);
console.log('demo:', JSON.stringify(await page.evaluate(async () => { await window.compasDev.sembrar(); await window.compasDev.agregarClasesDemo(); await window.compasDev.agregarTiendaDemo(); return window.compasDev.agregarPedidosDemo(); })));
await page.evaluate(async () => {
  const { db, actualizar } = window.compasDev;
  for (const encargo of await db.pedidos.toArray()) {
    await actualizar('alumnos', encargo.alumnoId, { telefono: '5512345678' });
  }
});
await page.reload();
await entrar('Monse', '1111');

// 1) en Entrada → Tienda: el encargo que ya llegó aparece por recoger, con el resto a cobrar
await page.getByRole('button', { name: /^Tienda/ }).click();
await dlg.getByText(/Apartados por recoger · 3/i).waitFor();
let t = (await dlg.innerText()).replace(/\s+/g, ' ');
console.log('1) por recoger: 2 apartados + zapatillas que llegaron ($600 de resto):', ok(/Zapatillas de baile \(26\)/.test(t) && /\$600 \(dejó \$600\)/.test(t)));
await dlg.getByRole('link', { name: /Encargos/ }).click();
await page.getByText('Por pedir al proveedor', { exact: false }).first().waitFor();
await page.waitForTimeout(300);

// 2) lista para el proveedor: agrupa por talla y detalle
t = await txt();
console.log('2) lista agrupada (2 × talla 24 negras, 1 × 25):', ok(/Por pedir al proveedor · 3/i.test(t) && /2 Zapatillas de baile · talla 24 Negras, tacón 5 cm/.test(t) && /1 Zapatillas de baile · talla 25 Nude, tacón 7 cm/.test(t)));
const href = decodeURIComponent(await page.getByRole('link', { name: 'WhatsApp', exact: true }).getAttribute('href'));
const orden = t.toLowerCase();
console.log('   los pedidos listos aparecen antes de la lista del proveedor:', ok(
  orden.includes('listos para entregar') && orden.indexOf('listos para entregar') < orden.indexOf('por pedir al proveedor'),
));
console.log('   texto para el proveedor:', ok(/• 2 × Zapatillas de baile talla 24 — Negras, tacón 5 cm/.test(href) && /Total: 3 piezas/.test(href)));
await page.screenshot({ path: `${OUT}encargos-1.png`, fullPage: true });

// 3) ya se pidieron → en camino
await page.getByRole('button', { name: /Ya se los pedí/ }).click();
await page.waitForTimeout(400);
t = await txt();
console.log('3) pasan a en camino (3 + 1):', ok(/Por pedir al proveedor · 0/i.test(t) && /En camino · 4/i.test(t)));

// 4) llegó uno → listo para entregar y aviso por WhatsApp
const registrarLlegada = page.getByRole('button', { name: 'Registrar llegada' }).first();
await registrarLlegada.locator('..').getByRole('button').first().click();
await dlg.getByRole('button', { name: 'Registrar llegada' }).click();
const avisoRecogida = dlg.getByRole('link', { name: 'Avisar por WhatsApp' });
await avisoRecogida.waitFor();
console.log('   el detalle de llegada muestra el WhatsApp del alumno:', ok((await avisoRecogida.getAttribute('href')).includes('5512345678')));
await page.keyboard.press('Escape');
await page.waitForTimeout(300);
t = await txt();
console.log('4) llegó: pasa a listos:', ok(/En camino · 3/i.test(t) && /Listos para entregar · 4/i.test(t)));
const buscarPedidos = page.getByRole('textbox', { name: 'Buscar pedidos por alumno, producto o talla' });
const quienRecoge = await page.evaluate(async () => {
  const { db } = window.compasDev;
  const pedido = (await db.pedidos.where('estado').equals('llego').toArray()).find((p) => p.opcion === '26');
  return (await db.alumnos.get(pedido.alumnoId)).nombre;
});
await buscarPedidos.fill(quienRecoge);
await page.getByText('Listo para entregar', { exact: true }).first().waitFor();
console.log('4b) búsqueda por alumno muestra el saldo del encargo listo:', ok(await page.getByText('Por cobrar $600', { exact: true }).isVisible()
  && !(await page.getByRole('button', { name: /Ya se los pedí/ }).count())));
await page.getByRole('button', { name: 'Ver todos los pedidos' }).click();

// 5) nuevo encargo en recepción con anticipo
await page.getByRole('button', { name: /Nuevo/ }).click();
const alumno = await page.evaluate(() => new Promise((res) => { const q = indexedDB.open('compas'); q.onsuccess = () => { q.result.transaction('alumnos').objectStore('alumnos').getAll().onsuccess = (e) => res(e.target.result.filter((a) => a.activo && !a.deletedAt)[20]); }; }));
await dlg.getByPlaceholder(/Nombre o teléfono/).fill(alumno.nombre.split(' ').slice(0, 2).join(' '));
await dlg.getByRole('button', { name: alumno.nombre }).first().click();
await dlg.locator('select').selectOption({ label: /Zapatillas/ }).catch(async () => {
  const v = await dlg.locator('select option').filter({ hasText: 'Zapatillas' }).getAttribute('value');
  await dlg.locator('select').selectOption(v);
});
await dlg.getByRole('button', { name: '25', exact: true }).click();
await dlg.getByPlaceholder(/negras, tacón/).fill('Doradas');
const resumenNuevo = dlg.locator('dl');
console.log('   sin anticipo, registra el encargo con el total por cobrar:', ok(/Se cobra hoy\s+\$0/.test(await resumenNuevo.innerText())
  && /Queda por cobrar\s+\$1,200/.test(await resumenNuevo.innerText())
  && await dlg.getByRole('button', { name: 'Registrar encargo', exact: true }).isEnabled()));
await dlg.getByPlaceholder('$').fill('1300');
console.log('   impide registrar un anticipo superior al total:', ok(await dlg.getByText('El anticipo no puede superar el total del encargo.').isVisible()
  && await dlg.getByRole('button', { name: /Registrar encargo y cobrar/ }).isDisabled()));
await dlg.getByPlaceholder('$').fill('300');
console.log('   muestra cuánto cobra hoy y cuánto queda pendiente:', ok(/Se cobra hoy\s+\$300/.test(await resumenNuevo.innerText())
  && /Queda por cobrar\s+\$900/.test(await resumenNuevo.innerText())));
await page.screenshot({ path: `${OUT}encargos-2-nuevo.png` });
await dlg.getByRole('button', { name: /Registrar encargo/ }).click();
await page.getByText(/Encargo registrado .* \(anticipo \$300\)/).waitFor();
await page.waitForTimeout(300);
t = await txt();
console.log('5) encargo nuevo con anticipo queda por pedir:', ok(/Por pedir al proveedor · 1/i.test(t) && /talla 25 Doradas/.test(t)));

// 6) abrir el encargo listo desde Pendientes y cobrar solo el resto.
await ir('/pendientes');
const directo = page.getByRole('link', { name: /Zapatillas de baile \(26\).*Por cobrar \$600/ });
await directo.waitFor();
console.log('6a) Pendientes identifica al alumno y el saldo:', ok((await directo.innerText()).includes(quienRecoge)));
await directo.click();
await page.waitForURL(/\/encargos\?pedido=/);
const enlaceLlegada = dlg.getByRole('link', { name: 'Avisar por WhatsApp' });
const mensajeLlegada = new URL(await enlaceLlegada.getAttribute('href')).searchParams.get('text');
console.log('   el detalle del encargo listo conserva el aviso con el saldo:', ok(mensajeLlegada.includes('$600') && mensajeLlegada.includes('zapatillas')));
await dlg.getByText('Saldo por cobrar', { exact: true }).waitFor();
const montos = await dlg.locator('dl').innerText();
console.log('   el detalle distingue total, anticipo y saldo:', ok(/Total\s+\$1,200/.test(montos) && /Anticipo\s+\$600/.test(montos) && /Saldo por cobrar\s+\$600/.test(montos)));
await dlg.getByRole('button', { name: /Entregar y cobrar \$600/ }).click();
await page.getByText(/Entregado · \$600/).waitFor();
await page.getByRole('link', { name: 'Caja' }).first().click().catch(() => ir('/caja'));
await ir('/caja');
await page.waitForTimeout(500);
t = await txt();
console.log('6) caja: anticipo de hoy y resto de la entrega:', ok(/Anticipo · Zapatillas de baile \(25\)/.test(t) && /Zapatillas de baile \(26\) · resto/.test(t)));

// 7) en el producto: sobre pedido y sin existencias
await page.getByRole('button', { name: /cambiar usuario/i }).first().click();
await entrar('Dirección Calo', '1234');
await ir('/ajustes/productos');
await page.getByText('Zapatillas de baile').first().click();
const sw = await dlg.getByRole('switch', { name: /Sobre pedido/ }).getAttribute('aria-checked');
const dias = await dlg.getByPlaceholder('Ej. 15').inputValue();
const sinExist = (await dlg.getByRole('switch', { name: 'Llevar existencias' }).count()) === 0;
console.log('7) producto sobre pedido (15 días, sin existencias):', ok(sw === 'true' && dias === '15' && sinExist));
await page.keyboard.press('Escape');

// 8) portal: encargar con detalle
let pedido = null;
const TOKEN = 'AbCdEfGhJkLmNpQrStUvWxYz23';
const datos = { hoy: '2026-11-13', alumno: { nombre: 'Ana López', codigo: 'K7P2QX' }, academia: { nombre: 'Calo Latino Studio', color: '#d6334a', logo: null }, planes: [], clases: [],
  tienda: [{ id: '22222222-2222-4222-8222-222222222222', nombre: 'Zapatillas de baile', precio: 120000, emoji: '👟', foto: null, descripcion: 'Por número y diseño', opciones: ['23', '24', '25'], disponibles: null, sobre_pedido: true, dias_entrega: 15 }],
  pedidos: [
    { producto: 'Zapatillas de baile', emoji: '👟', opcion: '24', nota: 'Rojas', cantidad: 1, precio: 120000, anticipo: 0, estado: 'pedido', creado: Date.now() },
    { producto: 'Artículo retirado', emoji: '🛍️', opcion: null, cantidad: 1, precio: 10000, estado: 'pendiente', creado: Date.now() },
  ] };
await ctx.route('**/rest/v1/rpc/portal_alumno', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(datos) }));
await ctx.route('**/rest/v1/rpc/portal_pedir', (r) => {
  pedido = JSON.parse(r.request().postData() || '{}');
  datos.pedidos.unshift({ producto: 'Zapatillas de baile', emoji: '👟', opcion: pedido.p_opcion, nota: pedido.p_nota, cantidad: 1, precio: 120000, anticipo: 60000, estado: 'pendiente', creado: Date.now() });
  return r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
});
await page.goto(`http://localhost:4173/p/${TOKEN}`);
await page.getByText('Tienda de la academia').waitFor();
t = (await page.locator('body').innerText()).replace(/\s+/g, ' ');
const enCamino = /En camino/.test(t) && /El proveedor lo está preparando/.test(t);
await page.getByRole('button', { name: 'Encargar', exact: true }).click();
await dlg.getByRole('button', { name: '24', exact: true }).click();
await dlg.getByPlaceholder(/negras, tacón/).fill('Negras');
await page.screenshot({ path: `${OUT}encargos-3-portal.png` });
await dlg.getByRole('button', { name: /Encargar · pagas/ }).click();
await page.getByText(/¡Listo! Encargaste Zapatillas de baile \(24\)/).waitFor();
console.log('8) portal: encargar con detalle y ver "en camino":', ok(enCamino && pedido?.p_nota === 'Negras' && pedido?.p_opcion === '24'));
const nuevoEncargo = page.getByRole('listitem').filter({ hasText: 'Negras' });
await nuevoEncargo.getByText('Encargo recibido', { exact: true }).waitFor();
console.log('9) recién recibido: falta pedirlo y no indica recoger:', ok(await nuevoEncargo.getByText(/aún debe pedirlo/).isVisible() && await nuevoEncargo.getByText(/Recógelo/).count() === 0));
const retirado = page.getByRole('listitem').filter({ hasText: 'Artículo retirado' });
console.log('10) sin producto activo: pide confirmar en recepción:', ok(await retirado.getByText(/Confirma en recepción/).isVisible() && await retirado.getByText(/Recógelo/).count() === 0));
datos.pedidos[0].estado = 'llego';
await page.reload();
await nuevoEncargo.getByText('Llegó', { exact: true }).waitFor();
console.log('11) al llegar, indica dónde recoger y cuánto falta pagar:', ok(await nuevoEncargo.getByText('Recógelo en recepción · $600', { exact: true }).isVisible()));
console.log('errores:', errores.length ? errores : 'ninguno');
await browser.close();
