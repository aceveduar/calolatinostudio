import { chromium } from 'playwright-core';
const OUT = new URL('./salida/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const ok = (c) => (c ? 'OK' : 'MAL');
const browser = await chromium.launch({ channel: 'msedge' });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'es-MX' });
const page = await ctx.newPage();
const errores = []; page.on('pageerror', (e) => errores.push(e.message));
await page.clock.install({ time: new Date('2026-11-13T19:30:00') }); // viernes 19:30
import { readFileSync } from 'node:fs';
const FOTO = 'data:image/jpeg;base64,' + readFileSync(new URL('./archivos/grupo.jpg', import.meta.url)).toString('base64');
const D = {
  academia: { nombre: 'Calo Latino Studio', color: '#0b6aa2', logo: null, whatsapp: '5648141057', sede_principal: 'Estudio' },
  pagina: { frase: 'Ven a bailar', preguntas: [], galeria: [FOTO, FOTO, FOTO], testimonios: [{ texto: 'Llegué sin saber nada y ahora no me pierdo un social.', nombre: 'Ejemplo: Ana', detalle: 'Alumna de salsa' }, { texto: 'El ambiente es increíble.', nombre: 'Ejemplo: Luis' }] },
  eventos0: null,
  sedes: [],
  clases: [
    { id: 'a', clase: 'Salsa 0', color: '#e8445a', dias: [5], hora: '19:00', duracion: 60, sede_id: null, precio: null },
    { id: 'b', clase: 'Bachata 1', color: '#7c4ddb', dias: [5], hora: '20:00', duracion: 60, sede_id: null, precio: null },
    { id: 'c', clase: 'Cumbia 0', color: '#d97706', dias: [1, 3], hora: '19:00', duracion: 60, sede_id: null, precio: null },
  ],
  planes: [
    { nombre: 'Clase suelta', tipo: 'suelta', precio: 6000, clases: 1, vigencia: 1, grupos: null, sede_id: null },
    { nombre: 'Bloque 8', tipo: 'paquete', precio: 40000, clases: 8, vigencia: 30, grupos: null, sede_id: null },
    { nombre: 'Mensualidad', tipo: 'mensual', precio: 65000, clases: null, vigencia: 30, grupos: null, sede_id: null },
  ],
  eventos: [{ nombre: 'Baile de Navidad', fecha: '2026-12-13', hora: '19:00', precio: 18000, descripcion: '', quedan: 12 }], tienda: [],
};
await ctx.route('**/rest/v1/rpc/pagina_publica', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(D) }));
await page.goto('http://localhost:4173/a/calo-latino');
await page.getByRole('heading', { level: 1 }).waitFor();
await page.waitForTimeout(1500);
const nums = await page.locator('header dd > span[aria-hidden]').allInnerTexts();
console.log('1) contadores llegan a su valor:', ok(nums[0] === '4' && nums[1] === '3'), nums.join(','));
// horario: abre en hoy, con "Ahora" y "Siguiente"
const hoyBtn = page.getByRole('button', { name: /^Hoy/ });
const horario = (await page.locator('#horarios').innerText()).replace(/\s+/g, ' ');
console.log('2) horario abre en hoy con "Ahora" y "En 30 min":', ok((await hoyBtn.getAttribute('aria-pressed')) === 'true' && /Salsa 0 Ahora/i.test(horario) && /Bachata 1 En 30 min/i.test(horario) && !/Cumbia/.test(horario.split('Toda la semana')[1])));
await page.getByRole('button', { name: /^Lun/ }).click();
await page.waitForTimeout(200);
console.log('3) otro día: solo sus clases, sin "Ahora":', ok(/Cumbia 0/.test(await page.locator('#horarios ul').innerText()) && !/Ahora/.test(await page.locator('#horarios ul').innerText())));
await page.locator('#horarios').scrollIntoViewIfNeeded();
await page.getByRole('button', { name: /^Hoy/ }).click();
await page.screenshot({ path: `${OUT}int-horario.png` });
// calculadora
const slider = page.getByLabel('¿Cuántas veces por semana quieres venir?');
await slider.scrollIntoViewIfNeeded();
const res = async () => (await page.locator('div[aria-live=polite]').innerText()).replace(/\s+/g, ' ');
let r1 = await res();
await slider.fill('1');
let r2 = await res();
await slider.fill('5');
let r3 = await res();
console.log('4) calculadora: 2/sem → Bloque 8 ($400), 1/sem → Clase suelta, 5/sem → Mensualidad:', ok(/Te conviene Bloque 8 \$400/.test(r1) && /Ahorras \$80/.test(r1) && /Te conviene Clase suelta \$240/.test(r2) && /Te conviene Mensualidad \$650/.test(r3)), '|', r1.slice(0, 70), '|', r3.slice(0, 60));
await slider.fill('2');
await page.waitForTimeout(600);
await page.locator('div[aria-live=polite]').scrollIntoViewIfNeeded();
await page.evaluate(() => scrollBy(0, -300));
await page.waitForTimeout(800);
await page.screenshot({ path: `${OUT}int-calc.png` });
// 5) tocar una clase la elige en el formulario
await page.locator('#horarios').scrollIntoViewIfNeeded();
await page.getByRole('button', { name: /^Apartar lugar en Bachata 1/ }).click();
await page.waitForTimeout(900);
console.log('5) tocar la clase: queda elegida y el cursor en el nombre:', ok((await page.locator('#inscribete select').inputValue()) === 'b' && (await page.evaluate(() => document.activeElement?.id)) === 'pp-nombre'));
const waClase = decodeURIComponent((await page.getByRole('link', { name: 'Preguntar por WhatsApp por Salsa 0' }).first().getAttribute('href')) ?? '');
console.log('   WhatsApp por clase con el texto:', ok(/wa\.me\/525648141057\?text=Hola, quiero información de la clase de Salsa 0 \(viernes 19:00\)/.test(waClase)));
// 6) galería con visor y testimonios
await page.getByRole('button', { name: 'Ver foto 2 de 3' }).click();
const abierto = await page.locator('dialog[open]').count();
await page.keyboard.press('ArrowRight');
const pos = await page.locator('dialog[open] [aria-live]').innerText();
await page.screenshot({ path: `${OUT}int-visor.png` });
await page.keyboard.press('Escape');
await page.waitForTimeout(200);
console.log('6) galería: abre en grande, flechas y Esc:', ok(abierto === 1 && pos.trim() === '3 / 3' && (await page.locator('dialog[open]').count()) === 0));
console.log('   testimonios visibles:', ok(await page.getByText('Llegué sin saber nada').isVisible()));
await page.locator('#comunidad').scrollIntoViewIfNeeded();
await page.waitForTimeout(800);
await page.screenshot({ path: `${OUT}int-comunidad.png` });
// 7) evento con urgencia y "Quiero ir"
const ir = decodeURIComponent((await page.getByRole('link', { name: 'Quiero ir' }).getAttribute('href')) ?? '');
console.log('7) evento: "Últimos 12 lugares" y Quiero ir:', ok((await page.getByText('¡Últimos 12 lugares!').count()) === 1 && /quiero boletos para Baile de Navidad/.test(ir)));
// 8) botones de 44 px
const bajos = await page.evaluate(() => [...document.querySelectorAll('#horarios button')].filter((b) => b.getBoundingClientRect().height < 44).map((b) => b.textContent));
console.log('8) botones del horario de 44 px o más:', ok(bajos.length === 0), bajos.slice(0, 3));
console.log('errores:', errores.length ? errores : 'ninguno');
await browser.close();
