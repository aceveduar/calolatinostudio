# Pendientes de Compás

Primero se pule lo que ya existe (seguridad, UX/UI, arquitectura, escenarios). Las funciones nuevas esperan a que eso esté listo.

## Funciones nuevas (aprobadas, para después de la auditoría)

| # | Qué | Para qué | Notas |
|---|---|---|---|
| 1 | ~~Testimonios desde el portal~~ | **Hecho** (19 nov 2026): el alumno escribe en su portal; dirección, recepción o su maestro lo publica. | Esquema 20261122. |
| 2 | ~~Invitar a un amigo~~ | **Hecho** (19 nov 2026): el alumno comparte desde su portal; la página dice "Vienes de parte de Ana L." y en Interesados se ve quién lo invitó. | Esquema 20261123. |
| 3 | ~~Próximos eventos en el portal~~ | **Hecho** (19 nov 2026): hasta 6 eventos de los próximos 90 días, "En 2 días", lugares que quedan y "Quiero ir" por WhatsApp con su nombre y código. | Esquema 20261124. |
| 4 | ~~Guardar el portal en la pantalla de inicio~~ | **Hecho** (19 nov 2026): tarjeta "Ten tu pase a un toque" (botón en Android, instrucciones en iPhone); se instala como "Mi pase" y abre SU portal. | Manifiesto propio en `functions/p/[token]/manifiesto.ts`. |
| 5 | ~~Errores recientes en Ajustes~~ | **Hecho** (19 nov 2026): Ajustes → Ayuda y errores, para todos los roles; anota pantallas que fallan, errores inesperados y de sincronización; reporte por WhatsApp con versión y equipo. | |
| 6 | ~~Tienda del portal en carrusel~~ | **Hecho** (19 nov 2026): una fila que se desliza. | |
| 7 | **Revisión de la página como página de anuncios** (skill ads-landing) | Antes de pagar publicidad. | Vista previa técnica hecha (19 nov 2026): velocidad en 4G lenta de 5.4 s a 2.6 s; aviso de privacidad (base editable en Ajustes → Página); se anota de dónde llega cada interesado (utm, fbclid, gclid, red social). Falta: revisar con datos y fotos reales; comprimir mejor la foto de portada al subirla (WebP); Pixel de Meta cuando decidan anunciarse. |
| 8 | ~~Cargar por partes las pantallas poco usadas~~ | Hecho en la auditoría de velocidad. | |
| 9 | **Agente de WhatsApp / chatbot para ayudar a Monse** (por evaluar con la academia) | Que responda solo lo repetitivo y le pase a Monse lo que necesite una persona. | Evaluado 19 nov 2026: primero la capa gratis (WhatsApp Business: bienvenida, ausencia, respuestas rápidas, etiquetas) y medir 3-4 semanas qué preguntan. API de Meta en México: servicio gratis hasta 1,000 mensajes/mes por número, luego ~$0.16 MXN; marketing ~$0.73 MXN. Lo personal ("mi plan") solo con el enlace a su portal: el teléfono se comparte entre familiares. |
| 10 | **Respuestas rápidas para WhatsApp Business** (si la academia lo usa) | En Ajustes → Mensajes, textos listos con los enlaces de la academia (#horarios, #precios, eventos, ubicación) para copiar a la app. | Pequeño. Esperar a saber si usan WhatsApp Business. |
| 11 | **Revisión de cada pantalla: qué sobra, qué se mueve, qué se reubica** (UX/UI) | Que nadie se abrume: cada pantalla con lo esencial a la vista y lo demás un toque más allá. Lo que ya está bien se deja. | Pedido el 19 nov 2026. Empezar por **Entrada** (donde Monse cobra: ¿hay demasiados elementos?), luego Alumnos/ficha, Caja, Agenda, Más. Hecho ya: Reportes (orden por lo accionable) y portal del alumno. |
| 13 | **Avisos al instante entre teléfonos** (aprobado el 23 nov 2026, para después) | Hoy cada teléfono revisa la nube cada 60 s (y al volver a la app): si en uno venden un plan, el otro puede cobrarle a esa persona durante ese minuto. | Supabase Realtime (canal por academia): al subir cambios, avisa "hubo cambios" y los demás bajan lo nuevo en 1-2 s; los 60 s quedan de respaldo. Sin cambios de esquema. Prueba: vender en un teléfono y escanear en otro en menos de 3 s. De paso: coordinar pestañas en PC (Web Locks) para que solo una sincronice. |
| 12 | **Auditar lo básico de armar una academia** (pedido el 19 nov 2026) | Crear un maestro, una disciplina, una clase con sus horarios, planes y precios, sedes y usuarios: que sea facilísimo de entender, con excelente usabilidad y diseño. | Siguiente tanda, después de ficha/Más/Caja/Agenda, historial anterior y abono. |


## Fase de largo plazo (pedido el 19 nov 2026: "¿qué pasa en 2, 3, 5 años?")

Estimado con ~300 alumnos activos: ~50 mil registros por año; a 5 años ~250 mil (la demo de prueba tiene 168 mil y funciona bien).

| # | Qué | Por qué | Notas |
|---|---|---|---|
| L1 | ~~Respaldos automáticos fuera de Supabase~~ | **Hecho** (19 nov 2026): `.github/workflows/respaldo.yml` cada domingo, cifrado (AES-256) con COMPAS_LLAVE, 90 días en GitHub. Falta que la academia ponga los secretos en GitHub. | Abrir: `tools/abrir-respaldo.mjs` → .json.gz → "Restaurar un respaldo". |
| L2 | ~~Archivado automático de alumnos inactivos~~ | **Hecho**: 6 meses sin venir y sin plan → "Archivado" (sale de la lista, se encuentra al buscar, vuelve solo al entrar). | Índice local [fecha+alumnoId] (v13). |
| L3 | ~~Simular 2, 3 y 5 años~~ | **Hecho** (`tools/simular-anios.mjs`): pantallas en ~1 s y cobro en 0.7 s aun a 5 años; el espacio crecía a 267 MB → L4. | |
| L4 | ~~Historial limitado en el teléfono (18 meses)~~ | **Hecho**: entradas y cobros de los últimos 18 meses en el teléfono; lo viejo se quita una vez al día solo si ya está en la nube. | Sin nube no se quita nada. |
| L5 | ~~"Cerrar sesión en todos los equipos"~~ | **Hecho**: Más → Nube y respaldo → Seguridad (solo el dueño, con confirmación). | |
| L6 | ~~Anonimizar a un alumno que lo pida~~ | **Hecho**: ficha → "Borrar sus datos personales" (solo el dueño, escribiendo BORRAR); pagos y entradas quedan como "Alumno anónimo". | |
| L7 | **Vigilar el espacio del plan de Supabase** | A 5 años debería caber en el gratis (500 MB). | Revisar cada pocos meses. |
| L8 | **Cuenta de la academia protegida** | Contraseña fuerte y verificación en dos pasos en el correo. | Tarea de la academia. |

## Lo que depende de la academia

- Horarios y precios reales (hoy la página muestra los de ejemplo).
- Fotos propias para la galería (hoy son de Wikimedia con créditos).
- Testimonios reales (hoy dicen "Ejemplo:"); con la función 1 llegarán solos.
- Comprar el dominio y conectarlo a Cloudflare Pages.
- Decidir si el repositorio de GitHub queda privado.
- **Al arrancar en serio, quitar los datos de prueba** (pedido el 23 nov 2026): vaciar la demo de Calo Latino en la nube y borrar los generadores de academias inventadas: `src/dev/semilla.ts` (demo de Calo), `src/dev/grande.ts` (5,000 alumnos), `src/dev/hojaQR.ts` (hoja de QR) y el bloque `VITE_SEMILLA` de `src/main.tsx`. Ojo: las pruebas automáticas (`tests/e2e`) los usan; antes de borrarlos, decidir si se mueven a una carpeta solo de pruebas para no perder las pruebas de velocidad.

## Por verificar en persona

- Que la app instalada se actualice sola (desde 19 nov 2026 busca versión nueva al volver a la pantalla y cada 30 min).
- Instalar "Mi pase" en un Android y un iPhone reales.

- Dos teléfonos reales: un cambio en cada uno (uno sin internet) y que al reconectar queden los dos.
