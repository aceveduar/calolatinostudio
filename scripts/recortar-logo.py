"""
Quita el fondo oscuro y el círculo de un logo tomado de redes sociales y deja solo el emblema.
Uso: python scripts/recortar-logo.py entrada.jpg salida.png
Pasos: relleno del fondo oscuro desde fuera del emblema -> borde suave -> conservar solo la
figura conectada al centro (descarta aro y textos sueltos) -> recorte y tamaño final.
"""
import sys
from collections import deque
from PIL import Image

entrada, salida = sys.argv[1], sys.argv[2]
img = Image.open(entrada).convert("RGB")
w, h = img.size
px = img.load()

def lum(p):
    return 0.299 * p[0] + 0.587 * p[1] + 0.114 * p[2]

OSCURO = 75  # fondo negro (con ruido de JPEG)

# 1) Fondo: pixeles oscuros conectados a una semilla fuera del emblema (dentro del aro)
fondo = bytearray(w * h)
semillas = [(int(w * 0.16), int(h * 0.5)), (int(w * 0.5), int(h * 0.12)), (int(w * 0.84), int(h * 0.5)), (int(w * 0.5), int(h * 0.88))]
cola = deque()
for x, y in semillas:
    if lum(px[x, y]) < OSCURO:
        fondo[y * w + x] = 1
        cola.append((x, y))
while cola:
    x, y = cola.popleft()
    for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
        if 0 <= nx < w and 0 <= ny < h and not fondo[ny * w + nx] and lum(px[nx, ny]) < OSCURO:
            fondo[ny * w + nx] = 1
            cola.append((nx, ny))

# 2) Figura principal: lo que NO es fondo y está conectado al centro del cuadro azul
cx, cy = int(w * 0.50), int(h * 0.36)
figura = bytearray(w * h)
cola = deque([(cx, cy)])
figura[cy * w + cx] = 1
while cola:
    x, y = cola.popleft()
    for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
        i = ny * w + nx
        if 0 <= nx < w and 0 <= ny < h and not figura[i] and not fondo[i]:
            figura[i] = 1
            cola.append((nx, ny))

# 3) Alfa con borde suave: en el contorno, la transparencia sigue la luminosidad (blanco -> opaco)
out = Image.new("RGBA", (w, h), (0, 0, 0, 0))
op = out.load()
minx, miny, maxx, maxy = w, h, 0, 0
for y in range(h):
    for x in range(w):
        if not figura[y * w + x]:
            continue
        borde = any(
            0 <= x + dx < w and 0 <= y + dy < h and fondo[(y + dy) * w + x + dx]
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1), (2, 0), (-2, 0), (0, 2), (0, -2))
        )
        p = px[x, y]
        if borde:
            a = max(0, min(255, int((lum(p) - 40) * 255 / 150)))
            op[x, y] = (255, 255, 255, a)  # el contorno del emblema es blanco
        else:
            op[x, y] = (*p, 255)
        minx, miny, maxx, maxy = min(minx, x), min(miny, y), max(maxx, x), max(maxy, y)

pad = 12
out = out.crop((max(0, minx - pad), max(0, miny - pad), min(w, maxx + pad + 1), min(h, maxy + pad + 1)))
out.thumbnail((512, 512), Image.LANCZOS)
out.save(salida, optimize=True)
print("ok", out.size, f"recorte original: {maxx - minx}x{maxy - miny}")
