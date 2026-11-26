# Reglamentos de Calo Latino Studio

Los originales de Salsa Casino y Salsa en Línea están en `produccion/`. Las copias TXT conservan el texto de los DOCX para pegarlo en el editor. Los originales conservan el diseño y las imágenes.

## Qué dice cada modalidad y cómo encaja en Compás

| Tema | Reglamento | Estado de Compás y decisión pendiente |
| --- | --- | --- |
| Entrada a Salsa Casino | El pago se cubre al inicio de la clase, se entrega una tarjeta y se devuelve al profesor al terminar. También contempla mensualidades. | Entrada registra asistencia y cobro o acceso por plan. Calo debe confirmar si el QR sustituye la tarjeta física o si sigue siendo necesaria para el profesor. |
| Bloques de Salsa en Línea | Hay bloques de 8 clases y medios bloques de 4. Quien llega después de la primera clase paga el bloque completo. Las faltas no generan reposiciones ni reducciones. | Los paquetes de 8 y 4 se pueden configurar. Un paquete usual de Compás consume clases con las asistencias del alumno. Si el bloque es de calendario fijo y una falta consume una sesión aunque la persona no asista, hace falta modelar esa diferencia antes de usar paquetes como equivalentes. Calo debe aclarar quién puede comprar medio bloque y desde qué fecha empieza cada bloque. |
| Clase suelta | Salsa Casino contempla pago por clase. Salsa en Línea dice que se vende el bloque completo y no clases individuales. | Entrada puede cobrar clase suelta. Hay que decidir si Salsa en Línea admite clase de prueba y si hay excepciones de recepción antes de restringir el cobro por disciplina. |
| Fecha límite y recargo | Salsa en Línea habla de pago el día de clase, de no admitir pagos posteriores y de un recargo de $10 diarios por retraso. | Compás permite adeudos y su recargo configurable aplica a renovaciones mensuales, no a paquetes. Confirmar desde cuándo se cuentan los días y cuándo se admite regularizar tarde. No configurar el recargo global para imitar una regla de bloques. |
| Transferencia y tarjeta | Salsa en Línea indica efectivo o transferencia y pide enviar el comprobante con el nombre. | Compás registra efectivo, transferencia o tarjeta; registrar transferencia no adjunta ni verifica un comprobante. Confirmar si se mantiene la comprobación por WhatsApp y si la tarjeta es una opción de Calo. |
| Lugar, acceso y devoluciones | Ambos textos hablan de permanencia, suspensión temporal por adeudo, pagos no transferibles y excepción de reembolso por cancelación de la academia. | Compás mantiene los planes vinculados al alumno, permite adeudos y tiene correcciones de cobro. Confirmar si recepción decide excepciones, si se quiere un bloqueo de acceso por disciplina y cómo registrar las devoluciones. La vigencia de un plan no administra por sí sola el cupo de un grupo. |
| Imagen y convivencia | Ambos textos tratan conducta, vestimenta, grabación y uso promocional de fotografías. Salsa en Línea agrega reglas de dinámica grupal y cambios de pareja. | Son reglas de consulta. La foto de la credencial y el uso promocional de imagen deben manejarse por separado si Calo quiere registrar esa preferencia en Compás. |
| Aceptación y cambios | Ambos textos vinculan la aceptación con la inscripción y el pago y prevén avisar de cambios. | La solicitud de primera clase y la creación de un pase son flujos distintos de un cobro. La consulta no registra aceptación ni avisa de cambios. Si Calo requiere constancia, la aceptación debe guardar la versión, el momento y el alumno en el flujo que Calo confirme. |

## Cómo se consulta y edita

- Dirección usa **Más → Página pública → Reglamentos**. Agrega un documento por modalidad y guarda desde el editor de la página. Los textos se renderizan como texto plano.
- El sitio muestra **Consultar reglamentos** arriba de la solicitud de primera clase cuando la academia tiene reglamentos publicados.
- **Mi pase** enlaza a los reglamentos de la misma academia si existe página pública. Si aún no hay textos, la pantalla de consulta lo indica. Abrir el pase no inicia una consulta adicional de reglamentos.
- Se usa el contenido JSON existente de la página pública. La edición no necesita una migración SQL. La publicación de los textos reales se hace al guardarlos en la academia de Calo.
