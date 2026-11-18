# Pendientes de Compás

Primero se pule lo que ya existe (seguridad, UX/UI, arquitectura, escenarios). Las funciones nuevas esperan a que eso esté listo.

## Funciones nuevas (aprobadas, para después de la auditoría)

| # | Qué | Para qué | Notas |
|---|---|---|---|
| 1 | **Testimonios desde el portal** | El alumno escribe su testimonio en su portal; Monse, dirección o el maestro lo aprueba y entonces aparece en la página pública. | Nada se publica sin aprobación. Requiere tabla o columna nueva y una pantalla para aprobar. Reemplaza los testimonios "Ejemplo:". |
| 2 | **Invitar a un amigo** | Botón en el portal que comparte la página "de parte de Ana"; el registro llega a Interesados con quién lo invitó. | Requiere SQL (interesados.invito_alumno_id o similar). |
| 3 | **Próximos eventos en el portal** | Ver los eventos y "Quiero ir" sin salir del portal. | Reusar lo de la página pública. |
| 4 | **Guardar el portal en la pantalla de inicio** | Que el pase quede a un toque. | Indicación según el celular (Android/iPhone). |
| 5 | **Errores recientes en Ajustes** | Ver los últimos errores anotados en el teléfono (`compas:errores`) y mandarlos por WhatsApp a soporte. | Pequeño. |
| 6 | **Tienda del portal en carrusel** | Que el portal no se alargue con muchos productos. | |
| 7 | **Revisión de la página como página de anuncios** (skill ads-landing) | Antes de pagar publicidad. | Cuando ya tenga datos reales. |
| 8 | **Cargar por partes las pantallas poco usadas** | Que la app abra más rápido la primera vez. | Prioridad baja: queda instalada. |

## Lo que depende de la academia

- Horarios y precios reales (hoy la página muestra los de ejemplo).
- Fotos propias para la galería (hoy son de Wikimedia con créditos).
- Testimonios reales (hoy dicen "Ejemplo:"); con la función 1 llegarán solos.
- Comprar el dominio y conectarlo a Cloudflare Pages.
- Decidir si el repositorio de GitHub queda privado.

## Por verificar en persona

- Dos teléfonos reales: un cambio en cada uno (uno sin internet) y que al reconectar queden los dos.
