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

export const ADV = 1.25;   // multiplicador con ventaja de tipo
export const DIS = 0.8;    // multiplicador con desventaja

// Un SUBELEMENTO (fruto de fusionar dos elementos distintos) se escribe "a+b".
export const comps = (el) => String(el).split('+');
export const isSub = (el) => String(el).includes('+');
/** Mezcla de elementos (fusión): mismo → igual; distintos → subelemento canónico "a+b" (máx 2). */
export function mixElements (a, b) {
  if (a === b) return a;
  const cs = [...new Set([...comps(a), ...comps(b)])].sort();
  return cs.slice(0, 2).join('+');
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
const mixHex = (a, b) => { const x = hx(a), y = hx(b); return '#' + [0, 1, 2].map(i => Math.round((x[i] + y[i]) / 2).toString(16).padStart(2, '0')).join(''); };
/** Info visual/label de un elemento o subelemento (mezcla colores y etiquetas). */
export function elementInfo (el) {
  const cs = comps(el);
  if (cs.length === 1) return ELEMENT_INFO[el] || ELEMENT_INFO.fuego;
  const a = ELEMENT_INFO[cs[0]] || ELEMENT_INFO.fuego, b = ELEMENT_INFO[cs[1]] || ELEMENT_INFO.agua;
  return { es: a.es + '/' + b.es, en: a.en + '/' + b.en, color: mixHex(a.color, b.color), color2: mixHex(a.color2, b.color2), sub: true };
}
