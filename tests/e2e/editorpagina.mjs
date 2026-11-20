// Editor de la página pública: un solo "Guardar cambios" para todo (antes dos botones y era fácil perder un
// cambio), secciones en el orden de la página, y el enlace con Abrir / Copiar / Compartir hasta arriba.
import { chromium } from 'playwright-core';
import { revisarPagina } from './revisar.mjs';
const OUT = new URL('./salida/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const ok = (c) => (c ? 'OK' : 'MAL');
const b = await chromium.launch({ channel: 'msedge' });
const errores = [];
for (const [n, vp, movil] of [['cel', { width: 390, height: 844 }, true], ['pc', { width: 1366, height: 860 }, false]]) {
  const p = await (await b.newContext({ viewport: vp, locale: 'es-MX', ...(movil ? { isMobile: true, hasTouch: true } : {}) })).newPage();
  p.on('pageerror', (e) => errores.push(e.message));
  await p.goto('http://localhost:4173/');
  await p.waitForFunction(() => !!window.compasDev);
  await p.evaluate(() => window.compasDev.demoCompleta());
  await p.reload();
  await p.getByText('Dirección Calo', { exact: true }).click();
  await p.keyboard.type('1234', { delay: 30 });
  await p.waitForTimeout(1200);
  await p.evaluate(() => { history.pushState(null, '', '/ajustes/pagina'); dispatchEvent(new PopStateEvent('popstate')); });
  await p.getByText('Tu página:').waitFor();
  await p.screenshot({ path: `${OUT}editorpagina-${n}.png` });
  if (n === 'pc') break;

  // 1) arriba el enlace con Abrir / Copiar / Compartir; los atajos en el orden de la página
  const compartir = await p.getByRole('link', { name: /Compartir/ }).getAttribute('href');
  const secciones = (await p.locator('section[id^="seccion-"] > button span.font-extrabold').allInnerTexts()).join(',');
  const abiertas = await p.locator('section[id^="seccion-"] > button[aria-expanded="true"]').count();
  await p.screenshot({ path: `${OUT}editorpagina-cel-menu.png`, fullPage: true });
  console.log('1) enlace arriba con "Compartir"; secciones plegadas con resumen, en el orden de la página:', ok(/wa\.me\/\?text=.*calo-latino/.test(compartir ?? '') && abiertas === 0 && secciones === 'Portada,Galería,Testimonios,Dónde estamos,Preguntas frecuentes,Redes sociales,Aviso de privacidad,Enlace y WhatsApp'), secciones);
  await p.getByRole('button', { name: /^Portada/ }).click();
  await p.getByRole('button', { name: /^Enlace y WhatsApp/ }).click();

  // 2) un solo botón guarda el WhatsApp (sección "Enlace y WhatsApp") y el contenido a la vez
  const guardar = p.getByRole('button', { name: 'Guardar cambios' });
  await p.getByPlaceholder('Ej. 5512345678').fill('5511112222');
  await p.getByPlaceholder('Aprende a bailar salsa y bachata').fill('Ven a bailar con nosotros');
  const botones = await p.getByRole('button', { name: /Guardar/ }).count();
  await guardar.click();
  await p.getByText('Página actualizada').waitFor();
  const a = await p.evaluate(async () => (await window.compasDev.db.academias.toArray())[0]);
  console.log('2) un solo "Guardar cambios" guarda el WhatsApp y el contenido juntos:', ok(botones === 1 && a.whatsapp === '5511112222' && a.pagina?.frase === 'Ven a bailar con nosotros'), botones);

  // 3) WhatsApp incompleto: el botón lo dice en vez de solo apagarse
  await p.getByPlaceholder('Ej. 5512345678').fill('55');
  console.log('3) con un WhatsApp incompleto, el botón dice qué revisar:', ok((await p.getByRole('button', { name: 'Revisa el enlace o el WhatsApp' }).count()) === 1));
  const r = await revisarPagina(p);
  console.log('4) sin desbordes, botones con nombre y buen contraste:', ok(!r.ancho && !r.sinNombre.length && !r.contraste?.length), JSON.stringify({ ancho: r.ancho, sinNombre: r.sinNombre, contraste: r.contraste }));
}
console.log('errores:', errores.length ? errores : 'ninguno');
await b.close();
