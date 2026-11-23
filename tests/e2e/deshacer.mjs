// Borrar algo por error se arregla con "Deshacer" en el aviso (en vez de preguntar "¿seguro?" antes).
import { chromium } from 'playwright-core';
const ok = (c) => (c ? 'OK' : 'MAL');
const b = await chromium.launch({ channel: 'msedge' });
const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'es-MX' })).newPage();
const errores = [];
p.on('pageerror', (e) => errores.push(e.message));
const ir = async (r) => { await p.evaluate((x) => { history.pushState(null, '', x); dispatchEvent(new PopStateEvent('popstate')); }, r); await p.waitForTimeout(400); };
const dlg = p.getByRole('dialog');
const vivas = () => p.evaluate(async () => (await window.compasDev.db.disciplinas.toArray()).filter((d) => !d.deletedAt).map((d) => d.nombre));

await p.goto('http://localhost:4173/');
await p.getByRole('button', { name: /Crear una academia nueva/ }).click();
await p.getByPlaceholder(/Son de Barrio/).fill('Ritmo Norte');
await p.getByPlaceholder('Ej. Eduardo').fill('Calo');
await p.getByRole('button', { name: 'Continuar' }).click();
await p.waitForTimeout(400);
await p.keyboard.type('482915', { delay: 50 });
await p.waitForTimeout(700);
await p.keyboard.type('482915', { delay: 50 });
await p.getByText('Deja lista tu academia').waitFor({ timeout: 8000 });

await ir('/ajustes/disciplinas');
await p.getByRole('button', { name: /Nueva disciplina/ }).first().click();
await dlg.getByPlaceholder(/Cumbia/).fill('Cumbia');
await dlg.getByRole('button', { name: 'Guardar' }).click();
await p.waitForTimeout(500);
await p.getByText('Cumbia', { exact: true }).click();
await dlg.getByRole('button', { name: 'Eliminar' }).click();
await p.getByText('Cumbia eliminada').waitFor();
const borrada = !(await vivas()).includes('Cumbia');
await p.getByRole('button', { name: 'Deshacer' }).click();
await p.waitForTimeout(600);
const volvio = (await vivas()).includes('Cumbia') && (await p.getByText('Cumbia', { exact: true }).count()) === 1;
console.log('1) eliminar una disciplina avisa con "Deshacer" y la devuelve:', ok(borrada && volvio));
console.log('errores:', errores.length ? errores : 'ninguno');
await b.close();
