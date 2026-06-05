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

/** Multiplicador de daño del elemento atacante contra el defensor (rueda de N). */
export function typeMultiplier (att, def) {
  const n = ELEMENTS.length;
  const i = ELEMENTS.indexOf(att), j = ELEMENTS.indexOf(def);
  if (i < 0 || j < 0) return 1;
  const diff = ((j - i) % n + n) % n;
  if (diff === 1) return ADV;       // def es el siguiente al att → att tiene ventaja
  if (diff === n - 1) return DIS;   // def es el anterior → att en desventaja
  return 1;
}
