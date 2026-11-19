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
| 7 | **Revisión de la página como página de anuncios** (skill ads-landing) | Antes de pagar publicidad. | Cuando ya tenga datos reales. |
| 8 | ~~Cargar por partes las pantallas poco usadas~~ | Hecho en la auditoría de velocidad. | |
| 9 | **Agente de WhatsApp / chatbot para ayudar a Monse** (por evaluar con la academia) | Que responda solo lo repetitivo y le pase a Monse lo que necesite una persona. | Evaluado 19 nov 2026: primero la capa gratis (WhatsApp Business: bienvenida, ausencia, respuestas rápidas, etiquetas) y medir 3-4 semanas qué preguntan. API de Meta en México: servicio gratis hasta 1,000 mensajes/mes por número, luego ~$0.16 MXN; marketing ~$0.73 MXN. Lo personal ("mi plan") solo con el enlace a su portal: el teléfono se comparte entre familiares. |
| 10 | **Respuestas rápidas para WhatsApp Business** (si la academia lo usa) | En Ajustes → Mensajes, textos listos con los enlaces de la academia (#horarios, #precios, eventos, ubicación) para copiar a la app. | Pequeño. Esperar a saber si usan WhatsApp Business. |

## Lo que depende de la academia

- Horarios y precios reales (hoy la página muestra los de ejemplo).
- Fotos propias para la galería (hoy son de Wikimedia con créditos).
- Testimonios reales (hoy dicen "Ejemplo:"); con la función 1 llegarán solos.
- Comprar el dominio y conectarlo a Cloudflare Pages.
- Decidir si el repositorio de GitHub queda privado.

## Por verificar en persona

- Que la app instalada se actualice sola (desde 19 nov 2026 busca versión nueva al volver a la pantalla y cada 30 min).
- Instalar "Mi pase" en un Android y un iPhone reales.

- Dos teléfonos reales: un cambio en cada uno (uno sin internet) y que al reconectar queden los dos.
