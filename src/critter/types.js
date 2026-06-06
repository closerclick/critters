// Tipos elementales (rueda RPS) con ventaja/desventaja. Cada elemento le gana al
// SIGUIENTE en el anillo (×1.25) y pierde contra el ANTERIOR (×0.8); el resto ×1.
// Empezamos con 3 elementos base (fuego>agua>planta>fuego) para acotar las
// combinaciones de SUBELEMENTOS de la fusión; ELEMENT_INFO mantiene los 6 por si
// se reactivan. typeMultiplier es agnóstico al tamaño del anillo.
export const ELEMENTS = ['fuego', 'agua', 'planta'];

export const ELEMENT_INFO = {
  fuego:  { es: 'Fuego',  en: 'Fire',      color: '#f97316', color2: '#7c2d12' },
  agua:   { es: 'Agua',   en: 'Water',     color: '#38bdf8', color2: '#075985' },
  planta: { es: 'Planta', en: 'Grass',     color: '#22c55e', color2: '#14532d' },
  rayo:   { es: 'Rayo',   en: 'Lightning', color: '#facc15', color2: '#854d0e' },
  hielo:  { es: 'Hielo',  en: 'Ice',       color: '#67e8f9', color2: '#0e7490' },
  sombra: { es: 'Sombra', en: 'Shadow',    color: '#a78bfa', color2: '#4c1d95' },
};

export const ADV = 1.10;   // multiplicador con ventaja de tipo (suavizado: ventaja = edge, no auto-win)
export const DIS = 0.93;   // multiplicador con desventaja

// Un SUBELEMENTO (fruto de fusionar dos elementos distintos) se escribe "a+b".
export const comps = (el) => String(el).split('+');
// Subelemento = más de UN elemento base DISTINTO (fuego+fuego NO es sub: es puro acumulado).
export const isSub = (el) => new Set(comps(el).filter(c => ELEMENTS.includes(c))).size > 1;
// El elemento es la ACUMULACIÓN de ingredientes base de los ancestros (multiset, con
// multiplicidad). Fusionar = unir TODOS los ingredientes (en profundidad se acumulan).
// El NOMBRE se resume en un catálogo finito (arquetipo por ingredientes distintos +
// GRADO por acumulación); el COMBATE usa los ingredientes base con la fórmula.
export function mixElements (a, b) {
  const cs = [...comps(a), ...comps(b)].filter(c => ELEMENTS.includes(c)).sort();
  return (cs.length ? cs : ['fuego']).join('+');
}

function baseMult (att, def) {
  const n = ELEMENTS.length;
  const i = ELEMENTS.indexOf(att), j = ELEMENTS.indexOf(def);
  if (i < 0 || j < 0) return 1;
  const diff = ((j - i) % n + n) % n;
  if (diff === 1) return ADV;       // def es el siguiente al att → att tiene ventaja
  if (diff === n - 1) return DIS;   // def es el anterior → att en desventaja
  return 1;
}
/** Multiplicador de daño att→def. Soporta SUBELEMENTOS: el subelemento toma las
 *  VENTAJAS de ambos sin sumar debilidades (atacando elige su mejor componente;
 *  defendiendo, su mejor resistencia) → max_a min_d baseMult(a,d). */
export function typeMultiplier (att, def) {
  const A = comps(att), D = comps(def);
  let best = -Infinity;
  for (const a of A) { let worst = Infinity; for (const d of D) { const m = baseMult(a, d); if (m < worst) worst = m; } if (worst > best) best = worst; }
  return best === -Infinity ? 1 : best;
}

const hx = (h) => { h = String(h).replace('#', ''); return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16) || 0); };
const rgbHex = (r, g, b) => '#' + [r, g, b].map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');

// Catálogo de 36 NOMBRES alusivos a la combinación + intensidad (acumulación):
// 3 bases × 4 · 3 subelementos × 6 · 1 triple × 6 = 36. La clave es el conjunto de
// ingredientes DISTINTOS (canónico, ordenado); el índice es cuánto se acumuló.
const ELEMENT_NAMES = {
  // bases (4 intensidades)
  fuego:  [['Brasa', 'Ember'], ['Llama', 'Flame'], ['Hoguera', 'Bonfire'], ['Infierno', 'Inferno']],
  agua:   [['Rocío', 'Dew'], ['Marea', 'Tide'], ['Torrente', 'Torrent'], ['Abismo', 'Abyss']],
  planta: [['Brote', 'Sprout'], ['Enredadera', 'Vine'], ['Selva', 'Jungle'], ['Ancestral', 'Elderwood']],
  // subelementos (6 intensidades)
  'agua+fuego':   [['Vaho', 'Haze'], ['Vapor', 'Steam'], ['Géiser', 'Geyser'], ['Tormenta', 'Storm'], ['Tifón', 'Typhoon'], ['Cataclismo', 'Cataclysm']],          // fuego + agua
  'fuego+planta': [['Rescoldo', 'Cinder'], ['Ceniza', 'Ash'], ['Incendio', 'Wildfire'], ['Pira', 'Pyre'], ['Magma', 'Magma'], ['Volcán', 'Volcano']],               // fuego + planta
  'agua+planta':  [['Musgo', 'Moss'], ['Limo', 'Silt'], ['Pantano', 'Marsh'], ['Ciénaga', 'Bog'], ['Manglar', 'Mangrove'], ['Diluvio', 'Deluge']],                  // agua + planta
  // triple (6 intensidades) — el ápice, sin "Prisma"
  'agua+fuego+planta': [['Amalgama', 'Amalgam'], ['Quimera', 'Chimera'], ['Vórtice', 'Vortex'], ['Génesis', 'Genesis'], ['Edén', 'Eden'], ['Gaia', 'Gaia']],
};

/** Etiqueta/colores de un elemento: NOMBRE del catálogo (combinación + intensidad por
 *  acumulación); color promediado por proporción de ingredientes. */
export function elementInfo (el) {
  const all = comps(el).filter(c => ELEMENT_INFO[c]);
  if (!all.length) return ELEMENT_INFO.fuego;
  const distinct = [...new Set(all)].sort();
  let r = 0, g = 0, b = 0, r2 = 0, g2 = 0, b2 = 0;
  for (const c of all) { const i = ELEMENT_INFO[c]; const [x, y, z] = hx(i.color); const [x2, y2, z2] = hx(i.color2); r += x; g += y; b += z; r2 += x2; g2 += y2; b2 += z2; }
  const color = rgbHex(r / all.length, g / all.length, b / all.length);
  const color2 = rgbHex(r2 / all.length, g2 / all.length, b2 / all.length);
  const names = ELEMENT_NAMES[distinct.join('+')];
  const intensity = all.length - distinct.length;   // 0 = forma mínima; sube al acumular ingredientes
  let label;
  if (names) label = { es: names[Math.min(intensity, names.length - 1)][0], en: names[Math.min(intensity, names.length - 1)][1] };
  else label = { es: distinct.map(d => ELEMENT_INFO[d].es).join('/'), en: distinct.map(d => ELEMENT_INFO[d].en).join('/') };
  return { es: label.es, en: label.en, color, color2, sub: distinct.length > 1, intensity, distinct };
}
