/**
 * Lector mínimo de Excel (.xlsx): solo la primera hoja, solo los valores (texto y números). Sin librerías:
 * un .xlsx es un zip con XML adentro; el zip se abre con DecompressionStream del navegador.
 * Basta para importar una lista de alumnos; fórmulas, formatos y fechas no hacen falta.
 */

async function abrirZip(buf: ArrayBuffer): Promise<Map<string, () => Promise<string>>> {
  const v = new DataView(buf);
  let fin = -1;
  for (let i = buf.byteLength - 22; i >= Math.max(0, buf.byteLength - 66000); i--)
    if (v.getUint32(i, true) === 0x06054b50) {
      fin = i;
      break;
    }
  if (fin < 0) throw new Error('No parece un archivo de Excel (.xlsx)');
  const total = v.getUint16(fin + 10, true);
  let p = v.getUint32(fin + 16, true);
  const archivos = new Map<string, () => Promise<string>>();
  const texto = new TextDecoder();
  for (let n = 0; n < total; n++) {
    if (v.getUint32(p, true) !== 0x02014b50) break;
    const metodo = v.getUint16(p + 10, true);
    const tam = v.getUint32(p + 20, true);
    const largoNombre = v.getUint16(p + 28, true);
    const largoExtra = v.getUint16(p + 30, true);
    const largoComentario = v.getUint16(p + 32, true);
    const local = v.getUint32(p + 42, true);
    const nombre = texto.decode(new Uint8Array(buf, p + 46, largoNombre));
    archivos.set(nombre, async () => {
      const inicio = local + 30 + v.getUint16(local + 26, true) + v.getUint16(local + 28, true);
      const datos = new Uint8Array(buf, inicio, tam);
      if (metodo === 0) return texto.decode(datos);
      const flujo = new Blob([datos]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
      return new Response(flujo).text();
    });
    p += 46 + largoNombre + largoExtra + largoComentario;
  }
  return archivos;
}

const xml = (s: string) => new DOMParser().parseFromString(s, 'application/xml');
const hijos = (el: Element | Document, nombre: string) => Array.from(el.getElementsByTagNameNS('*', nombre));

/** "B12" → 1 (columna B, contando desde 0). */
const columna = (ref: string) => [...ref.replace(/\d+/g, '')].reduce((n, c) => n * 26 + c.charCodeAt(0) - 64, 0) - 1;

export async function leerExcel(archivo: Blob): Promise<string[][]> {
  const zip = await abrirZip(await archivo.arrayBuffer());
  const leer = async (ruta: string) => (zip.has(ruta) ? zip.get(ruta)!() : null);

  // la primera hoja del libro (no siempre se llama sheet1.xml)
  let hoja = 'xl/worksheets/sheet1.xml';
  const libro = await leer('xl/workbook.xml');
  const rels = await leer('xl/_rels/workbook.xml.rels');
  if (libro && rels) {
    const primera = hijos(xml(libro), 'sheet')[0];
    const id = primera?.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id') ?? primera?.getAttribute('r:id');
    const destino = hijos(xml(rels), 'Relationship').find((r) => r.getAttribute('Id') === id)?.getAttribute('Target');
    if (destino) hoja = destino.startsWith('/') ? destino.slice(1) : `xl/${destino}`;
  }
  const contenido = await leer(hoja);
  if (!contenido) throw new Error('El archivo no tiene hojas');

  const compartidos = await leer('xl/sharedStrings.xml');
  const textos = compartidos ? hijos(xml(compartidos), 'si').map((si) => hijos(si, 't').map((t) => t.textContent ?? '').join('')) : [];

  const filas: string[][] = [];
  for (const row of hijos(xml(contenido), 'row')) {
    const fila: string[] = [];
    for (const c of hijos(row, 'c')) {
      const tipo = c.getAttribute('t');
      const valor = hijos(c, 'v')[0]?.textContent ?? '';
      let s: string;
      if (tipo === 's') s = textos[Number(valor)] ?? '';
      else if (tipo === 'inlineStr') s = hijos(c, 't').map((t) => t.textContent ?? '').join('');
      // teléfonos guardados como número: 5.512345678E9 → "5512345678"
      else if (!tipo || tipo === 'n') s = /e/i.test(valor) ? String(Math.round(Number(valor))) : valor;
      else s = valor;
      const ref = c.getAttribute('r');
      fila[ref ? columna(ref) : fila.length] = s;
    }
    filas.push(Array.from(fila, (x) => x ?? ''));
  }
  return filas;
}
