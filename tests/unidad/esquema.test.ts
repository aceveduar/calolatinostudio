import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { ESQUEMA_REQUERIDO, avisoEsquema } from '../../src/sync/esquema';

describe('seguridad del sitio', () => {
  it('public/_headers prohíbe meter la app en otro sitio y limita de dónde carga cosas', () => {
    const h = readFileSync(new URL('../../public/_headers', import.meta.url), 'utf-8');
    expect(h).toMatch(/frame-ancestors 'none'/);
    expect(h).toMatch(/X-Frame-Options: DENY/);
    expect(h).toMatch(/script-src 'self' 'wasm-unsafe-eval';/); // sin 'unsafe-inline' ni dominios externos
    expect(h).toMatch(/object-src 'none'/);
  });
});

describe('versión de la base', () => {
  it('avisa si la base está atrasada o no tiene versión', () => {
    expect(avisoEsquema(20261118, 20261118)).toBeNull();
    expect(avisoEsquema(20261201, 20261118)).toBeNull();
    expect(avisoEsquema(20261101, 20261118)).toMatch(/schema\.sql/);
    expect(avisoEsquema(null, 20261118)).toMatch(/schema\.sql/);
  });

  it('schema.sql y la app piden la misma versión (no se olvidó subir uno de los dos)', () => {
    const sql = readFileSync(new URL('../../supabase/schema.sql', import.meta.url), 'utf-8');
    const enSql = Number(sql.match(/function esquema_version\(\)[\s\S]*?select (\d{8})/)?.[1]);
    expect(enSql).toBe(ESQUEMA_REQUERIDO);
  });
});
