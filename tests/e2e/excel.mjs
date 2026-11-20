// Excel del mes para el contador: se descarga desde Gastos y utilidad, y es un .xlsx de verdad
// (se abre con openpyxl, la librería de Python que lee Excel) con Resumen, Cobros, Gastos y Cortes que cuadran.
import { chromium } from 'playwright-core';
import { spawnSync } from 'node:child_process';
const OUT = new URL('./salida/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const ok = (c) => (c ? 'OK' : 'MAL');
const b = await chromium.launch({ channel: 'msedge' });
const p = await (await b.newContext({ viewport: { width: 1280, height: 860 }, locale: 'es-MX', acceptDownloads: true })).newPage();
const errores = [];
p.on('pageerror', (e) => errores.push(e.message));
await p.clock.install({ time: new Date('2026-11-13T21:30:00') });
await p.goto('http://localhost:4173/');
await p.waitForFunction(() => !!window.compasDev);
await p.evaluate(() => window.compasDev.demoCompleta());
await p.reload();
await p.getByText('Dirección Calo', { exact: true }).click();
await p.keyboard.type('1234', { delay: 30 });
await p.waitForTimeout(1200);
await p.evaluate(() => { history.pushState(null, '', '/reportes/gastos'); dispatchEvent(new PopStateEvent('popstate')); });
const boton = p.getByRole('button', { name: /Excel de noviembre para el contador/ });
await boton.waitFor({ timeout: 15000 });
await p.screenshot({ path: `${OUT}excel-1.png` });

// lo que la app dice del mes, para comparar con el archivo
const esperado = await p.evaluate(async () => {
  const { db } = window.compasDev;
  const enMes = (x) => x.fecha >= '2026-11-01' && x.fecha <= '2026-11-30' && !x.deletedAt;
  const pagos = (await db.pagos.toArray()).filter((x) => enMes(x) && !x.anuladoAt);
  const gastos = (await db.gastos.toArray()).filter(enMes);
  const cortes = (await db.cortes.toArray()).filter(enMes);
  const suma = (xs) => xs.reduce((s, x) => s + x.monto, 0) / 100;
  return { cobros: pagos.length, gastos: gastos.length, cortes: cortes.length, ingresos: suma(pagos), totalGastos: suma(gastos), efectivo: suma(pagos.filter((x) => x.metodo === 'efectivo')) };
});

const [descarga] = await Promise.all([p.waitForEvent('download'), boton.click()]);
const ruta = `${OUT}excel-mes.xlsx`;
await descarga.saveAs(ruta);
console.log('1) descarga con buen nombre:', ok(descarga.suggestedFilename() === 'Calo-Latino-Studio-2026-11.xlsx'), descarga.suggestedFilename());
await p.getByText(/está en tus descargas/).waitFor({ timeout: 3000 }).catch(() => {});
console.log('   y avisa dónde quedó:', ok((await p.getByText(/está en tus descargas/).count()) > 0));

// leerlo como lo leería Excel
const py = `
import json, sys, datetime, openpyxl
wb = openpyxl.load_workbook(sys.argv[1])
r = {'hojas': wb.sheetnames}
res = {row[0]: row[1] for row in wb['Resumen'].iter_rows(values_only=True) if row and row[0]}
r['ingresos'] = res.get('Total de ingresos'); r['gastos'] = res.get('Total de gastos'); r['efectivo'] = res.get('Efectivo'); r['utilidad'] = res.get('Utilidad (ingresos − gastos)')
c = wb['Cobros']
filas = list(c.iter_rows(values_only=True))
r['encCobros'] = list(filas[0]); r['nCobros'] = len(filas) - 2; r['totalCobros'] = filas[-1][5]
r['fechaEsFecha'] = isinstance(filas[1][0], datetime.datetime); r['montoEsNumero'] = isinstance(filas[1][5], (int, float))
r['formatoMonto'] = c.cell(row=2, column=6).number_format; r['congelado'] = c.freeze_panes; r['filtro'] = c.auto_filter.ref
g = list(wb['Gastos'].iter_rows(values_only=True)); r['nGastos'] = len(g) - 2
k = list(wb['Cortes de caja'].iter_rows(values_only=True)); r['nCortes'] = len(k) - 1
print(json.dumps(r, default=str))
`;
const res = spawnSync('python', ['-c', py, ruta], { encoding: 'utf8' });
if (res.status !== 0) console.log('openpyxl no lo pudo abrir: MAL', res.stderr);
const x = JSON.parse(res.stdout || '{}');
const cerca = (a, b2) => Math.abs((a ?? NaN) - b2) < 0.005;
console.log('2) Excel lo abre y trae las 4 hojas:', ok(JSON.stringify(x.hojas) === JSON.stringify(['Resumen', 'Cobros', 'Gastos', 'Cortes de caja'])), x.hojas);
console.log('3) Resumen cuadra con la app (ingresos, efectivo, gastos, utilidad):', ok(cerca(x.ingresos, esperado.ingresos) && cerca(x.efectivo, esperado.efectivo) && cerca(x.gastos, esperado.totalGastos) && cerca(x.utilidad, esperado.ingresos - esperado.totalGastos)), x.ingresos, esperado.ingresos);
console.log('4) un renglón por cobro, gasto y corte:', ok(x.nCobros === esperado.cobros && x.nGastos === esperado.gastos && x.nCortes === esperado.cortes), x.nCobros, x.nGastos, x.nCortes, JSON.stringify(esperado));
console.log('5) fechas como fecha y montos como número con formato $ (se pueden sumar):', ok(x.fechaEsFecha && x.montoEsNumero && x.formatoMonto.includes('$') && cerca(x.totalCobros, esperado.ingresos)), x.formatoMonto);
console.log('6) encabezado fijo y con filtros:', ok(x.congelado === 'A2' && /^A1:/.test(x.filtro ?? '')), x.congelado, x.filtro, JSON.stringify(x.encCobros));
console.log('errores:', errores.length ? errores : 'ninguno');
await b.close();
