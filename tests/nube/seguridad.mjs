// Seguridad de la base REAL, desde fuera (como lo intentaría alguien con la clave pública de la app).
// Solo lecturas e intentos que la base debe rechazar; no cambia datos. Correr después de cada cambio a schema.sql.
//   COMPAS_DEMO_CORREO=… COMPAS_DEMO_CLAVE=… node tests/nube/seguridad.mjs
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const env = Object.fromEntries(readFileSync(path.join(RAIZ, '.env'), 'utf-8').split('\n').filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]));
const URL_ = env.VITE_SUPABASE_URL;
const K = env.VITE_SUPABASE_ANON_KEY;
const OTRA = '11111111-2222-4333-8444-555555555555';
let fallas = 0;
const revisar = (texto, bien, extra = '') => {
  if (!bien) fallas++;
  console.log(`${bien ? 'OK ' : 'MAL'} ${texto}`, extra);
};
const pedir = async (ruta, { token, ...op } = {}) => {
  const r = await fetch(`${URL_}${ruta}`, { ...op, headers: { apikey: K, 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(op.headers ?? {}) } });
  const texto = await r.text();
  return { estado: r.status, texto };
};
const negado = (r) => r.estado === 401 || r.estado === 403 || /42501|row-level security|permission denied|PGRST202/.test(r.texto); // PGRST202: no se puede ni llamar
const rpc = (f, cuerpo, token) => pedir(`/rest/v1/rpc/${f}`, { method: 'POST', body: JSON.stringify(cuerpo), token });

// sin cuenta
for (const t of ['testimonios', 'academias', 'miembros', 'usuarios', 'alumnos', 'pagos', 'asistencias', 'membresias', 'cortes', 'gastos', 'gastos_fijos', 'rentas', 'productos', 'pedidos', 'eventos', 'boletos', 'interesados', 'clases', 'planes', 'maestros', 'sedes', 'disciplinas'])
  revisar(`sin cuenta no se lee ${t}`, negado(await pedir(`/rest/v1/${t}?select=*&limit=1`)));
revisar('sin cuenta no se escribe', negado(await pedir('/rest/v1/alumnos', { method: 'POST', body: JSON.stringify({ id: '00000000-0000-4000-8000-0000000000aa', academia_id: OTRA, nombre: 'x', codigo: 'Z', created_at: 1, updated_at: 1 }) })));
for (const f of ['es_miembro', 'vincular_academia', 'img_publica', 'disponibles_producto'])
  revisar(`función interna ${f} cerrada`, negado(await rpc(f, f === 'es_miembro' ? { a: OTRA } : f === 'vincular_academia' ? { p_id: OTRA, p_nombre: 'x' } : f === 'img_publica' ? { p_base: '/', p_clave: 'x', p_dato: 'y' } : {})));
for (const [n, c] of [['token corto', 'x'], ['token falso', 'AbCdEfGhJkLmNpQrStUvWxYz99'], ['inyección', "' or '1'='1' --xxxxxxxxxxxxxx"]])
  revisar(`portal con ${n} no entrega nada`, (await rpc('portal_alumno', { p_token: c })).texto === 'null');
revisar('imagen_publica con inyección no entrega nada', (await rpc('imagen_publica', { p_slug: 'calo-latino', p_clave: "p_' or 1=1--" })).texto === 'null');
revisar('portal_pedir con token falso se rechaza', /enlace/.test((await rpc('portal_pedir', { p_token: 'AbCdEfGhJkLmNpQrStUvWxYz99', p_producto: OTRA, p_opcion: null, p_cantidad: 1 })).texto));
revisar('portal_testimonio con token falso se rechaza', /enlace/.test((await rpc('portal_testimonio', { p_token: 'AbCdEfGhJkLmNpQrStUvWxYz99', p_texto: 'Un texto de prueba suficientemente largo' })).texto));
revisar('portal_foto con token falso se rechaza', /enlace/.test((await rpc('portal_foto', { p_token: 'AbCdEfGhJkLmNpQrStUvWxYz99', p_foto: null })).texto));
revisar('registro de cuentas cerrado', /"disable_signup":true/.test((await pedir('/auth/v1/settings')).texto));

// con la cuenta de una academia: no puede tocar otra
if (process.env.COMPAS_DEMO_CORREO) {
  const login = JSON.parse((await pedir('/auth/v1/token?grant_type=password', { method: 'POST', body: JSON.stringify({ email: process.env.COMPAS_DEMO_CORREO, password: process.env.COMPAS_DEMO_CLAVE }) })).texto);
  const token = login.access_token;
  revisar('con cuenta: no ve alumnos de otra academia', (await pedir(`/rest/v1/alumnos?select=id&academia_id=eq.${OTRA}`, { token })).texto === '[]');
  revisar('con cuenta: solo ve su academia', JSON.parse((await pedir('/rest/v1/academias?select=id', { token })).texto).length === 1);
  revisar('con cuenta: no mete datos en otra academia', negado(await pedir('/rest/v1/alumnos', { method: 'POST', token, headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ id: '00000000-0000-4000-8000-0000000000bb', academia_id: OTRA, nombre: 'x', codigo: 'Y', created_at: 1, updated_at: 1 }) })));
  revisar('con cuenta: no puede borrar', negado(await pedir('/rest/v1/alumnos?id=eq.00000000-0000-4000-8000-000000000000', { method: 'DELETE', token })));
  revisar('con cuenta: no se hace miembro de otra', negado(await pedir('/rest/v1/miembros', { method: 'POST', token, body: JSON.stringify({ user_id: login.user.id, academia_id: OTRA }) })));
}
console.log(fallas ? `\n${fallas} revisión(es) fallaron` : '\nTodo cerrado.');
process.exit(fallas ? 1 : 0);
