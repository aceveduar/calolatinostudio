/** Cómo se muestran los nombres. */

/** Nombre corto para la cuadrícula: "Ana López" → "Ana L." */
export function nombreCorto(n: string): string {
  const [a, b] = n.trim().split(/\s+/);
  return b ? `${a} ${b[0]}.` : a;
}

/** Como aparece un alumno en público (página): "Ana López Pérez" → "Ana L." Nunca el nombre completo. */
export function nombrePublico(nombre: string): string {
  const [a, b] = nombre.trim().split(/\s+/);
  return b ? `${a} ${b[0].toUpperCase()}.` : a;
}


/**
 * Nombres para una cuadrícula sin repetidos: "Ana L." si es la única; si hay dos "Camila R.", se muestra el
 * apellido completo ("Camila Ríos" / "Camila Ruiz") y, si aún chocan, la inicial del segundo apellido o el
 * nombre completo. Así Monse no toca a la persona equivocada.
 */
export function nombresSinRepetir(alumnos: { id: string; nombre: string }[]): Map<string, string> {
  const partes = (n: string) => n.trim().split(/\s+/);
  const niveles = [
    (n: string) => nombreCorto(n),
    (n: string) => partes(n).slice(0, 2).join(' '),
    (n: string) => {
      const p = partes(n);
      return p[2] ? `${p[0]} ${p[1]} ${p[2][0]}.` : p.join(' ');
    },
    (n: string) => n.trim().replace(/\s+/g, ' '),
  ];
  const r = new Map<string, string>();
  let pendientes = alumnos;
  for (const [i, nivel] of niveles.entries()) {
    const cuenta = new Map<string, number>();
    for (const a of pendientes) cuenta.set(nivel(a.nombre).toLowerCase(), (cuenta.get(nivel(a.nombre).toLowerCase()) ?? 0) + 1);
    const siguen: typeof alumnos = [];
    for (const a of pendientes) {
      const t = nivel(a.nombre);
      if (cuenta.get(t.toLowerCase()) === 1 || i === niveles.length - 1) r.set(a.id, t);
      else siguen.push(a);
    }
    pendientes = siguen;
    if (!pendientes.length) break;
  }
  return r;
}

const TITULOS = new Set(['profe', 'profa', 'prof', 'prof.', 'maestro', 'maestra', 'mtro', 'mtro.', 'mtra', 'mtra.', 'miss', 'teacher', 'dirección', 'direccion', 'director', 'directora', 'recepción', 'recepcion']);

/** Para saludar: el nombre de pila ("Ana López" → "Ana"), pero sin quedarse en un título: "Profe Luis Herrera" → "Profe Luis" (antes "Hola, Profe"). */
export function nombreSaludo(n: string): string {
  const p = n.trim().split(/\s+/);
  return p.length > 1 && TITULOS.has(p[0].toLowerCase()) ? `${p[0]} ${p[1]}` : p[0];
}

/** "Contemporáneo 0" sin que el nivel quede solo en el siguiente renglón (espacio que no se parte). */
export const sinPartirNivel = (t: string) => t.replace(/ (\S{1,3})$/, '\u00a0$1');
