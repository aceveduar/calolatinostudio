// Testimonios: el alumno lo escribe en su portal; dirección, recepción o su maestro lo publica o no.
import { chromium } from 'playwright-core';
const OUT = new URL('./salida/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const browser = await chromium.launch({ channel: 'msedge' });
const ok = (c) => (c ? 'OK' : 'MAL');
const errores = [];
const TOKEN = 'AbCdEfGhJkLmNpQrStUvWxYz23';

// 1) portal: escribir y enviar
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'es-MX' });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errores.push(e.message));
  let testimonio = null;
  let enviado = null;
  let respuesta = { ok: true };
  let llevadas = 1;
  await ctx.route('**/rest/v1/rpc/portal_alumno', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ hoy: '2026-11-18', alumno: { nombre: 'Ana López Pérez', codigo: 'K7P2QX', foto: null }, academia: { nombre: 'Calo Latino Studio', color: '#d6304a', logo: null }, planes: [], clases: [], tienda: [], testimonio, logros: { total: llevadas, desde: '2026-10-01', semanas: [] } }) }),
  );
  await ctx.route('**/rest/v1/rpc/portal_testimonio', (r) => {
    enviado = JSON.parse(r.request().postData());
    if (respuesta.ok) testimonio = { texto: enviado.p_texto, estado: 'pendiente' };
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(respuesta) });
  });
  await page.goto(`http://localhost:4173/p/${TOKEN}`);
  await page.getByText('Calo Latino Studio').first().waitFor();
  await page.waitForTimeout(400);
  console.log('0) a la primera clase todavía no se le pide su testimonio:', ok((await page.getByLabel('Tu testimonio').count()) === 0));
  llevadas = 12;
  await page.reload();
  const campo = page.getByLabel('Tu testimonio');
  await campo.waitFor();
  const t = (await page.locator('body').innerText()).replace(/\s+/g, ' ');
  console.log('1a) se avisa que se revisa y que aparece como "Ana L.":', ok(/Lo revisamos antes de publicarlo/.test(t) && /aparece como Ana L\./.test(t)));
  const enviar = page.getByRole('button', { name: 'Enviar' });
  await campo.fill('Muy bien');
  console.log('1b) con muy poco texto no deja enviar:', ok(await enviar.isDisabled()));
  respuesta = { error: 'muchos' };
  await campo.fill('Llegué sin saber nada y ahora no me pierdo un social.');
  await enviar.click();
  await page.getByRole('alert').waitFor();
  console.log('1c) error claro (muchos envíos):', ok(/Inténtalo mañana/.test(await page.getByRole('alert').innerText())));
  respuesta = { ok: true };
  await enviar.click();
  await page.getByText('¡Gracias! Lo estamos revisando.').waitFor();
  console.log('1d) se envía con su enlace y queda en revisión:', ok(enviado?.p_token === TOKEN && /no me pierdo un social/.test(enviado?.p_texto)));
  await page.screenshot({ path: `${OUT}testimonio-portal.png`, fullPage: true });
  // 1e) es opcional: con la ✕ se quita, queda "Contar mi experiencia" abajo y se recuerda al volver
  await page.getByRole('button', { name: /Quitar “Tu experiencia”/ }).click();
  const quitada = (await page.getByText('Tu experiencia').count()) === 0;
  await page.reload();
  await page.getByText('Calo Latino Studio').first().waitFor();
  await page.waitForTimeout(400);
  const recuerda = (await page.getByText('Tu experiencia').count()) === 0;
  await page.getByRole('button', { name: 'Contar mi experiencia' }).click();
  console.log('1e) la ✕ la quita, se recuerda al volver y "Contar mi experiencia" la regresa:', ok(quitada && recuerda && (await page.getByText('Tu experiencia').count()) === 1));
  await ctx.close();
}

// 2) app: dirección revisa
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'es-MX' });
const page = await ctx.newPage();
page.on('pageerror', (e) => errores.push(e.message));
const ir = (r) => page.evaluate((x) => { history.pushState(null, '', x); dispatchEvent(new PopStateEvent('popstate')); }, r);
const entrar = async (quien, pin) => {
  await page.getByText(quien, { exact: true }).click();
  for (const d of pin) await page.getByRole('button', { name: d, exact: true }).click();
  await page.waitForTimeout(800);
};
const salir = async () => {
  await ir('/');
  await page.waitForTimeout(400);
  await page.getByRole('button', { name: /cambiar usuario/i }).first().click();
  await page.getByText('¿Quién eres?').waitFor();
};
await page.goto('http://localhost:4173/');
await page.waitForFunction(() => !!window.compasDev);
await page.evaluate(async () => {
  await window.compasDev.demoCompleta();
  // la página trae testimonios "Ejemplo:" de muestra
  const a = (await window.compasDev.db.academias.toArray())[0];
  await window.compasDev.db.academias.update(a.id, { pagina: { ...(a.pagina ?? {}), testimonios: [{ texto: 'Ejemplo: me encanta', nombre: 'Ejemplo' }] } });
});
await page.reload();
await entrar('Dirección Calo', '1234');
await ir('/mas');
// el contador llega un instante después (consulta en vivo): esperarlo en lugar de un tiempo fijo
await page.getByRole('link', { name: /Testimonios/ }).filter({ hasText: '3' }).waitFor({ timeout: 5000 }).catch(() => {});
const mosaico = (await page.getByRole('link', { name: /Testimonios/ }).innerText()).replace(/\s+/g, ' ');
console.log('2a) "Más" muestra Testimonios con 3 por revisar:', ok(/3/.test(mosaico)), mosaico);
await page.getByRole('link', { name: /Testimonios/ }).click();
await page.getByText(/Por revisar \(3\)/).waitFor();
await page.screenshot({ path: `${OUT}testimonios-lista.png`, fullPage: true });
const primero = await page.locator('blockquote').first().innerText();
await page.getByRole('button', { name: 'Publicar', exact: true }).first().click();
await page.getByText('Publicado en tu página').waitFor();
const pagina = await page.evaluate(async () => (await window.compasDev.db.academias.toArray())[0].pagina.testimonios);
console.log('2b) publicar: va primero en la página, como "Nombre I." y sin los de ejemplo:', ok(pagina[0].texto === primero.trim() && /^\S+ \S\.$/.test(pagina[0].nombre) && !pagina.some((x) => /^Ejemplo/.test(x.texto))), JSON.stringify(pagina[0]));
await page.getByRole('button', { name: 'No publicar' }).first().click();
await page.getByText('No se publicará').waitFor();
console.log('2c) no publicar: sale de "Por revisar":', ok((await page.getByText(/Por revisar \(1\)/).count()) === 1));
await page.getByRole('button', { name: 'Deshacer' }).click();
await page.getByText(/Por revisar \(2\)/).waitFor({ timeout: 3000 }).catch(() => {});
console.log('2d) y se puede deshacer:', ok((await page.getByText(/Por revisar \(2\)/).count()) === 1));
await salir();

// 3) el maestro ve los de sus alumnos; 4) recepción también tiene la pantalla
await entrar('Profe Luis Herrera', '5555');
await page.waitForTimeout(800);
const tm = (await page.locator('main').innerText()).replace(/\s+/g, ' ');
console.log('3) el maestro ve los testimonios de sus alumnos:', ok(/Testimonios de tus alumnos · 2/i.test(tm) && (await page.getByRole('button', { name: 'Publicar', exact: true }).count()) === 2));
await salir();
await entrar('Monse', '1111');
await ir('/alumnos/testimonios');
await page.getByText(/Por revisar \(2\)/).waitFor({ timeout: 5000 }).catch(() => {});
console.log('4) recepción también los revisa:', ok((await page.getByText(/Por revisar \(2\)/).count()) === 1));
console.log('errores:', errores.length ? errores : 'ninguno');
await browser.close();
