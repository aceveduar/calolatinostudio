// Prueba REAL contra la nube de la demo: dos "teléfonos" con la misma academia.
// No corre con `npm run test:e2e` (esa usa una nube falsa). Toca datos de la demo, que son de prueba.
//
//   COMPAS_DEMO_CORREO=… COMPAS_DEMO_CLAVE=… node tests/nube/dos-telefonos.mjs
//
// Requiere el .env real (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY). Nunca pongas la contraseña en el código.
import { chromium } from 'playwright-core';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { leerEncabezados, servir } from '../e2e/servidor.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const CORREO = process.env.COMPAS_DEMO_CORREO;
const CLAVE = process.env.COMPAS_DEMO_CLAVE;
const PIN = process.env.COMPAS_DEMO_PIN ?? '1234';
if (!CORREO || !CLAVE) {
  console.error('Faltan COMPAS_DEMO_CORREO y COMPAS_DEMO_CLAVE');
  process.exit(1);
}
const ok = (c) => (c ? 'OK' : 'MAL');
let fallas = 0;
const revisar = (texto, c, extra = '') => {
  if (!c) fallas++;
  console.log(texto, ok(c), extra);
};

console.log('Compilando con la nube real…');
const b = spawnSync('npx', ['vite', 'build', '--outDir', 'dist-nube', '--emptyOutDir'], { cwd: RAIZ, env: { ...process.env, VITE_SEMILLA: '1' }, stdio: 'ignore', shell: true });
if (b.status !== 0) process.exit(1);
const servidor = await servir({ carpeta: path.join(RAIZ, 'dist-nube'), puerto: 4174, encabezados: leerEncabezados(path.join(RAIZ, 'public', '_headers')) });
const browser = await chromium.launch({ channel: 'msedge' });
const errores = [];

async function telefono(nombre) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'es-MX' });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errores.push(`${nombre}: ${e.message}`));
  await page.goto('http://localhost:4174/');
  await page.getByRole('button', { name: /Conectar a mi academia/ }).click();
  await page.locator('input[type=email]').fill(CORREO);
  await page.locator('input[autocomplete="current-password"]').fill(CLAVE);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await page.getByText('Dirección Calo', { exact: true }).click({ timeout: 300_000 });
  for (const d of PIN) await page.getByRole('button', { name: d, exact: true }).click();
  await page.getByPlaceholder(/Quién llegó|Buscar…/).waitFor();
  await page.waitForFunction(() => !!window.compasDev, null, { timeout: 30_000 });
  return { ctx, page };
}

/** Sincroniza hasta que no quede nada en la cola (o se acabe el tiempo). */
async function sincronizar(page) {
  return page.evaluate(async () => {
    for (let i = 0; i < 20; i++) {
      await window.compasDev.sincronizar();
      if ((await window.compasDev.db.outbox.count()) === 0) return true;
      await new Promise((r) => setTimeout(r, 1000));
    }
    return false;
  });
}
const alumno = (page, id) => page.evaluate((x) => window.compasDev.db.alumnos.get(x), id);

const A = await telefono('A');
const B = await telefono('B');
console.log('Dos teléfonos conectados a la demo.');
const id = await A.page.evaluate(async () => (await window.compasDev.db.alumnos.filter((a) => !a.deletedAt && a.activo).first()).id);
const original = await alumno(A.page, id);
const nuevoTel = `55${String(Date.now()).slice(-8)}`;

// 1) B sin internet marca "ya le avisé"; mientras, A corrige el teléfono
await B.ctx.setOffline(true);
await A.page.evaluate(([x, tel]) => window.compasDev.actualizar('alumnos', x, { telefono: tel }), [id, nuevoTel]);
revisar('1a) A sube su cambio:', await sincronizar(A.page));
const marca = Date.now();
await B.page.evaluate(([x, t]) => window.compasDev.actualizar('alumnos', x, { avisos: { adeudo: t } }), [id, marca]);
await B.ctx.setOffline(false);
revisar('1b) B reconecta y sube su cambio:', await sincronizar(B.page));
await sincronizar(A.page);
const enA = await alumno(A.page, id);
const enB = await alumno(B.page, id);
revisar('1) ninguno pisa al otro (teléfono de A y aviso de B en los dos):', enA.telefono === nuevoTel && enB.telefono === nuevoTel && enA.avisos?.adeudo === marca && enB.avisos?.adeudo === marca, JSON.stringify({ A: [enA.telefono, enA.avisos?.adeudo], B: [enB.telefono, enB.avisos?.adeudo] }));

// 2) B con el reloj 3 horas adelantado no se queda con datos viejos
await B.page.evaluate(([x]) => window.compasDev.db.alumnos.update(x, { updatedAt: Date.now() + 3 * 3600_000 }), [id]);
const nuevoNombre = `${original.nombre.replace(/ \(prueba\)$/, '')} (prueba)`;
await A.page.evaluate(([x, n]) => window.compasDev.actualizar('alumnos', x, { nombre: n }), [id, nuevoNombre]);
await sincronizar(A.page);
await sincronizar(B.page);
revisar('2) un reloj adelantado igual recibe el cambio del otro:', (await alumno(B.page, id)).nombre === nuevoNombre);

// 3) dejarlo como estaba
await A.page.evaluate(([x, o]) => window.compasDev.actualizar('alumnos', x, { telefono: o.telefono, nombre: o.nombre, avisos: o.avisos ?? null }), [id, original]);
revisar('3) se restauró el alumno:', await sincronizar(A.page));

// 4) B cobra SIN internet; mientras no suba, no deja quitar la academia; al reconectar, A lo ve
const visitante = `Visitante Nube ${String(Date.now()).slice(-5)}`;
await B.ctx.setOffline(true);
await B.page.getByRole('button', { name: /Elegir clase|Otra/ }).click();
await B.page.getByRole('button', { name: /Salsa|Bachata/ }).first().click();
await B.page.getByPlaceholder(/Quién llegó|Buscar…/).fill(visitante.toLowerCase());
await B.page.getByText(`Nuevo: ${visitante}`).click();
await B.page.getByRole('button', { name: 'Listo' }).click();
await B.page.waitForTimeout(500);
const enCola = await B.page.evaluate(() => window.compasDev.db.outbox.count());
revisar('4a) sin internet el cobro queda guardado y en espera:', enCola > 0, `(${enCola} en cola)`);
const ayuda = async () => {
  await B.page.getByRole('button', { name: /cambiar usuario/ }).first().click();
  await B.page.getByText('¿Olvidaste tu PIN o es otra academia?').click();
  await B.page.getByRole('button', { name: /^Es otra academia/ }).click();
};
await ayuda();
revisar('4b) con cobros sin subir NO deja quitar la academia:', await B.page.getByRole('button', { name: 'Quitar academia de este teléfono' }).isDisabled());
await B.ctx.setOffline(false);
revisar('4c) al reconectar sube todo:', await sincronizar(B.page));
await sincronizar(A.page);
const visto = await A.page.evaluate(async (n) => {
  const al = await window.compasDev.db.alumnos.where('nombre').equals(n).first();
  if (!al) return null;
  const asis = await window.compasDev.db.asistencias.where('alumnoId').equals(al.id).toArray();
  const pagos = await window.compasDev.db.pagos.where('alumnoId').equals(al.id).toArray();
  return { id: al.id, asis: asis.length, pagos: pagos.map((p) => p.id) };
}, visitante);
revisar('4) el otro teléfono ve al visitante, su entrada y su cobro:', !!visto && visto.asis === 1 && visto.pagos.length === 1, JSON.stringify(visto));

// 5) ya respaldado: quitar la academia borra SOLO este teléfono
await B.page.waitForTimeout(800);
const quitar = B.page.getByRole('button', { name: 'Quitar academia de este teléfono' });
revisar('5a) ya respaldado sí deja quitarla:', await quitar.isEnabled());
await quitar.click();
await B.page.getByRole('button', { name: 'Toca otra vez para quitarla' }).click();
await B.page.getByRole('button', { name: /Conectar a mi academia/ }).waitFor({ timeout: 30_000 });
await B.page.waitForFunction(() => !!window.compasDev);
const quedan = await B.page.evaluate(async () => ({ alumnos: await window.compasDev.db.alumnos.count(), pagos: await window.compasDev.db.pagos.count() }));
revisar('5b) el teléfono quedó vacío:', quedan.alumnos === 0 && quedan.pagos === 0, JSON.stringify(quedan));
await sincronizar(A.page);
revisar('5c) la nube y el otro teléfono siguen intactos:', !!(await A.page.evaluate((x) => window.compasDev.db.alumnos.get(x), visto?.id)));

// limpieza: el visitante de prueba se da de baja y su cobro se anula
if (visto) {
  await A.page.evaluate(async ([al, pagos]) => {
    for (const p of pagos) await window.compasDev.actualizar('pagos', p, { anuladoAt: Date.now(), anuladoMotivo: 'Prueba automática' });
    await window.compasDev.actualizar('alumnos', al, { deletedAt: Date.now() });
  }, [visto.id, visto.pagos]);
  revisar('6) limpieza en la nube:', await sincronizar(A.page));
}

console.log('errores:', errores.length ? errores : 'ninguno');
const bloqueos = [...new Set(servidor.avisos)];
if (bloqueos.length) console.log('bloqueos de la política de seguridad:', bloqueos);
await browser.close();
servidor.cerrar();
process.exit(fallas || errores.length || bloqueos.length ? 1 : 0);
