/**
 * ¿La base de datos de la nube tiene lo que esta versión de la app necesita?
 * La base dice su versión con `esquema_version()` (al final de supabase/schema.sql).
 * Al cambiar el esquema, se sube el número en los dos lugares (ver supabase/CAMBIOS.md).
 */
export const ESQUEMA_REQUERIDO = 20261125;

/** null = está al día. `version` null = la base es anterior a que existiera la versión. */
export function avisoEsquema(version: number | null, requerido = ESQUEMA_REQUERIDO): string | null {
  if (version !== null && version >= requerido) return null;
  return 'Actualiza la base de datos: corre supabase/schema.sql en Supabase (SQL Editor). Mientras, algunas funciones nuevas pueden no guardarse en la nube.';
}
