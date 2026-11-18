import { chromium } from 'playwright-core';
const OUT = new URL('./salida/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const pc = process.argv[2] === 'pc';
const browser = await chromium.launch({ channel: 'msedge' });
const page = await (await browser.newContext({ viewport: pc ? { width: 1366, height: 900 } : { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: !pc, hasTouch: true, locale: 'es-MX' })).newPage();
await page.clock.install({ time: new Date('2026-11-14T12:00:00') }); // sábado: hay clases en Casa de Cultura
const errores = []; page.on('pageerror', (e) => errores.push(e.message));
const ok = (c) => (c ? 'OK' : 'MAL');
const P = pc ? 'pc' : 'm';
const body = async () => (await page.locator('body').innerText()).replace(/\s+/g, ' ');
const dlg = page.getByRole('dialog');
const ir = (r) => page.evaluate((x) => { history.pushState(null, '', x); dispatchEvent(new PopStateEvent('popstate')); }, r);
const presionar = async (loc) => {
  const box = await loc.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(700);
  await page.mouse.up();
};
const entrar = async (nombre, pin) => {
  await page.getByText(nombre, { exact: true }).click();
  for (const d of pin) await page.getByRole('button', { name: d, exact: true }).click();
  await page.getByPlaceholder(/Quién llegó|Buscar…/).waitFor();
};
// lectura/escritura directa a IndexedDB (preparar casos)
const idb = (fn, arg) => page.evaluate(([f, a]) => new Promise((res, rej) => { const q = indexedDB.open('compas'); q.onsuccess = () => { try { (new Function('db', 'a', 'res', f))(q.result, a, res); } catch (e) { rej(e); } }; }), [fn, arg]);
const local = (d = new Date('2026-11-14T12:00:00')) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const todos = (store) => idb(`db.transaction('${store}').objectStore('${store}').getAll().onsuccess = (e) => res(e.target.result);`);

await page.goto('http://localhost:4173/');
await page.waitForFunction(() => !!window.compasDev);
console.log('demo:', JSON.stringify(await page.evaluate(async () => { await window.compasDev.sembrar(); await window.compasDev.agregarClasesDemo(); await window.compasDev.agregarSedeDemo(); return window.compasDev.agregarFiadosDemo(); })));
await page.reload();
await entrar('Monse', '1111');

// 1) filtro "Deben" en Alumnos
await page.getByRole('link', { name: 'Alumnos' }).first().click();
await page.getByRole('button', { name: /^Deben \(4\)/ }).click();
await page.waitForTimeout(300);
const filasDeben = await page.locator('main .divide-y button').count();
console.log('1) filtro Deben con 4 alumnos:', ok(filasDeben === 4), filasDeben);

// 2) la libreta del grupo donde quedó a deber
const asis = await todos('asistencias');
const alumnos = await todos('alumnos');
const clases = await todos('clases');
// recepción ve las clases de su sede: se elige un fiado del Estudio
const fiada = asis.find((x) => x.debe && !x.pagoId && !clases.find((k) => k.id === x.claseId)?.sedeId);
const a1 = alumnos.find((a) => a.id === fiada.alumnoId);
const deudor = a1.nombre;
await page.getByRole('link', { name: 'Listas' }).click();
await page.getByText('Listas del mes').waitFor();
const disciplinas = await todos('disciplinas');
const c = clases.find((x) => x.id === fiada.claseId);
const nom = `${disciplinas.find((d) => d.id === c.disciplinaId).nombre} ${c.nivel}`;
await page.getByRole('button', { name: new RegExp(`^${nom} ${c.horaInicio}`) }).first().click();
if (!fiada.fecha.startsWith(local().slice(0, 7))) await page.getByRole('button', { name: 'Mes anterior' }).click();
await page.waitForTimeout(400);
let t = await body();
const filaTxt = (await page.locator('tr').filter({ hasText: deudor }).innerText()).replace(/\s+/g, ' ');
console.log('2) libreta: marca "debe" y recordatorio:', ok(/Debe \$\d+/.test(filaTxt) && (await page.getByRole('link', { name: `Recordarle a ${deudor} lo que debe` }).count()) === (a1.telefono ? 1 : 0)), 'tel:' + !!a1.telefono, filaTxt);
await page.screenshot({ path: `${OUT}libreta-${P}-1.png`, fullPage: true });

// 3) cobrar lo que debe desde su ficha
await page.getByRole('link', { name: deudor }).first().click();
await page.getByText(/Debe 1 clase/).waitFor();
await page.screenshot({ path: `${OUT}libreta-${P}-2-ficha.png` });
await page.getByRole('button', { name: /Cobrar lo que debe/ }).click();
await page.getByText(/Adeudo cobrado/).waitFor();
await page.waitForTimeout(300);
console.log('3) adeudo cobrado y desaparece:', ok(!(await page.getByText(/Debe 1 clase/).count())));
await page.getByRole('link', { name: 'Caja' }).first().click();
await page.waitForTimeout(400);
t = await body();
console.log('   en caja como clase fiada:', ok(/\(fiada \d+\/\d+\)/.test(t)));

// 4) entra y paga después, en Casa de Cultura (hoy hay clases ahí)
await page.getByRole('link', { name: 'Entrada' }).first().click();
await page.getByRole('button', { name: 'Cambiar sede' }).click();
await dlg.getByRole('button', { name: /Casa de Cultura/ }).click();
await page.waitForTimeout(500);
const planes = await todos('planes');
const membresias = await todos('membresias');
const conPlan = new Set(membresias.filter((m) => m.fin >= local() && !m.anuladaAt).map((m) => m.alumnoId));
const sinPlan = alumnos.filter((a) => a.activo && !a.deletedAt && !conPlan.has(a.id) && a.id !== a1.id).slice(0, 3);
const buscar = page.getByPlaceholder(/Quién llegó|Buscar…/);
await buscar.fill(sinPlan[0].nombre);
await page.waitForTimeout(300);
await page.getByRole('button', { name: `Más opciones para ${sinPlan[0].nombre}` }).click();
await dlg.getByRole('button', { name: /Entra y paga después/ }).waitFor({ timeout: 5000 });
await dlg.getByRole('button', { name: /Entra y paga después/ }).click();
await page.getByText(/queda debiendo \$40/).waitFor();
console.log('4) fiado en Casa de Cultura ($40):', 'OK');

// 5) mensual 2 clases: hay que elegir 2 clases
await buscar.fill(sinPlan[1].nombre);
await page.waitForTimeout(300);
await page.getByRole('button', { name: `Más opciones para ${sinPlan[1].nombre}` }).click();
await dlg.getByRole('button', { name: /Vender mensualidad o paquete/ }).click();
await dlg.getByRole('button', { name: /Mensual 2 clases/ }).click();
const pide = await dlg.getByRole('button', { name: 'Elige 2 clases' }).isDisabled();
const opciones = dlg.getByRole('group', { name: 'Clases que cubre' }).getByRole('button');
const yaElegida = await opciones.filter({ has: page.locator('[aria-pressed="true"]') }).count();
// la clase de hoy ya viene marcada: se elige una más
const n = await opciones.count();
for (let i = 0; i < n; i++) if ((await opciones.nth(i).getAttribute('aria-pressed')) === 'false') { await opciones.nth(i).click(); break; }
await page.screenshot({ path: `${OUT}libreta-${P}-3-mensual2.png` });
await dlg.getByRole('button', { name: /Cobrar \$450 y dar entrada/ }).click();
await page.getByText(/Mensual 2 clases cobrada/).waitFor();
const mem = (await todos('membresias')).find((m) => m.alumnoId === sinPlan[1].id);
console.log('5) mensual 2 clases pide elegir y guarda las 2:', ok(pide && mem?.claseIds?.length === 2), yaElegida);

// 6) recargo por atraso: su mensual de 1 clase venció hace 5 días
const p1 = planes.find((p) => p.nombre === 'Mensual 1 clase');
const hoyF = new Date('2026-11-14T12:00:00'); const f = (d) => { const x = new Date(hoyF); x.setDate(x.getDate() + d); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; };
await idb(`const t = db.transaction('membresias','readwrite'); t.objectStore('membresias').put(a); t.oncomplete = () => res(true);`, { id: crypto.randomUUID(), academiaId: p1.academiaId, alumnoId: sinPlan[2].id, planId: p1.id, pagoId: crypto.randomUUID(), disciplinaId: null, sedeId: p1.sedeId, inicio: f(-35), fin: f(-5), clasesTotal: null, anuladaAt: null, claseIds: [c.id], createdAt: Date.now(), updatedAt: Date.now(), deletedAt: null });
await page.reload();
await page.getByText('Monse', { exact: true }).click().catch(() => {});
for (const d of '1111') await page.getByRole('button', { name: d, exact: true }).click().catch(() => {});
await ir(`/alumnos/${sinPlan[2].id}`);
await page.getByRole('button', { name: /Vender plan/ }).click();
await dlg.getByRole('button', { name: /Mensual 1 clase/ }).click();
await page.waitForTimeout(300);
t = await body();
console.log('6) atraso: 5 días, recargo $50, conserva corte:', ok(/5 días de atraso/.test(t) && /Recargo \$10 por día: \$50/.test(t) && t.includes(`Vigencia: ${new Date(f(-4) + 'T12:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}`)), (t.match(/Vigencia: [^A-Z]{0,30}/) || [])[0]);
await page.screenshot({ path: `${OUT}libreta-${P}-4-recargo.png` });
// quitar el recargo baja el total
await dlg.getByRole('switch', { name: /Recargo/ }).click();
const sinRecargo = await dlg.getByRole('button', { name: /^Elige la clase|^Cobrar \$300/ }).count();
console.log('   quitar el recargo:', ok(sinRecargo === 1));
await page.keyboard.press('Escape');

// 7) precio propio de una clase (dirección)
await page.getByRole('button', { name: /cambiar usuario/i }).first().click();
await entrar('Dirección Calo', '1234');
await ir('/ajustes/clases');
await page.getByText(/Cumbia 0/).first().click();
await dlg.getByPlaceholder('60').fill('80');
await dlg.getByRole('button', { name: 'Guardar', exact: true }).click();
await page.waitForTimeout(300);
const cumbia = (await todos('clases')).find((x) => x.nivel === '0' && disciplinas.find((d) => d.id === x.disciplinaId)?.nombre === 'Cumbia');
console.log('7) clase con su propio precio:', ok(cumbia?.precioSuelta === 8000));
// 8) recargo configurable en Ajustes → Planes
await ir('/ajustes/planes');
const recargoTxt = await page.getByPlaceholder('Ej. 10').inputValue();
console.log('8) recargo configurado en planes:', ok(recargoTxt === '10'), recargoTxt);
await page.screenshot({ path: `${OUT}libreta-${P}-5-planes.png`, fullPage: true });
console.log('errores:', errores.length ? errores : 'ninguno');
await browser.close();
