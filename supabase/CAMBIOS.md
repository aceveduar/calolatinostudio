# Cambios a la base de datos

`schema.sql` se puede correr completo las veces que sea: crea lo que falta y no borra nada. Para actualizar una base, se pega el archivo completo en Supabase → SQL Editor → Run.

Cada cambio sube el número de `esquema_version()` (al final de `schema.sql`) y el de `ESQUEMA_REQUERIDO` en `src/sync/esquema.ts`. Si la app encuentra una base atrasada, avisa en pantalla "Actualiza la base de datos" en lugar de fallar sin decir nada.

## Para cambiar la base

1. Edita `schema.sql`. Usa siempre formas que se puedan repetir: `add column if not exists`, `create or replace function`, `drop constraint if exists` antes de `add constraint`.
2. Si la app manda una columna nueva, agrégala a `OMITIBLES` en `src/sync/engine.ts`, para que un teléfono con la app nueva siga subiendo lo demás mientras se corre el SQL.
3. Sube el número en los dos lugares y anota aquí abajo qué cambió.
4. Corre el SQL en Supabase **antes** de hacer push de la app.

## Bitácora

| Versión | Qué cambió |
|---|---|
| 20261130 | `portal_alumno` devuelve la foto de cada producto publicado en **Tus apartados y encargos**, usando el mismo enlace de la tienda. La foto es opcional y el portal conserva la compatibilidad con respuestas previas. |
| 20261129 | Flyer o foto de cada evento: `eventos.foto`. `pagina_publica` y `portal_alumno` la mandan como enlace `/img/<slug>/e_<id>.<huella>` (en el portal, incrustada si la academia no tiene página) e `imagen_publica` la sirve. **Correr ANTES del push** (sin la columna, la app guarda el evento pero sin el flyer). |
| 20261128 | Eventos con más detalle: `eventos.vestimenta` (cómo venir: disfraz, de blanco…), `eventos.lugar` y `eventos.direccion` (cuando es en otro lugar). `pagina_publica` y `portal_alumno` mandan además `lugar` y `direccion` ya resueltos (los de la sede si no es en otro lugar) y `otro_lugar`. **Correr ANTES del push** (sin las columnas, la app guarda el evento pero sin esos datos). |
| 20261127 | Corte de caja con fondo y salidas: `cortes.fondo` (feria con que abrió), `cortes.salidas` (efectivo que salió del cajón) y `gastos.de_caja` (el gasto se pagó con dinero de la caja). **Correr ANTES del push** (sin las columnas, la app guarda el corte pero sin el fondo ni las salidas). |
| 20261126 | Origen de cada interesado: `interesados.origen` ("facebook · navidad", "instagram", "google · anuncio"…) e `inscribir_interesado` acepta `p_origen` (opcional). **Correr ANTES del push** (la página nueva manda `p_origen`). |
| 20261125 | Eventos: `en_pagina` y `en_portal` (vacío = sí) para decidir dónde se anuncia cada evento; `pagina_publica` y `portal_alumno` los respetan. **Correr ANTES del push** (sin las columnas, la app guarda el evento pero no puede ocultarlo). |
| 20261124 | Eventos en el portal: `portal_alumno` devuelve los próximos eventos (hasta 6, en los siguientes 90 días) con lugares disponibles. Se puede correr antes o después del push (sin él, el portal simplemente no muestra eventos). |
| 20261123 | Invitar a un amigo: `interesados.invito_alumno_id`; `inscribir_interesado` acepta `p_de` (huella de quien invita, opcional); `invitado_por(slug, de)` da "Ana L."; `portal_alumno` devuelve su huella y cuántos invitó. **Correr ANTES del push** (la página nueva manda `p_de`). |
| 20261122 | Testimonios: tabla `testimonios` (con sus reglas de acceso, sin borrar), función `portal_testimonio` para que el alumno escriba el suyo desde su portal (queda pendiente), y `portal_alumno` devuelve su último testimonio. Se puede correr antes o después del push. |
| 20261121 | Velocidad: las reglas de acceso (RLS) calculan las academias del usuario una vez por consulta en lugar de fila por fila, e índices para portal, tienda, eventos e inscripciones. Se puede correr antes o después del push. |
| 20261120 | `portal_alumno` manda el logo y las fotos de la tienda como enlaces `/img/…` cuando la academia tiene página pública (la foto del alumno sigue incrustada), y además su horario, sus logros (total de clases y semanas en que vino) y el WhatsApp y slug de la academia. También **después del push**. |
| 20261119 | `pagina_publica` manda las fotos como enlaces `/img/<slug>/<clave>.<huella>` (antes, ~1 MB de fotos en cada visita). Nueva `imagen_publica(slug, clave)` que usa Cloudflare para servirlas. **Correr después del push**: la versión anterior de la página no sabe leer esos enlaces. |
| 20261118 | Se agrega `esquema_version()`, para que la app sepa si la base está al día. |
| (antes) | Historial en git: `git log -- supabase/schema.sql`. Lo último: alumnos.avisos, gastos.maestro_id, gastos_fijos.maestro_id, academias.pagina, clases.curso, y `pagina_publica` con curso y disciplina por clase (15 nov 2026). |
