# Pruebas

Dos tipos de prueba, para dos tipos de error.

| Comando | Qué revisa | Tiempo |
|---|---|---|
| `npm test` | Las reglas del negocio: cobros, caja, planes, cursos, pendientes, lo que deja cada clase, y que todo cambio quede guardado y en la cola para subir. | ~1 s |
| `npm run test:e2e` | La app de verdad en el navegador: cada pantalla, como la usan Monse y dirección. | ~10 min |
| `npm run test:e2e -- web tienda` | Solo esas pruebas de pantalla. Agrega `--sin-build` para no recompilar. | |

Corre `npm test` después de cada cambio y `npm run test:e2e` antes de cada push.

## Reglas

- **Ninguna prueba toca la nube real.** `test:e2e` compila la app apuntando a `https://prueba.invalid`, así que aunque una prueba olvide bloquear la red, no puede escribir en la academia demo ni en la de nadie. No metas aquí correos ni contraseñas de cuentas reales.
- Las pruebas de pantalla usan Microsoft Edge (`playwright-core`, `channel: 'msedge'`) y el puerto 4173, que debe estar libre.
- Cada prueba imprime una línea por punto revisado con `OK` o `MAL`. El corredor falla si hay algún `MAL`, si la página lanza errores o si la prueba truena.
- Las capturas de pantalla quedan en `tests/e2e/salida/` (no se sube a git).
- Las imágenes y videos de prueba (cámara falsa, fotos) están en `tests/e2e/archivos/`.

## Agregar una prueba

- **Regla de negocio:** un `*.test.ts` en `tests/unidad/`; usa `fabricas.ts` para crear registros con lo mínimo.
- **Pantalla:** un `*.mjs` en `tests/e2e/`, copiando el arranque de otra (`web.mjs` es un buen ejemplo). El corredor la encuentra solo.
