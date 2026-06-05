// Render SVG procedural de una criatura desde sus parámetros de apariencia + color
// por elemento + marco por rareza. Sin assets ni rng (todo viene del descriptor).
import { ELEMENT_INFO } from './types.js';
import { RARITY_BY_KEY } from './forge.js';

function shift (hex, deg) {
  // pequeño corrimiento de tono vía rotación HSL aproximada (suficiente para variar).
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const f = 1 + deg / 255;
  r = Math.max(0, Math.min(255, Math.round(r * f)));
  b = Math.max(0, Math.min(255, Math.round(b * (2 - f))));
  return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

/** Devuelve un string SVG de la criatura. size = lado en px. */
export function critterSvg (critter, size = 96) {
  const a = critter.appearance || { body: 0, eyes: 2, horns: 1, spikes: false, tail: true, hue: 0, pattern: 0 };
  const ei = ELEMENT_INFO[critter.element] || ELEMENT_INFO.fuego;
  const ri = RARITY_BY_KEY[critter.rarity] || { color: '#94a3b8' };
  const c1 = shift(ei.color, a.hue), c2 = ei.color2;
  const id = 'c' + (critter.id || '').toString().replace(/[^a-zA-Z0-9]/g, '').slice(0, 8) + a.body;

  // Cuerpo: 4 formas según a.body.
  const bodies = [
    'M50,16 C74,16 84,38 84,58 C84,82 68,90 50,90 C32,90 16,82 16,58 C16,38 26,16 50,16 Z', // blob
    'M50,18 C72,18 80,40 80,60 C80,80 66,88 50,88 C34,88 20,80 20,60 C20,40 28,18 50,18 Z', // huevo
    'M30,26 C30,18 70,18 70,26 L74,74 C74,86 26,86 26,74 Z',                                  // alto
    'M18,46 C18,28 82,28 82,46 C90,64 74,86 50,86 C26,86 10,64 18,46 Z',                       // ancho
  ];
  const body = bodies[a.body % bodies.length];

  // Cuernos
  let horns = '';
  if (a.horns > 0) {
    horns += `<path d="M34,24 L28,8 L40,22 Z" fill="${c2}"/>`;
    if (a.horns > 1) horns += `<path d="M66,24 L72,8 L60,22 Z" fill="${c2}"/>`;
    if (a.horns > 2) horns += `<path d="M50,18 L50,4 L56,16 Z" fill="${c2}"/>`;
  }
  // Púas en el lomo
  let spikes = '';
  if (a.spikes) {
    for (let i = 0; i < 4; i++) { const x = 34 + i * 11; spikes += `<path d="M${x},22 L${x + 5},10 L${x + 10},22 Z" fill="${c2}" opacity=".85"/>`; }
  }
  // Cola
  const tail = a.tail ? `<path d="M82,72 C96,70 96,52 88,50 C94,60 84,64 78,66 Z" fill="${c1}" stroke="${c2}" stroke-width="2"/>` : '';

  // Ojos (1-3)
  let eyes = '';
  const ey = 52;
  if (a.eyes === 1) eyes = `<circle cx="50" cy="${ey}" r="9" fill="#fff"/><circle cx="50" cy="${ey + 1}" r="4.5" fill="#0b1220"/>`;
  else if (a.eyes === 2) eyes = `<circle cx="40" cy="${ey}" r="7" fill="#fff"/><circle cx="40" cy="${ey + 1}" r="3.5" fill="#0b1220"/><circle cx="60" cy="${ey}" r="7" fill="#fff"/><circle cx="60" cy="${ey + 1}" r="3.5" fill="#0b1220"/>`;
  else eyes = `<circle cx="36" cy="${ey}" r="5.5" fill="#fff"/><circle cx="36" cy="${ey + 1}" r="2.8" fill="#0b1220"/><circle cx="50" cy="${ey - 3}" r="5.5" fill="#fff"/><circle cx="50" cy="${ey - 2}" r="2.8" fill="#0b1220"/><circle cx="64" cy="${ey}" r="5.5" fill="#fff"/><circle cx="64" cy="${ey + 1}" r="2.8" fill="#0b1220"/>`;

  // Panza (patrón)
  const belly = a.pattern === 0
    ? `<ellipse cx="50" cy="70" rx="16" ry="13" fill="#ffffff" opacity=".18"/>`
    : a.pattern === 1
      ? `<path d="M38,66 q12,10 24,0" stroke="#ffffff" stroke-width="3" fill="none" opacity=".25"/>`
      : `<circle cx="50" cy="70" r="4" fill="#fff" opacity=".25"/><circle cx="42" cy="74" r="3" fill="#fff" opacity=".2"/><circle cx="58" cy="74" r="3" fill="#fff" opacity=".2"/>`;

  return `<svg viewBox="0 0 100 100" width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${critter.name || 'critter'}">
  <defs>
    <linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient>
  </defs>
  <circle cx="50" cy="50" r="48" fill="none" stroke="${ri.color}" stroke-width="3" opacity=".9"/>
  ${tail}${horns}${spikes}
  <path d="${body}" fill="url(#${id})" stroke="${c2}" stroke-width="2.5"/>
  ${belly}
  <g class="boca-ojos">${eyes}<path d="M42,76 q8,6 16,0" stroke="#0b1220" stroke-width="2" fill="none" opacity=".5"/></g>
</svg>`;
}
