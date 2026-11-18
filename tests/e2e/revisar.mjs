// Revisiones automáticas de una pantalla (las usa recorrido.mjs y recorrido-extra.mjs).
//  · ancho: algo se sale a lo ancho
//  · sinNombre: botones/enlaces sin nombre para lectores de pantalla
//  · chicos: botones de menos de 40 px (difíciles de tocar)
//  · contraste: textos que no alcanzan el contraste mínimo (WCAG AA: 4.5, o 3 en texto grande)
export function revisarPagina(page) {
  return page.evaluate(() => {
    const ancho = document.documentElement.scrollWidth > window.innerWidth + 1;
    const visible = (el) => {
      const b = el.getBoundingClientRect();
      return b.width > 1 && b.height > 1 && getComputedStyle(el).visibility !== 'hidden' && !el.closest('[aria-hidden="true"]');
    };
    const interactivos = [...document.querySelectorAll('button, a[href], [role=button], input, select, textarea')].filter(visible);
    const nombre = (el) => (el.getAttribute('aria-label') || el.getAttribute('title') || el.textContent || el.getAttribute('placeholder') || (el.labels?.[0]?.textContent ?? '') || el.querySelector('img[alt]')?.getAttribute('alt') || '').trim();
    const sinNombre = interactivos.filter((el) => !['INPUT', 'SELECT', 'TEXTAREA'].includes(el.tagName) && !nombre(el)).map((el) => el.outerHTML.slice(0, 90));
    const chicos = interactivos
      .filter((el) => ['BUTTON', 'A'].includes(el.tagName) || el.getAttribute('role') === 'button')
      .filter((el) => !el.closest('p, li > span') || el.tagName === 'BUTTON') // enlaces dentro de un párrafo: no aplica
      .filter((el) => { const b = el.getBoundingClientRect(); return Math.min(b.width, b.height) < 40; })
      .map((el) => nombre(el).slice(0, 30) || el.outerHTML.slice(0, 50));

    // contraste: colores reales (también oklch) leídos con un lienzo de 1 px
    const cv = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
    const rgba = (c) => {
      cv.clearRect(0, 0, 1, 1);
      cv.fillStyle = '#000';
      cv.fillStyle = c;
      cv.fillRect(0, 0, 1, 1);
      const d = cv.getImageData(0, 0, 1, 1).data;
      return [d[0], d[1], d[2], d[3] / 255];
    };
    const mezcla = (arriba, abajo) => [0, 1, 2].map((i) => arriba[i] * arriba[3] + abajo[i] * (1 - arriba[3])).concat(1);
    const fondo = (el) => {
      const capas = [];
      for (let n = el; n; n = n.parentElement) {
        const s = getComputedStyle(n);
        if (s.backgroundImage !== 'none') return null; // degradado o foto: no se puede medir así
        const c = rgba(s.backgroundColor);
        if (c[3] > 0) capas.push(c);
        if (c[3] >= 1) break;
        // barra fija transparente: detrás queda la página (p. ej. una foto); no se puede saber así
        if (s.position === 'fixed') return null;
      }
      let r = [255, 255, 255, 1];
      for (const c of capas.reverse()) r = mezcla(c, r);
      return r;
    };
    const lum = ([r, g, b]) => {
      const f = (v) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
    };
    const contraste = [];
    const vistos = new Set();
    for (const el of document.querySelectorAll('body *')) {
      if (!['P', 'SPAN', 'A', 'BUTTON', 'H1', 'H2', 'H3', 'LABEL', 'LI', 'DT', 'DD', 'TD', 'TH', 'B', 'STRONG', 'SMALL', 'DIV', 'SUMMARY'].includes(el.tagName)) continue;
      const texto = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent.trim()).join(' ').trim();
      if (!texto || !/[\p{L}\p{N}]/u.test(texto) || !visible(el)) continue; // signos sueltos (· —) son decorativos
      if (el.closest('[disabled], [aria-disabled="true"], .sr-only')) continue; // deshabilitado: no aplica
      let op = 1;
      for (let n = el; n; n = n.parentElement) op *= Number(getComputedStyle(n).opacity);
      if (op < 0.95) continue; // atenuado a propósito (p. ej. "ya entró")
      const bg = fondo(el);
      if (!bg) continue;
      const s = getComputedStyle(el);
      const tx = mezcla(rgba(s.color), bg);
      const L1 = lum(tx), L2 = lum(bg);
      const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
      const px = parseFloat(s.fontSize);
      const grande = px >= 24 || (px >= 18.66 && Number(s.fontWeight) >= 700);
      const minimo = grande ? 3 : 4.5;
      if (ratio < minimo) {
        const clave = `${texto.slice(0, 24)}|${s.color}`;
        if (vistos.has(clave)) continue;
        vistos.add(clave);
        contraste.push(`"${texto.slice(0, 28)}" ${ratio.toFixed(2)}:1 (mín ${minimo})`);
      }
    }
    return { ancho, sinNombre, chicos, contraste };
  });
}
