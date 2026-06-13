# Seleccion de CELDAS de pata, portada 1:1 del SVG 2D (src/critter/svg.js + lib/rng.js):
# el conteo dice CUANTAS patas; la SEMILLA elige QUE celdas (shuffle Fisher-Yates), asi una
# criatura con 1 pata no la pone siempre arriba-izquierda. Mismo rng (hash32 FNV-1a +
# mulberry32) y misma semilla ('legcells:' + seedOfId) -> el 3D coincide con el icono SVG.
LEG_CELLS = [(0, -1), (0, 1), (1, -1), (1, 1), (2, -1), (2, 1)]   # (fila, lado)


def _imul(x, y):
    return ((x & 0xffffffff) * (y & 0xffffffff)) & 0xffffffff


def _hash32(s):
    h = 0x811c9dc5
    for ch in str(s):
        h = (h ^ ord(ch)) & 0xffffffff
        h = (h * 0x01000193) & 0xffffffff
    return h


class _RNG:   # mulberry32(hash32(seed))
    def __init__(self, seed_str):
        self.a = _hash32(seed_str)

    def next(self):
        self.a = (self.a + 0x6D2B79F5) & 0xffffffff
        a = self.a
        t1 = _imul(a ^ (a >> 15), 1 | a)
        t = (t1 + _imul(t1 ^ (t1 >> 7), 61 | t1)) & 0xffffffff
        t = t ^ t1
        return ((t ^ (t >> 14)) & 0xffffffff) / 4294967296.0


def seed_of_id(idstr):
    s = idstr or ""
    return s.split(":")[1] if isinstance(s, str) and s.startswith("g:") and ":" in s[2:] else s


def leg_cells(idstr, n):
    """Devuelve [(fila, lado), ...] (n celdas) elegidas por la semilla, igual que el SVG."""
    n = max(0, min(6, int(n)))
    rng = _RNG("legcells:" + seed_of_id(idstr))
    order = [0, 1, 2, 3, 4, 5]
    for k in range(5, 0, -1):
        m = int(rng.next() * (k + 1))
        order[k], order[m] = order[m], order[k]
    return [LEG_CELLS[c] for c in sorted(order[:n])]
