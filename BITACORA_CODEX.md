# Bitácora de Codex para Claude Code

## 24 de noviembre de 2026 · Revisión inicial

Compás es una aplicación web progresiva (PWA) instalable para academias de baile. Cubre entrada y asistencia, alumnos y membresías, cobros y caja, agenda, eventos, tienda y reportes. También incluye un portal del alumno y una página pública de la academia.

### Mapa del proyecto

- `src/main.tsx` arranca la PWA. `src/App.tsx` organiza la sesión y las rutas de la aplicación interna. Las pantallas están en `src/features/`.
- React, TypeScript y Vite componen el frontend. Dexie guarda los datos en IndexedDB para operar sin conexión. `src/db/repo.ts` concentra las escrituras y encola los cambios en la misma transacción. Las reglas de negocio están en `src/domain/`.
- `src/sync/engine.ts` sincroniza con Supabase. `supabase/schema.sql` contiene el esquema y las políticas de acceso por academia. `cloudflare/` y `functions/` contienen código para la página pública, el portal y sus rutas.
- [Pendientes del proyecto](docs/PENDIENTES.md), [historial de cambios SQL](supabase/CAMBIOS.md) y [guía de pruebas](tests/README.md) complementan esta bitácora.

### Estado al recibir el proyecto

- Rama `main`, con referencia local a `origin/main` en el commit `b73a6d6`.
- Ya existía una modificación local en `src/main.tsx` que expone `compasDev.hojaQR` cuando `VITE_SEMILLA=1`. `src/dev/hojaQR.ts` estaba sin seguimiento.
- También estaban sin seguimiento `supabase/alumnos-prueba.sql`, `supabase/horarios-reales.sql`, `supabase/precios-reales.sql`, `supabase/quitar-academia-gg.sql` y `supabase/vaciar-demo.sql`. Su presencia en el repositorio local no confirma que se hayan aplicado.

### Trabajo de Codex

- Revisó la estructura, los puntos de entrada, la documentación, los commits recientes y el estado local. Creó esta bitácora como único cambio en el repositorio.
- `npm run lint` pasó. `npm test -- --configLoader runner` pasó con 121 pruebas en 25 archivos.
- `npm run build -- --configLoader runner --outDir <directorio-temporal>` compiló y generó el service worker. Se usó un directorio temporal para conservar las compilaciones existentes. La carga predeterminada de configuración de Vite y Vitest falló en este entorno porque esbuild no pudo leer un directorio superior. El cargador `runner` permitió completar ambas verificaciones sin editar la configuración.
- Las pruebas de navegador y con dispositivos reales quedan sin verificar en esta revisión. No se ejecutaron scripts SQL ni se realizaron despliegues.

Para cada ajuste posterior, añadir aquí la fecha, el pedido, los archivos y decisiones relevantes, las verificaciones realizadas y lo que quede pendiente.

## 24 de noviembre de 2026 · Regreso de alumnos y altas duplicadas

- Eduardo planteó si al regresar a Calo corresponde recuperar su ficha anterior. Se revisó el código local, sin consultar su ficha ni modificar datos de la academia.
- El archivado automático (`src/domain/archivo.ts`) es una condición de la lista para alumnos activos sin asistencia reciente ni plan vigente. Se los puede buscar y vuelven a la lista habitual al registrar su regreso. La baja manual (`src/features/alumnos/FichaAlumno.tsx`) guarda `activo: false` y conserva el historial. Se puede abrir la ficha desde **Alumnos → Ver dados de baja** y pulsar **Reactivar**.
- La búsqueda en Entrada y las sugerencias por nombre del formulario de alta excluyen a los dados de baja. El aviso por teléfono puede incluirlos, pero es informativo. `src/features/alumnos/FormAlumno.tsx` permite guardar otra ficha con un nuevo identificador y código aunque avise de una coincidencia. El flujo puede producir el duplicado descrito.
- La ficha ofrece **Más opciones → Unir registros**. La implementación en `src/domain/correcciones.ts` reasigna pagos, asistencias y membresías y retira el duplicado. Conserva el código y portal de la ficha elegida como destino. Antes de usarlo en datos reales, conviene revisar referencias adicionales de ambas fichas, como boletos y pedidos.
- Propuesta para un ajuste posterior: mostrar coincidencias de fichas activas, archivadas y dadas de baja al buscar y al registrar, con acciones para usar la ficha existente o reactivarla previa confirmación. Dejar una opción explícita para crear una ficha distinta, ya que un teléfono puede compartirse. Este turno fue de diagnóstico y solo se actualizó la bitácora.

## 24 de noviembre de 2026 · Recuperar fichas al buscar y al registrar

- **Entrada** y la búsqueda general de **Alumnos** muestran fichas dadas de baja. Al buscar en Entrada también se indica si una ficha está archivada. Las listas habituales siguen enfocadas en alumnos activos. Se comparte el cálculo de archivado existente en `src/app/datos.ts` y se consulta desde Entrada solo mientras hay una búsqueda.
- **Alumno nuevo** reúne coincidencias por nombre similar o teléfono. Muestra el estado y el código de cada ficha para distinguir a personas con nombres semejantes o teléfonos compartidos. Desde ahí se puede usar una ficha existente o confirmar su reactivación. Si corresponde registrar a otra persona, se solicita confirmación antes de crearla. Entrada conserva el registro rápido cuando la búsqueda no encuentra coincidencias.
- `ConfirmarReactivacion.tsx` se usa en Entrada, en el alta y en la ficha. `reactivarAlumno` en `src/domain/correcciones.ts` comprueba en la misma transacción que la ficha aún existe y es recuperable, y guarda el cambio de estado mediante el repositorio y su cola de sincronización. Conserva ID, QR, portal e historial. Volver a ejecutar la acción sobre una ficha ya activa no crea otra ni encola otra actualización.
- Se ampliaron las pruebas de navegador `correcciones` y `telefono` y la prueba unitaria en `tests/unidad/anonimizar.test.ts`. El trabajo se hizo en el repositorio local con datos de prueba. Queda pendiente publicar el cambio y confirmar por separado si en Calo hay dos fichas de Eduardo.
- Verificación completada: 122 pruebas unitarias, lint, compilación de producción y las suites de Edge `correcciones`, `telefono` y `rapido`. Las pruebas de navegador usaron una compilación temporal con Supabase apuntando a `prueba.invalid`.

## 24 de noviembre de 2026 · Asistencia por clase suelta

- Un plan por grupo guarda las clases que cubre. Para clase suelta, Compás usa la clase seleccionada en Entrada y guarda su ID, fecha y vínculo con el pago. Al buscar a un alumno se usa su ficha existente. **Nuevo** crea una ficha con el nombre y registra la asistencia y el cobro en la misma operación. El teléfono es opcional. **Sin nombre** y **Visitante con nombre** cuentan en caja y en la asistencia de la clase. El nombre de visitante solo identifica esa visita y no crea una ficha personal.
- La academia puede consultar el historial en **Alumnos → Ficha → Últimas clases**. El alumno puede ver hasta ocho asistencias recientes en **Mi pase → Tus últimas clases** cuando las asistencias ya están sincronizadas.
- En `PantallaEntrada.tsx`, el registro rápido muestra explícitamente que crea ficha, cuánto cobra y a qué clase corresponde. La hoja para visitantes muestra la clase y aclara para qué se usa el nombre. `HojaEntrada.tsx` muestra como línea propia la clase y hora antes de registrar la entrada. La ficha distingue **Con plan**, **Clase suelta** y **Clase por pagar** a partir de las referencias que ya existen en la asistencia.
- `nuevoYCobrar` en `src/domain/rapido.ts` comprueba la tarifa dentro de la transacción antes de crear la ficha. Corrige un caso en el que el flujo rápido podía dejar una ficha al fallar el cobro por falta de tarifa. Se agregaron pruebas para el vínculo de pago y asistencia en clase suelta y para este caso.
- Verificación: 124 pruebas unitarias, lint, compilación de producción y suite de navegador `correcciones` correctos. La suite usa una compilación temporal con nube ficticia. Los cambios están en local y quedan pendientes de publicación.

## 24 de noviembre de 2026 · Foto en la lista de asistencia

- Eduardo reportó que su foto del portal aparecía en la cuadrícula de Entrada, mientras su fila en **En clase** mostraba iniciales.
- `EnClase` en `src/features/entrada/PantallaEntrada.tsx` ya cargaba las fichas de los alumnos para obtener el nombre. Ahora también pasa su foto al mismo componente `Avatar` que usa la cuadrícula. Las fichas sin foto y las visitas sin ficha muestran iniciales. La consulta reactiva refleja cambios a la foto en la lista.
- La prueba `tests/e2e/correcciones.mjs` actualiza una foto después de cobrar y comprueba que aparezca en la fila de asistencia. Pasaron la suite en Edge, el lint, TypeScript y la compilación de prueba. El cambio está en local, pendiente de publicar.

## 24 de noviembre de 2026 · Miniaturas de apartados y encargos en Mi pase

- **Tus apartados y encargos** ahora muestra una miniatura de 44 px con la foto que usa el catálogo. Se conserva el ícono para productos sin foto publicada o si la imagen no carga. La fila conserva la talla, cantidad y estado del pedido.
- `portal_alumno` en `supabase/schema.sql` incluye la foto del producto vinculado al pedido. Reutiliza la ruta de imágenes del catálogo y sus condiciones de publicación. El contrato de TypeScript acepta la foto como opcional. En respuestas o copias antiguas el portal reutiliza la foto del catálogo si hay una sola coincidencia por nombre.
- Se actualizó la versión de esquema a `20261130` y se documentó en `supabase/CAMBIOS.md`. Pasaron 124 pruebas unitarias, lint, TypeScript, la compilación de prueba y la suite `pedidos` en Edge con una respuesta simulada de Supabase. La actualización SQL y la publicación del portal están pendientes.

## 24 de noviembre de 2026 · Archivo SQL para publicar las miniaturas

- Se preparó [`supabase/20261130-miniaturas-pedidos.sql`](supabase/20261130-miniaturas-pedidos.sql) para copiar completo a **Supabase → SQL Editor → New query → Run**. El archivo contiene las mismas dos definiciones que `schema.sql`, `portal_alumno` y `esquema_version`, dentro de una transacción.
- La actualización incremental parte de la versión `20261129` y admite volver a ejecutarse en `20261130`. Al terminar debe devolver `version_instalada = 20261130`. Si la versión es distinta, se pausa para revisar qué esquema está instalado.
- Pendiente confirmar la ejecución en Supabase antes de publicar el frontend. Los ajustes de fichas, clases sueltas y fotos de asistencia se incluyen al publicar el frontend y no requieren SQL adicional.

## 24 de noviembre de 2026 · Confirmación de Supabase y revisión de rendimiento

- Eduardo confirmó que ejecutó el archivo SQL `20261130-miniaturas-pedidos.sql` en Supabase.
- Para una academia con slug, las fotos del catálogo y de los pedidos comparten el mismo enlace versionado. La ruta de imágenes de Cloudflare usa caché de un año y el componente usa carga diferida. El tamaño de 44 px corresponde al área visible. Se reutiliza el archivo del catálogo, sin generar otra copia. Para academias sin slug, una foto incrustada puede repetirse en la respuesta del portal y aumentar su tamaño.
- Se preparó para publicar únicamente el trabajo de esta bitácora. El ajuste previo de `src/main.tsx`, la herramienta local de QR y los scripts SQL de prueba quedaron fuera del commit.
- Se subió `54b7fd1` a `origin/main` y se verificó el commit en el remoto. Al consultar el sitio público seguía sirviendo los archivos anteriores. GitHub no mostraba estados de despliegue en ese commit y Wrangler pidió autenticación para consultar Cloudflare Pages. Queda pendiente confirmar el despliegue de producción en el panel de Cloudflare. La revisión verificó el mecanismo de carga y caché, sin medición comparativa de latencia en producción.

## 24 de noviembre de 2026 · Verificación antes de la demo

- Cloudflare Pages ya sirve la compilación con los ajustes de recuperación de fichas y miniaturas. Se confirmó en los archivos JavaScript públicos. La base enlazada a esa compilación devolvió `20261130` con la función de consulta `esquema_version`.
- La página pública de Calo Latino cargó en Edge con una ventana de tamaño móvil, con HTTP 200 y sin errores de JavaScript. En el entorno aislado, con nube ficticia, volvieron a pasar las suites `correcciones`, `telefono`, `pedidos` y `rapido`. Se verificaron reactivación sin duplicados, foto de asistencia, clase suelta, caja y apartado con miniatura.
- La comprobación de producción fue de solo lectura. Queda el ensayo en el equipo de la demo con una ficha y un pedido de muestra, en particular para confirmar que la app instalada ya cargó la versión publicada. No se hicieron más cambios funcionales.

## 24 de noviembre de 2026 · Revisión de usabilidad de la tienda de Mi pase

- Hoy la cuadrícula muestra una foto pequeña, el precio, un resumen de hasta dos líneas y las opciones disponibles. Solo **Apartar** o **Encargar** abre una hoja. Esa hoja permite elegir variante y cantidad, y muestra el total al recoger, pero la foto mide 64 px y la descripción no aparece completa.
- Se propuso que tocar la foto o el nombre abra la misma hoja que el botón, con una foto más amplia, descripción completa, precio y disponibilidad o plazo estimado. Confirmar el pedido sigue siendo una acción explícita. Los artículos agotados podrían abrir su detalle en modo de consulta.
- Se recomienda reutilizar la URL de imagen del catálogo y cargar fotos adicionales solo si se abre el detalle. Mantener las tarjetas enfocadas en comparar productos y el detalle en decidir. Esta revisión solicitó consejos y no incluyó cambios funcionales.

## 24 de noviembre de 2026 · Detalle de producto en Mi pase

- Tocar la foto o el nombre del producto abre la misma hoja que **Apartar** o **Encargar**. Muestra la foto completa a 224 px, la descripción sin recortar, el precio y el estado o plazo. Usa la misma URL de la tarjeta y carga diferida.
- La hoja común permite desplazarse en pantallas pequeñas y volver a la cuadrícula al cerrarla. Las variantes, cantidad y total se eligen ahí mismo. El pedido solo se envía al confirmar. Un producto agotado o consultado sin conexión abre en modo de consulta.
- Cambios en `src/features/portal/PortalAlumno.tsx`, `src/components/ImagenProducto.tsx` y `tests/e2e/pedidos.mjs`. Pasaron 124 pruebas unitarias, lint, TypeScript, compilación y la suite `pedidos` en Edge con datos simulados. El cambio es de frontend y no requiere SQL.
- Se publicó `faf31a3` y se confirmó que Cloudflare sirve el nuevo código del detalle de producto en `PortalAlumno-D_3HJANL.js`.

## 24 de noviembre de 2026 · Revisión de la tienda pública

- En Edge móvil, se confirmó que **Gorra Calo** enlaza directamente a WhatsApp y que existe **Ver toda la tienda**. Hoy las tarjetas muestran foto, nombre, precio y si el producto es sobre pedido. La respuesta pública ya incluye descripción y variantes, pero no las muestra en la tienda. Tampoco devuelve existencias ni plazo estimado.
- Propuesta: abrir el detalle desde la tarjeta, al igual que en Mi pase. Mostrar la foto completa, descripción, precio y variantes. Dejar **Consultar por WhatsApp** como acción explícita, con el producto y la variante seleccionada en el mensaje. Mantener Mi pase para los apartados y encargos vinculados al alumno.
- Prioridad: aprovechar el catálogo y las imágenes existentes sin SQL adicional. Mostrar plazos o disponibilidad exacta solo si se incorpora información fiable a la página pública. Revisión de usabilidad sin cambios funcionales.

## 24 de noviembre de 2026 · Fichas de producto en la tienda pública

- En `src/features/publica/PaginaPublica.tsx`, cada tarjeta abre una ficha con foto ampliada sin recorte, precio, descripción completa, variantes y **Sobre pedido** cuando corresponde. Se reutilizan la hoja y el componente de imagen de Mi pase.
- **Consultar por WhatsApp** prepara un mensaje con el producto y, si se eligió, la talla o el color. La consulta es opcional y solo abre WhatsApp al tocar el enlace. Si la academia no configuró WhatsApp, la ficha sigue disponible y muestra las variantes como texto.
- El catálogo actual ya proporciona estos datos. El ajuste no requiere SQL ni añade una solicitud nueva para la ficha. Pasaron 124 pruebas unitarias, lint, compilación y la suite `web` en Edge, con casos para la foto ampliada y la consulta con y sin variante.
- Se publicó `cb8017b`. En Edge móvil abrimos **Gorra Calo** en la tienda pública y verificamos que se mostrara la foto ampliada y que el enlace incluyera el nombre de la gorra en el mensaje. No se envió ningún mensaje.

## 24 de noviembre de 2026 · Auditoría de Compás

Se revisaron los recorridos de acceso, recepción, fichas e importación, operación de maestro, caja y reportes, agenda y eventos, tienda y encargos, página pública, Mi pase, testimonios, ajustes y sincronización. Se usó una compilación con nube ficticia. La revisión remota de datos y los escenarios con varios dispositivos físicos quedan fuera de esta sesión.

| Prioridad | Hallazgo | Mejora propuesta |
|---|---|---|
| Alta | Una clase fiada se etiqueta como **Plan** en la lista **En clase** y en **Corregir entrada**. Reproducido en Edge con una asistencia sin membresía ni pago y con deuda. La ficha ya la distingue correctamente. | Mostrar **Por pagar** y ofrecer el camino hacia el cobro del adeudo. Usar el mismo criterio en toda la app. |
| Alta | Al pasar a **Todas las sedes**, Caja mostró temporalmente el total de la sede anterior. Una repetición instrumentada comprobó que luego convergió al total correcto. Después del corte se siguen aceptando movimientos y la tarjeta conserva el resultado del corte anterior. | Mostrar que los totales están cambiando y bloquear el corte mientras se recalculan. Indicar si hubo movimientos posteriores al último corte. |
| Alta con volumen | En una prueba aislada con 5,000 alumnos y 108,615 asistencias, Pendientes tardó 14.2 s, Gastos 4.2 s y Reportes 3.3 s. Entrada y búsqueda respondieron en menos de 150 ms en esa misma prueba. | Reducir lecturas y cálculos repetidos. `usePendientes` lee hasta 90 días de asistencias incluso para el contador e inicia una consulta independiente en cada consumidor. Medir de nuevo con el mismo volumen después de optimizar. |
| Media | Al marcar un encargo como **Llegó**, el enlace **Avisarle** solo aparece en un aviso temporal. En **Listos para entregar** no se ofrece volver a avisar en la hoja del encargo. | Dejar **Avisar por WhatsApp** disponible desde el encargo listo, con un mensaje que incluya artículo y saldo. |
| Media | La Agenda contempla choques entre rentas y clases. Al crear una clase, la comprobación visible se centra en rentas. | Avisar sobre otras clases activas en el mismo salón o sobre un maestro asignado a dos clases simultáneas. Validar los casos de salones diferentes y cursos en fechas distintas. |
| Media | El acceso de un equipo nuevo toma la primera membresía de una cuenta con varias academias. El sincronizador mantiene un sondeo periódico de 60 s, además de otros disparadores. | Elegir academia al vincular un equipo nuevo, y ensayar la propagación entre dos equipos antes de cambiar el mecanismo de sincronización. |
| Media | La tienda pública permite consultar y Mi pase permite encargar. La página pública carece de existencias exactas y plazo estimado en su contrato actual. | Mantener explícita la diferencia entre consulta y pedido y añadir información solo si hay una fuente fiable. |

El único cambio fuera de la bitácora fue actualizar `tests/e2e/tiendapublica.mjs` al flujo ya publicado. La prueba usaba selectores del enlace directo a WhatsApp. Ahora comprueba la ficha y el enlace en móvil y escritorio y conserva la revisión de desbordes, nombres de controles y contraste. Pasó tras el ajuste.

Pasaron los recorridos de `basico`, `telefono`, `agenda`, `maestro`, `pedidos`, `tiendapublica`, `web`, `portal3`, `costos`, `importar`, `accesopc`, `eventolugar`, `testimonios` y `ayuda`. Al esperar que Caja cargara el filtro correcto, las seis fechas, el efectivo del corte y las cifras de Reportes y Gastos coincidieron con las sumas directas. No hubo cambios en producción.

## 24 de noviembre de 2026 · Correcciones de la auditoría

- **Caja** valida que el resultado de IndexedDB pertenece a la fecha y sede seleccionadas. Mientras cambia, muestra **Actualizando totales** y deja indisponible el corte. Si hay movimientos modificados después del último corte, lo indica en la tarjeta.
- **Entrada** y **Corregir entrada** distinguen **Por pagar**, cobro registrado, plan y asistencia sin cobro. La hoja de corrección enlaza directamente al adeudo de la ficha.
- **Encargos** mantiene **Avisar por WhatsApp** en la ficha del encargo que llegó. El mensaje incluye el producto y saldo. Requiere un teléfono en la ficha y se envía manualmente.
- **Agenda y clases** avisan de empalmes por sede y salón o por maestro, considerando los días y fechas de los cursos. El aviso permite guardar horarios intencionales.
- **Acceso** permite escoger academia al conectar un equipo cuando la cuenta tiene varias. Una sola se descarga directamente. Si se cambia de academia luego de una descarga interrumpida, se limpian los datos provisionales de la anterior y sus cursores antes de iniciar la nueva.
- **Rendimiento**: se redujeron lecturas y trabajo de renderizado en Pendientes, se agruparon las asistencias de Reportes en una pasada y se separó el resumen de Gastos del cálculo de rentabilidad por clase.
- Verificación previa al push: 126 pruebas unitarias, lint, TypeScript, compilación de prueba y escenarios de Edge para corte, cuadre con 5,000 alumnos, adeudos, encargos, gastos, agenda, acceso y tienda pública. No requiere SQL. Se dejaron fuera los archivos de prueba locales que ya existían.
