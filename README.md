# Compás

Cobros y asistencia para academias de baile. PWA local-first: se instala en Android y iPhone desde el navegador, funciona sin internet y sincroniza con la nube cuando hay señal.

## Correr en local

```bash
npm install
npm run dev        # desarrollo
npm run build && npm run preview   # versión de producción (prueba offline/instalación)
```

Sin archivo `.env` la app funciona 100 % en el teléfono (modo solo-local).

## Arquitectura

```
src/
  db/          IndexedDB (Dexie): tipos, esquema y repo.ts (única puerta de escritura → outbox)
  domain/      Reglas de negocio puras: membresías, operaciones de cobro, caja, fechas, dinero
  sync/        Motor de sincronización (push outbox → pull incremental) y cliente Supabase
  app/         Sesión/PIN, layout, hooks de datos reactivos
  components/  Sistema de diseño (ui.tsx), avisos, teclado PIN, logo
  features/    Pantallas: entrada, alumnos, caja, ajustes, acceso
supabase/schema.sql   Tablas, RLS multi-academia, triggers y RPC de alta
```

Principios:
- **Local-first**: la UI siempre lee/escribe IndexedDB; nunca espera a la red.
- **Outbox**: cada escritura se guarda con su entrada en el outbox en la misma transacción.
- **UUID en el cliente**: sin colisiones entre teléfonos offline.
- **Cobros inmutables**: no se editan; se anulan con motivo y usuario (auditoría).
- **Multi-tenant**: todo lleva `academia_id`; RLS en Postgres aísla a cada academia.
- **Montos en centavos**, fechas de negocio `YYYY-MM-DD` en hora local.

## Activar la nube (Supabase)

1. Crear proyecto en supabase.com (plan gratis alcanza para varias academias).
2. SQL Editor → pegar y ejecutar `supabase/schema.sql`.
3. Authentication → Providers → Email: desactivar "Confirm email" (o el dueño deberá confirmar su correo).
4. Copiar `.env.example` a `.env` con la URL y la anon key (Project Settings → API).
5. En la app: Ajustes → Nube y respaldo → Crear cuenta. Otros teléfonos: "Ya la uso en otro teléfono".

## Publicar (Netlify)

`npm run build` → publicar `dist/`. `public/_redirects` ya maneja las rutas. Variables `VITE_SUPABASE_*` en el panel de Netlify.

## Instalar en el teléfono

- **Android (Chrome)**: abrir el link → menú ⋮ → "Instalar app".
- **iPhone (Safari)**: abrir el link → Compartir → "Agregar a pantalla de inicio". Es importante instalarla así para que iOS no borre los datos locales.

## Íconos

`node scripts/generar-iconos.mjs` regenera los PNG de `public/`.
