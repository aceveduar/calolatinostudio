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
