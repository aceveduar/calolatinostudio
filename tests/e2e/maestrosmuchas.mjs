// Maestro en una academia con muchas clases: arriba las suyas, buscador y grupos por disciplina plegados
// (antes, con 60 clases, el formulario era una pared de botones).
import { chromium } from 'playwright-core';
import { revisarPagina } from './revisar.mjs';
const OUT = new URL('./salida/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const ok = (c) => (c ? 'OK' : 'MAL');
const b = await chromium.launch({ channel: 'msedge' });
const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'es-MX' })).newPage();
const errores = [];
p.on('pageerror', (e) => errores.push(e.message));
const dlg = p.getByRole('dialog');
await p.goto('http://localhost:4173/');
await p.waitForFunction(() => !!window.compasDev);
await p.evaluate(async () => {
  await window.compasDev.sembrar();
  // 20 clases más, como una academia grande
  const { db } = window.compasDev;
  const [base] = await db.clases.toArray();
  const discs = await db.disciplinas.toArray();
  const ahora = Date.now();
  await db.clases.bulkPut(
    Array.from({ length: 20 }, (_, i) => ({ ...base, id: crypto.randomUUID(), disciplinaId: discs[i % discs.length].id, nivel: String(i % 4), dias: [1 + (i % 5)], horaInicio: `${String(9 + (i % 12)).padStart(2, '0')}:00`, maestroId: null, createdAt: ahora, updatedAt: ahora })),
  );
});
await p.reload();
await p.getByText('Dirección Calo', { exact: true }).click();
await p.keyboard.type('1234', { delay: 30 });
await p.waitForTimeout(1200);
await p.evaluate(() => { history.pushState(null, '', '/ajustes/maestros'); dispatchEvent(new PopStateEvent('popstate')); });
await p.getByRole('button', { name: /Nuevo maestro/ }).first().click();
await dlg.getByPlaceholder('Ej. Profe Luis').fill('Profe Nuevo');

// 1) agrupado y plegado: no hay botones de clase a la vista, solo los grupos
const plegado = (await dlg.locator('button[aria-pressed]').count()) === 0 && (await dlg.locator('button[aria-expanded="false"]').count()) >= 2;
await p.screenshot({ path: `${OUT}maestrosmuchas-1.png` });
console.log('1) con muchas clases: grupos por disciplina plegados y "Aún ninguna":', ok(plegado && (await dlg.getByText(/Aún ninguna/).count()) === 1));

// 2) buscar abre lo que coincide; elegir lo pone en "Las que da"
await dlg.getByLabel('Buscar clase').fill('salsa');
const encontradas = await dlg.locator('button[aria-pressed]').count();
await dlg.locator('button[aria-pressed="false"]').first().click();
await dlg.getByLabel('Buscar clase').fill('');
const arriba = await dlg.getByRole('button', { name: /^Quitar / }).count();
await p.screenshot({ path: `${OUT}maestrosmuchas-2.png` });
console.log('2) buscar "salsa" muestra solo esas; la elegida sube a "Las que da":', ok(encontradas > 0 && arriba === 1), encontradas);

// 3) abrir un grupo a mano y guardar: la clase queda asignada
await dlg.locator('button[aria-expanded="false"]').first().click();
await dlg.locator('button[aria-pressed="false"]').first().click();
await dlg.getByRole('button', { name: 'Guardar' }).click();
await p.getByText('Maestro guardado').waitFor();
const asignadas = await p.evaluate(async () => {
  const { db } = window.compasDev;
  const m = (await db.maestros.toArray()).find((x) => x.nombre === 'Profe Nuevo');
  return (await db.clases.toArray()).filter((c) => c.maestroId === m.id).length;
});
console.log('3) abrir un grupo, elegir otra y guardar: 2 clases asignadas:', ok(asignadas === 2), asignadas);
const r = await revisarPagina(p);
console.log('4) sin desbordes, botones con nombre y buen contraste:', ok(!r.ancho && !r.sinNombre.length && !r.contraste?.length), JSON.stringify({ ancho: r.ancho, sinNombre: r.sinNombre, contraste: r.contraste }));
console.log('errores:', errores.length ? errores : 'ninguno');
await b.close();
