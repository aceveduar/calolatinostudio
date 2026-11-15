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
