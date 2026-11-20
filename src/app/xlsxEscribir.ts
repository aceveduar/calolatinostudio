/**
 * Escribe un Excel (.xlsx) sin librerías: un zip (sin comprimir) con el XML mínimo que Excel, Google Sheets
 * y Numbers abren. Moneda con formato $, fechas como fecha de Excel, encabezados en negritas fijos al bajar
 * y con filtros.
 */
import type { Celda, HojaXlsx } from '../domain/exportarMes';

// ---------- zip ----------
const TABLA_CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(d: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < d.length; i++) c = TABLA_CRC[(c ^ d[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function zip(archivos: { nombre: string; texto: string }[]): Blob {
  const enc = new TextEncoder();
  const partes: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  for (const a of archivos) {
    const nombre = enc.encode(a.nombre);
    const datos = enc.encode(a.texto);
    const crc = crc32(datos);
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true);
    local.setUint16(6, 0x0800, true); // nombres en UTF-8
    local.setUint32(14, crc, true);
    local.setUint32(18, datos.length, true);
    local.setUint32(22, datos.length, true);
    local.setUint16(26, nombre.length, true);
    const cen = new DataView(new ArrayBuffer(46));
    cen.setUint32(0, 0x02014b50, true);
    cen.setUint16(4, 20, true);
    cen.setUint16(6, 20, true);
    cen.setUint16(8, 0x0800, true);
    cen.setUint32(16, crc, true);
    cen.setUint32(20, datos.length, true);
    cen.setUint32(24, datos.length, true);
    cen.setUint16(28, nombre.length, true);
    cen.setUint32(42, offset, true);
    partes.push(new Uint8Array(local.buffer), nombre, datos);
    central.push(new Uint8Array(cen.buffer), nombre);
    offset += 30 + nombre.length + datos.length;
  }
  const tam = central.reduce((s, x) => s + x.length, 0);
  const fin = new DataView(new ArrayBuffer(22));
  fin.setUint32(0, 0x06054b50, true);
  fin.setUint16(8, archivos.length, true);
  fin.setUint16(10, archivos.length, true);
  fin.setUint32(12, tam, true);
  fin.setUint32(16, offset, true);
  return new Blob([...partes, ...central, new Uint8Array(fin.buffer)] as BlobPart[], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

// ---------- hojas ----------
// quita los caracteres de control que XML no permite (a propósito: si llegan en un concepto, Excel no abre el archivo)
// eslint-disable-next-line no-control-regex
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, '');
const col = (i: number) => (i < 26 ? String.fromCharCode(65 + i) : String.fromCharCode(64 + Math.floor(i / 26)) + String.fromCharCode(65 + (i % 26)));
/** "2026-11-13" → número de día de Excel (días desde el 30 dic 1899) */
const diaExcel = (f: string) => {
  const [y, m, d] = f.split('-').map(Number);
  return (Date.UTC(y, m - 1, d) - Date.UTC(1899, 11, 30)) / 86400000;
};

// estilos (índices de cellXfs en styles.xml)
const E = { normal: 0, encabezado: 1, dinero: 2, fecha: 3, total: 4, negrita: 5, titulo: 6 };

function celda(c: Celda, ref: string, encabezado: boolean): string {
  if (c === null || c === undefined || c === '') return '';
  const texto = (v: string, s: number) => `<c r="${ref}" t="inlineStr"${s ? ` s="${s}"` : ''}><is><t xml:space="preserve">${esc(v)}</t></is></c>`;
  const num = (v: number, s: number) => `<c r="${ref}"${s ? ` s="${s}"` : ''}><v>${v}</v></c>`;
  if (typeof c === 'string') return texto(c, encabezado ? E.encabezado : E.normal);
  if (typeof c === 'number') return num(c, E.normal);
  switch (c.t) {
    case 'dinero':
      return num(c.v / 100, E.dinero);
    case 'total':
      return num(c.v / 100, E.total);
    case 'fecha':
      return num(diaExcel(c.v), E.fecha);
    case 'negrita':
      return texto(c.v, E.negrita);
    case 'titulo':
      return texto(c.v, E.titulo);
  }
}

function hojaXml(h: HojaXlsx): string {
  const ancho = Math.max(1, ...h.filas.map((f) => f.length));
  const filas = h.filas
    .map((f, r) => {
      const celdas = f.map((c, i) => celda(c, `${col(i)}${r + 1}`, h.conEncabezado && r === 0)).join('');
      return `<row r="${r + 1}">${celdas}</row>`;
    })
    .join('');
  const fijo = h.conEncabezado ? '<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>' : '';
  const cols = h.anchos.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('');
  // filtros sobre los datos (sin la fila de total)
  const filtro = h.conEncabezado && h.filas.length > 2 ? `<autoFilter ref="A1:${col(ancho - 1)}${h.filas.length - 1}"/>` : '';
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
    `<sheetViews><sheetView workbookViewId="0">${fijo}</sheetView></sheetViews>` +
    (cols ? `<cols>${cols}</cols>` : '') +
    `<sheetData>${filas}</sheetData>${filtro}</worksheet>`
  );
}

const ESTILOS =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
  '<numFmts count="2"><numFmt numFmtId="164" formatCode="&quot;$&quot;#,##0.00"/><numFmt numFmtId="165" formatCode="dd/mm/yyyy"/></numFmts>' +
  '<fonts count="3"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="14"/><name val="Calibri"/></font></fonts>' +
  '<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFEDEBF1"/><bgColor indexed="64"/></patternFill></fill></fills>' +
  '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
  '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
  '<cellXfs count="7">' +
  '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
  '<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>' +
  '<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>' +
  '<xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>' +
  '<xf numFmtId="164" fontId="1" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1"/>' +
  '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>' +
  '<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>' +
  '</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';

/** Los filtros de cada hoja también se declaran en el libro; sin filtros no va nada (Excel no acepta la lista vacía). */
function definidos(hojas: HojaXlsx[], nombres: string[]): string {
  const d = hojas
    .map((h, i) => (h.conEncabezado && h.filas.length > 2 ? `<definedName name="_xlnm._FilterDatabase" localSheetId="${i}" hidden="1">'${esc(nombres[i])}'!$A$1:$${col(Math.max(...h.filas.map((f) => f.length)) - 1)}$${h.filas.length - 1}</definedName>` : ''))
    .join('');
  return d ? `<definedNames>${d}</definedNames>` : '';
}

export function crearXlsx(hojas: HojaXlsx[]): Blob {
  // nombres de hoja: máximo 31 caracteres y sin : \ / ? * [ ]
  const nombres = hojas.map((h) => h.nombre.replace(/[:\\/?*[\]]/g, ' ').slice(0, 31));
  const ns = 'http://schemas.openxmlformats.org/';
  return zip([
    {
      nombre: '[Content_Types].xml',
      texto:
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="${ns}package/2006/content-types">` +
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>' +
        '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
        '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
        hojas.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('') +
        '</Types>',
    },
    {
      nombre: '_rels/.rels',
      texto: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="${ns}package/2006/relationships"><Relationship Id="rId1" Type="${ns}officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    },
    {
      nombre: 'xl/workbook.xml',
      texto:
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="${ns}spreadsheetml/2006/main" xmlns:r="${ns}officeDocument/2006/relationships"><sheets>` +
        nombres.map((n, i) => `<sheet name="${esc(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('') +
        '</sheets>' +
        definidos(hojas, nombres) +
        '</workbook>',
    },
    {
      nombre: 'xl/_rels/workbook.xml.rels',
      texto:
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="${ns}package/2006/relationships">` +
        hojas.map((_, i) => `<Relationship Id="rId${i + 1}" Type="${ns}officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('') +
        `<Relationship Id="rId${hojas.length + 1}" Type="${ns}officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
    },
    { nombre: 'xl/styles.xml', texto: ESTILOS },
    ...hojas.map((h, i) => ({ nombre: `xl/worksheets/sheet${i + 1}.xml`, texto: hojaXml(h) })),
  ]);
}
