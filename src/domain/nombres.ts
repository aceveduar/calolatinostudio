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
