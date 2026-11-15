/**
 * Foto del alumno: recorte cuadrado al centro y reducida (200 px, JPEG) para que pese ~10 KB
 * y se pueda guardar y sincronizar sin problema aun con cientos de alumnos.
 */
export async function prepararFoto(archivo: File, lado = 200): Promise<string> {
  if (!archivo.type.startsWith('image/')) throw new Error('Elige una foto.');
  const bmp = await createImageBitmap(archivo);
  const corte = Math.min(bmp.width, bmp.height);
  const lienzo = document.createElement('canvas');
  lienzo.width = lienzo.height = lado;
  const g = lienzo.getContext('2d')!;
  g.drawImage(bmp, (bmp.width - corte) / 2, (bmp.height - corte) / 2, corte, corte, 0, 0, lado, lado);
  bmp.close();
  // baja la calidad si aún pesa mucho (fotos con mucho detalle)
  for (const q of [0.78, 0.65, 0.5]) {
    const url = lienzo.toDataURL('image/jpeg', q);
    if (url.length < 60_000) return url;
  }
  return lienzo.toDataURL('image/jpeg', 0.4);
}

/**
 * Foto de portada de la página pública: horizontal (recorte 16:10 al centro si viene vertical),
 * máximo 1280 px de ancho y ~200 KB, para que cargue rápido en el celular.
 */
export async function prepararPortada(archivo: File): Promise<string> {
  if (!archivo.type.startsWith('image/')) throw new Error('Elige una foto.');
  const bmp = await createImageBitmap(archivo);
  // nunca más alta que 16:10 (en el celular se ve como banda ancha)
  const alto = Math.min(bmp.height, Math.round((bmp.width * 10) / 16));
  const ancho = Math.min(1280, bmp.width);
  const lienzo = document.createElement('canvas');
  lienzo.width = ancho;
  lienzo.height = Math.round((alto * ancho) / bmp.width);
  lienzo.getContext('2d')!.drawImage(bmp, 0, (bmp.height - alto) / 2, bmp.width, alto, 0, 0, lienzo.width, lienzo.height);
  bmp.close();
  for (const q of [0.8, 0.7, 0.6, 0.5]) {
    const url = lienzo.toDataURL('image/jpeg', q);
    if (url.length < 280_000) return url;
  }
  return lienzo.toDataURL('image/jpeg', 0.4);
}
