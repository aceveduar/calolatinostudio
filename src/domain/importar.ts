/**
 * Importar alumnos de una lista que ya tiene la academia (Excel, Google Sheets, CSV o celdas pegadas).
 * Todo puro: leer la tabla, adivinar qué columna es qué y decidir qué fila se importa y cuál se salta.
 */

export type Campo = 'nombre' | 'apellido' | 'telefono' | 'notas';
export type Columnas = Record<Campo, number | null>;

/** Texto delimitado → filas. Adivina el separador (tabulador al pegar de Excel, ";" o ","), respeta comillas. */
export function leerTexto(texto: string): string[][] {
  const limpio = texto.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  const primera = limpio.split('\n').find((l) => l.trim()) ?? '';
  const cuenta = (c: string) => primera.split(c).length - 1;
  const sep = cuenta('\t') > 0 ? '\t' : cuenta(';') > cuenta(',') ? ';' : ',';
  const filas: string[][] = [];
  let fila: string[] = [];
  let celda = '';
  let comillas = false;
  for (let i = 0; i < limpio.length; i++) {
    const c = limpio[i];
    if (comillas) {
      if (c === '"' && limpio[i + 1] === '"') {
        celda += '"';
        i++;
      } else if (c === '"') comillas = false;
      else celda += c;
    } else if (c === '"' && celda === '') comillas = true;
    else if (c === sep) {
      fila.push(celda);
      celda = '';
    } else if (c === '\n') {
      fila.push(celda);
      filas.push(fila);
      fila = [];
      celda = '';
    } else celda += c;
  }
  fila.push(celda);
  filas.push(fila);
  return quitarVacias(filas);
}

export function quitarVacias(filas: string[][]): string[][] {
  return filas.map((f) => f.map((c) => (c ?? '').trim())).filter((f) => f.some(Boolean));
}

const norm = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

const PISTAS: Record<Campo, RegExp> = {
  apellido: /apellido|last ?name|surname/,
  nombre: /nombre|alumn|name|cliente|persona/,
  telefono: /tel|whats|cel|movil|phone|numero|contacto/,
  notas: /nota|coment|observ|obs\b|detalle/,
};

const pareceTelefono = (s: string) => s.replace(/\D/g, '').length >= 8 && !/[a-z]{3}/i.test(s);

/**
 * Qué columna es qué. Si la primera fila tiene encabezados ("Nombre", "Celular"…) se usan;
 * si no, la columna que parece teléfono es el teléfono y la primera con letras, el nombre.
 */
export function detectarColumnas(filas: string[][]): { columnas: Columnas; conEncabezado: boolean } {
  const cols: Columnas = { nombre: null, apellido: null, telefono: null, notas: null };
  const enc = (filas[0] ?? []).map(norm);
  const conEncabezado = enc.some((e) => Object.values(PISTAS).some((r) => r.test(e))) && !enc.some(pareceTelefono);
  if (conEncabezado) {
    // apellido antes que nombre: "Nombre" no debe quedarse con la columna "Apellidos"; y si una columna dice
    // "Nombre completo" o "Nombre y apellido", es el nombre
    enc.forEach((e, i) => {
      if (cols.apellido === null && PISTAS.apellido.test(e) && !PISTAS.nombre.test(e)) cols.apellido = i;
    });
    for (const campo of ['nombre', 'telefono', 'notas'] as const)
      enc.forEach((e, i) => {
        if (cols[campo] === null && i !== cols.apellido && !Object.values(cols).includes(i) && PISTAS[campo].test(e)) cols[campo] = i;
      });
    return { columnas: cols, conEncabezado };
  }
  const muestra = filas.slice(0, 30);
  const ancho = Math.max(0, ...muestra.map((f) => f.length));
  const proporcion = (i: number, f: (s: string) => boolean) => muestra.filter((r) => r[i] && f(r[i])).length / Math.max(1, muestra.filter((r) => r[i]).length);
  for (let i = 0; i < ancho; i++) {
    if (cols.telefono === null && proporcion(i, pareceTelefono) > 0.6) cols.telefono = i;
    else if (cols.nombre === null && proporcion(i, (s) => /[a-záéíóúñ]{2}/i.test(s)) > 0.6) cols.nombre = i;
  }
  return { columnas: cols, conEncabezado };
}

/** "JUAN PÉREZ" o "juan pérez" → "Juan Pérez". Si ya viene con mayúsculas y minúsculas, se respeta. */
export function arreglarNombre(s: string): string {
  const t = s.replace(/\s+/g, ' ').trim();
  if (t !== t.toUpperCase() && t !== t.toLowerCase()) return t;
  const menores = new Set(['de', 'del', 'la', 'las', 'los', 'y']);
  return t
    .toLowerCase()
    .split(' ')
    .map((p, i) => (i > 0 && menores.has(p) ? p : p.charAt(0).toUpperCase() + p.slice(1)))
    .join(' ');
}

/** Solo dígitos; "+52 1 55…" o "52 55…" → los 10 de México. Lo que venga raro se deja (se marca para revisar). */
export function arreglarTelefono(s: string): string {
  let d = s.replace(/\.0+$/, '').replace(/\D/g, '');
  if (d.length === 13 && d.startsWith('521')) d = d.slice(3);
  else if (d.length === 12 && d.startsWith('52')) d = d.slice(2);
  return d;
}

export type EstadoFila = 'nuevo' | 'ya-esta' | 'repetido' | 'sin-nombre';

export interface FilaImportar {
  nombre: string;
  telefono: string;
  notas: string;
  estado: EstadoFila;
  /** teléfono que no tiene 10 dígitos: se importa igual, pero conviene revisarlo */
  telefonoRaro: boolean;
}

const clave = (nombre: string, tel: string) => `${norm(nombre)}|${tel.slice(-10)}`;

/**
 * Cada fila de datos, ya limpia y con su estado. Se salta (no se importa):
 * - "ya-esta": un alumno registrado con el mismo nombre y el mismo teléfono (o mismo nombre y sin teléfono);
 * - "repetido": la misma persona dos veces en el archivo;
 * - "sin-nombre": fila sin nombre.
 * Mismo teléfono con otro nombre sí se importa: en el baile es normal (parejas, familias).
 */
export function prepararFilas(filas: string[][], columnas: Columnas, conEncabezado: boolean, existentes: { nombre: string; telefono: string }[]): FilaImportar[] {
  const ya = new Set(existentes.map((a) => clave(a.nombre, a.telefono.replace(/\D/g, ''))));
  const nombresSinTel = new Set(existentes.map((a) => norm(a.nombre)));
  const vistos = new Set<string>();
  const celda = (f: string[], i: number | null) => (i === null ? '' : (f[i] ?? '').trim());
  return (conEncabezado ? filas.slice(1) : filas).map((f) => {
    const nombre = arreglarNombre([celda(f, columnas.nombre), celda(f, columnas.apellido)].filter(Boolean).join(' '));
    const telefono = arreglarTelefono(celda(f, columnas.telefono));
    const notas = celda(f, columnas.notas);
    const k = clave(nombre, telefono);
    const estado: EstadoFila = !nombre
      ? 'sin-nombre'
      : ya.has(k) || (!telefono && nombresSinTel.has(norm(nombre)))
        ? 'ya-esta'
        : vistos.has(k)
          ? 'repetido'
          : 'nuevo';
    if (estado === 'nuevo') vistos.add(k);
    return { nombre, telefono, notas, estado, telefonoRaro: !!telefono && telefono.length !== 10 };
  });
}
