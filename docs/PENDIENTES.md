# Pendientes de Compás

Primero se pule lo que ya existe (seguridad, UX/UI, arquitectura, escenarios). Las funciones nuevas esperan a que eso esté listo.

## Funciones nuevas (aprobadas, para después de la auditoría)

| # | Qué | Para qué | Notas |
|---|---|---|---|
| 1 | ~~Testimonios desde el portal~~ | **Hecho** (19 nov 2026): el alumno escribe en su portal; dirección, recepción o su maestro lo publica. | Esquema 20261122. |
| 2 | ~~Invitar a un amigo~~ | **Hecho** (19 nov 2026): el alumno comparte desde su portal; la página dice "Vienes de parte de Ana L." y en Interesados se ve quién lo invitó. | Esquema 20261123. |
| 3 | **Próximos eventos en el portal** | Ver los eventos y "Quiero ir" sin salir del portal. | Reusar lo de la página pública. |
| 4 | **Guardar el portal en la pantalla de inicio** | Que el pase quede a un toque. | Indicación según el celular (Android/iPhone). |
| 5 | **Errores recientes en Ajustes** | Ver los últimos errores anotados en el teléfono (`compas:errores`) y mandarlos por WhatsApp a soporte. | Pequeño. |
| 6 | **Tienda del portal en carrusel** | Que el portal no se alargue con muchos productos. | |
| 7 | **Revisión de la página como página de anuncios** (skill ads-landing) | Antes de pagar publicidad. | Cuando ya tenga datos reales. |
| 8 | ~~Cargar por partes las pantallas poco usadas~~ | Hecho en la auditoría de velocidad. | |
| 9 | **Agente de WhatsApp / chatbot para ayudar a Monse** (por evaluar) | Que responda solo lo repetitivo: horarios, precios, "¿cuándo vence mi plan?", apartar clase de prueba, y le pase a Monse lo que necesite una persona. | Evaluar antes de hacer: WhatsApp Business API (costo por conversación), qué datos puede consultar (página pública, portal), cómo se le pasa a Monse, y límites para que no prometa cosas. |

## Lo que depende de la academia

- Horarios y precios reales (hoy la página muestra los de ejemplo).
- Fotos propias para la galería (hoy son de Wikimedia con créditos).
- Testimonios reales (hoy dicen "Ejemplo:"); con la función 1 llegarán solos.
- Comprar el dominio y conectarlo a Cloudflare Pages.
- Decidir si el repositorio de GitHub queda privado.

## Por verificar en persona

- Dos teléfonos reales: un cambio en cada uno (uno sin internet) y que al reconectar queden los dos.
