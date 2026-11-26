// Lo básico de armar una academia nueva, como lo haría el dueño la primera vez: PIN con el teclado de la PC,
// maestro con sus clases, clase con disciplina nueva, plan con resumen, usuario; y que cada formulario diga qué falta.
import { chromium } from 'playwright-core';
import { revisarPagina } from './revisar.mjs';
const OUT = new URL('./salida/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const ok = (c) => (c ? 'OK' : 'MAL');
const b = await chromium.launch({ channel: 'msedge' });
const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'es-MX' })).newPage();
const errores = [];
p.on('pageerror', (e) => errores.push(e.message));
const ir = async (r) => { await p.evaluate((x) => { history.pushState(null, '', x); dispatchEvent(new PopStateEvent('popstate')); }, r); await p.waitForTimeout(400); };
const dlg = p.getByRole('dialog');
const db = (t) => p.evaluate(async (t) => (await window.compasDev.db[t].toArray()).filter((x) => !x.deletedAt), t);

// 1) academia nueva: el PIN se escribe con el teclado de la computadora
await p.goto('http://localhost:4173/');
await p.getByRole('button', { name: /Crear una academia nueva/ }).click();
await p.getByPlaceholder(/Son de Barrio/).fill('Ritmo Norte');
await p.getByPlaceholder('Ej. Eduardo').fill('Calo');
await p.getByRole('button', { name: 'Continuar' }).click();
await p.waitForTimeout(400);
await p.keyboard.type('482915', { delay: 50 });
await p.waitForTimeout(700);
await p.keyboard.type('482915', { delay: 50 });
await p.getByRole('heading', { name: 'Entrada', exact: true }).waitFor();
const guia = p.getByRole('region', { name: 'Primeros pasos' });
console.log('1) el PIN abre Entrada y los horarios y precios iniciales bastan:', ok((await guia.count()) === 0));
const planesActivos = await p.evaluate(async () => {
  const { planes } = window.compasDev.db;
  const activos = await planes.filter((plan) => plan.activo && !plan.deletedAt && plan.precio > 0).primaryKeys();
  await planes.where(':id').anyOf(activos).modify({ activo: false });
  return activos;
});
await guia.getByText('1 de 2 pasos').waitFor();
console.log('1b) si faltan precios, la guía lleva a Planes y precios:', ok(await guia.getByRole('link', { name: /Planes y precios/ }).isVisible()));
await p.evaluate((ids) => window.compasDev.db.planes.where(':id').anyOf(ids).modify({ activo: true }), planesActivos);
await guia.waitFor({ state: 'hidden' });

// 2) maestro: se eligen sus clases ahí mismo
await ir('/ajustes/maestros');
console.log('2) sin maestros: mensaje en vez de caja vacía:', ok((await p.getByText(/Aún no hay maestros/).count()) === 1));
await p.getByRole('button', { name: /Nuevo maestro/ }).first().click();
await dlg.getByPlaceholder('Ej. Profe Luis').fill('Profe Luis');
await dlg.getByRole('button', { name: /Salsa 1/ }).click();
await dlg.getByRole('button', { name: /Salsa 2/ }).click();
await dlg.getByRole('button', { name: 'Guardar' }).click();
await p.getByText('Maestro guardado').waitFor();
const luis = (await db('maestros')).find((m) => m.nombre === 'Profe Luis');
const suyas = (await db('clases')).filter((c) => c.maestroId === luis.id).length;
console.log('   las 2 clases elegidas quedan con Profe Luis:', ok(suyas === 2), suyas);

// 3) clase: dice qué falta, crea disciplina nueva, dice cuándo termina y resume
await ir('/ajustes/clases');
await p.getByRole('button', { name: /Nueva clase/ }).first().click();
const falta = (await dlg.getByText('Elige al menos un día').count()) === 1 && (await dlg.getByRole('button', { name: 'Crear clase' }).isDisabled());
await dlg.getByLabel('Disciplina').selectOption({ label: '+ Nueva disciplina…' });
await dlg.getByPlaceholder('Ej. Cumbia').fill('Cumbia');
await dlg.getByPlaceholder('0, 1, 2…').fill('1');
await dlg.getByLabel('Maestro').selectOption({ label: 'Profe Luis' });
await dlg.getByRole('button', { name: 'Mar', exact: true }).click();
await dlg.getByRole('button', { name: 'Jue', exact: true }).click();
await dlg.locator('input[type=time]').fill('18:30');
await dlg.getByLabel(/Dura/).fill('90');
const t3 = (await dlg.innerText()).replace(/\s+/g, ' ');
await p.screenshot({ path: `${OUT}basico-clase.png` });
console.log('3) clase: dice qué falta y a qué hora termina:', ok(falta && /Termina a las 20:00/.test(t3)));
await dlg.getByRole('button', { name: 'Crear clase' }).click();
await p.getByText('Clase guardada').waitFor();
const cumbia = (await db('disciplinas')).find((d) => d.nombre === 'Cumbia');
const usados = (await db('disciplinas')).filter((d) => d.color === cumbia?.color).length;
const clase = (await db('clases')).find((c) => c.disciplinaId === cumbia?.id);
console.log('   disciplina nueva desde la clase, con un color que nadie usa:', ok(!!cumbia && usados === 1 && clase?.duracionMin === 90 && clase?.maestroId === luis.id));
console.log('   la lista avisa qué clases no tienen maestro:', ok((await p.getByText(/sin maestro/i).count()) > 0));

// 4) plan: nombre opcional (se sugiere), "grupos" y resumen de cómo se verá
await ir('/ajustes/planes');
await p.getByRole('button', { name: /Nuevo plan/ }).first().click();
const faltaPrecio = (await dlg.getByText('Escribe el precio').count()) === 1;
await dlg.getByRole('button', { name: '2 grupos' }).click();
await dlg.getByPlaceholder('$').fill('450');
const t4 = (await dlg.innerText()).replace(/\s+/g, ' ');
await p.screenshot({ path: `${OUT}basico-plan.png` });
console.log('4) plan: pide precio, sugiere nombre y resume:', ok(faltaPrecio && /Mensual 2 grupos 2 grupos por un mes \$450/.test(t4)));
await dlg.getByRole('button', { name: 'Guardar' }).click();
await p.getByText('Plan guardado').waitFor();
console.log('   se guarda con el nombre sugerido:', ok((await db('planes')).some((x) => x.nombre === 'Mensual 2 grupos' && x.grupos === 2 && x.precio === 45000)));
const posRecargo = await p.getByText('Ajustes de cobro').boundingBox();
const posPlan = await p.getByText('Mensual 2 grupos').first().boundingBox();
console.log('   el recargo queda después de los planes:', ok(posRecargo && posPlan && posRecargo.y > posPlan.y));

// 5) usuario: dice qué falta
await ir('/ajustes/usuarios');
await p.getByRole('button', { name: /Nuevo usuario/ }).first().click();
await dlg.getByPlaceholder('Ej. Monse').fill('Monse');
const t5 = await dlg.innerText();
console.log('5) usuario: el PIN muestra 6 puntos y dice qué falta:', ok((await dlg.getByPlaceholder('••••••').count()) === 1 && /Su PIN debe tener 6 dígitos/.test(t5)));
await p.keyboard.press('Escape');

const r = await revisarPagina(p);
console.log('6) sin desbordes, botones con nombre y buen contraste:', ok(!r.ancho && !r.sinNombre.length && !r.contraste?.length), JSON.stringify({ ancho: r.ancho, sinNombre: r.sinNombre, contraste: r.contraste }));
console.log('errores:', errores.length ? errores : 'ninguno');
await b.close();
