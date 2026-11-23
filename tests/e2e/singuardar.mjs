// Página pública con cambios sin guardar: al tocar un enlace de la app pregunta antes de salir, y si se sale
// por otro lado (botón atrás del teléfono, cerrar la app) queda un borrador para recuperarlo.
import { chromium } from 'playwright-core';
const ok = (c) => (c ? 'OK' : 'MAL');
const b = await chromium.launch({ channel: 'msedge' });
const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'es-MX' })).newPage();
const errores = [];
p.on('pageerror', (e) => errores.push(e.message));
const ir = (r) => p.evaluate((x) => { history.pushState(null, '', x); dispatchEvent(new PopStateEvent('popstate')); }, r);
await p.goto('http://localhost:4173/');
await p.waitForFunction(() => !!window.compasDev);
await p.evaluate(() => window.compasDev.demoCompleta());
await p.reload();
await p.getByText('Dirección Calo', { exact: true }).click();
await p.keyboard.type('1234', { delay: 30 });
await p.waitForTimeout(1200);
await ir('/ajustes/pagina');
await p.getByText('Tu página:').waitFor();
await p.getByRole('button', { name: /^Portada/ }).click();
await p.getByPlaceholder('Aprende a bailar salsa y bachata').fill('Frase nueva sin guardar');
await p.waitForTimeout(900); // el borrador se guarda al dejar de escribir

// 1) tocar "Entrada" en el menú: pregunta; "Seguir editando" se queda con lo escrito
await p.getByRole('link', { name: 'Entrada' }).first().click();
const pregunta = p.getByRole('dialog', { name: /Tienes cambios sin guardar/ });
await pregunta.waitFor({ timeout: 3000 });
await pregunta.getByRole('button', { name: 'Seguir editando' }).click();
await p.waitForTimeout(300);
console.log('1) con cambios, tocar el menú pregunta y "Seguir editando" se queda en la página:', ok(/\/ajustes\/pagina/.test(p.url()) && (await p.getByPlaceholder('Aprende a bailar salsa y bachata').inputValue()) === 'Frase nueva sin guardar'));

// 2) salir "por atrás" (sin pasar por un enlace): al volver, ofrece recuperar el borrador
await ir('/');
await p.waitForTimeout(500);
await ir('/ajustes/pagina');
await p.getByText('Tienes cambios sin guardar de la última vez.').waitFor({ timeout: 3000 });
await p.getByRole('button', { name: 'Recuperar' }).click();
await p.getByRole('button', { name: /^Portada/ }).click();
const recuperada = await p.getByPlaceholder('Aprende a bailar salsa y bachata').inputValue();
console.log('2) salir por otro lado y volver: ofrece recuperar y recupera lo escrito:', ok(recuperada === 'Frase nueva sin guardar'), recuperada);

// 3) "Salir sin guardar" sale y ya no ofrece el borrador
await p.getByRole('link', { name: 'Entrada' }).first().click();
await p.getByRole('dialog', { name: /Tienes cambios sin guardar/ }).getByRole('button', { name: 'Salir sin guardar' }).click();
await p.waitForTimeout(600);
const salio = !/\/ajustes\/pagina/.test(p.url());
await ir('/ajustes/pagina');
await p.getByText('Tu página:').waitFor();
await p.waitForTimeout(400);
console.log('3) "Salir sin guardar" sale y ya no ofrece recuperar:', ok(salio && (await p.getByText('Tienes cambios sin guardar de la última vez.').count()) === 0));

// 4) guardar quita el borrador y ya no pregunta al salir
await p.getByRole('button', { name: /^Portada/ }).click();
await p.getByPlaceholder('Aprende a bailar salsa y bachata').fill('Frase guardada');
await p.getByRole('button', { name: 'Guardar cambios' }).click();
await p.getByText('Página actualizada').waitFor();
await p.getByRole('link', { name: 'Entrada' }).first().click();
await p.waitForTimeout(600);
console.log('4) ya guardado, el menú sale directo sin preguntar:', ok((await p.getByRole('dialog', { name: /Tienes cambios sin guardar/ }).count()) === 0 && !/\/ajustes\/pagina/.test(p.url())));
console.log('errores:', errores.length ? errores : 'ninguno');
await b.close();
