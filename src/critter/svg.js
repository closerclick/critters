// Render SVG procedural, VISTA CENITAL (desde arriba, como mirar hormigas) y
// ANGULAR (aristas rectas, sin curvas tipo burbuja). Tonos oscuros. Los ojos van
// al frente (arriba): la criatura mira al ENEMIGO, no a la pantalla.
//
// Layout en grilla 3×3 (recurso para equipar más adelante):
//   columna central = segmentos: cabeza (fila 0, oblig) · tórax (fila 1, opc) ·
//   abdomen (fila 2, opc).  columnas laterales = hasta 6 PATAS (3 por lado), una
//   por celda → cada pata es un "slot" equipable.
import { ELEMENT_INFO } from './types.js';
import { RARITY_BY_KEY } from './forge.js';

function darken (hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.round(((n >> 16) & 255) * f), g = Math.round(((n >> 8) & 255) * f), b = Math.round((n & 255) * f);
  return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}
function shift (hex, deg) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, b = n & 255; const g = (n >> 8) & 255;
  const f = 1 + deg / 255;
  r = Math.max(0, Math.min(255, Math.round(r * f)));
  b = Math.max(0, Math.min(255, Math.round(b * (2 - f))));
  return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}
const pts = (arr) => arr.map(p => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ');

export function critterSvg (critter, size = 96) {
  const a = critter.appearance || { head: 0, thorax: -1, abdomen: -1, legs: 4, legStyle: 1, antennae: true, hue: 0, pattern: 0 };
  const ei = ELEMENT_INFO[critter.element] || ELEMENT_INFO.fuego;
  const ri = RARITY_BY_KEY[critter.rarity] || { color: '#94a3b8' };
  const glow = shift(ei.color, a.hue || 0);              // acento (ojos / pies)
  const cTop = darken(glow, 0.55);                       // caparazón (oscuro)
  const cBot = darken(ei.color2, 0.85);
  const edge = darken(ei.color2, 0.5);                   // borde aún más oscuro
  const uid = 'c' + String(critter.id || '').replace(/[^a-zA-Z0-9]/g, '').slice(0, 8);
  const hasTh = (a.thorax ?? -1) >= 0, hasAb = (a.abdomen ?? -1) >= 0;

  const xC = 50, y0 = 24, y1 = 50, y2 = 76, rowY = [y0, y1, y2];
  const L0 = Math.max(0, Math.min(6, a.legs | 0));
  const legRowMax = L0 >= 5 ? 2 : L0 >= 3 ? 1 : L0 >= 1 ? 0 : -1;   // fila más baja con patas
  const segLow = hasAb ? y2 : (hasTh ? y1 : y0);
  const lowestY = Math.max(segLow, legRowMax >= 0 ? rowY[legRowMax] : 0);   // la espina llega hasta las patas

  // ---- patas en las celdas laterales (angulares, oscuras, detrás) ----
  const LEG_CELLS = [[0, -1], [0, 1], [1, -1], [1, 1], [2, -1], [2, 1]];
  const L = Math.max(0, Math.min(6, a.legs | 0));
  let legs = '';
  for (let i = 0; i < L; i++) {
    const [r, side] = LEG_CELLS[i]; const yy = rowY[r];
    const ax = xC + side * 8, kx = xC + side * 20, ky = yy - (a.legStyle === 1 ? 6 : 0), fx = xC + side * 31, fy = yy + 6;
    const d = `M${ax},${yy} L${kx},${ky.toFixed(1)} L${fx},${fy}`;
    legs += `<path d="${d}" fill="none" stroke="${edge}" stroke-width="4.4" stroke-linecap="square" stroke-linejoin="miter"/>`
      + `<path d="${d}" fill="none" stroke="${cBot}" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter"/>`
      + `<rect x="${(fx - 2.6).toFixed(1)}" y="${(fy - 2.6).toFixed(1)}" width="5.2" height="5.2" fill="${glow}" stroke="${edge}" stroke-width="1" transform="rotate(45 ${fx} ${fy})"/>`;
  }

  const spine = `<line x1="50" y1="${y0}" x2="50" y2="${lowestY}" stroke="${edge}" stroke-width="7" stroke-linecap="round"/>`;
  const plate = (p, extra = '') => `<polygon points="${pts(p)}" fill="url(#${uid})" stroke="${edge}" stroke-width="2" stroke-linejoin="miter"/>${extra}`;
  const hex = (cx, cy, w, h) => [[cx, cy - h], [cx + w, cy - h * 0.42], [cx + w, cy + h * 0.42], [cx, cy + h], [cx - w, cy + h * 0.42], [cx - w, cy - h * 0.42]];

  // ---- abdomen (opcional) ----
  let abdomen = '';
  if (hasAb) {
    if (a.abdomen === 1) abdomen = plate([[xC, y2 - 13], [xC + 13, y2 - 2], [xC, y2 + 15], [xC - 13, y2 - 2]]); // rombo (aguijón)
    else {
      abdomen = plate(hex(xC, y2, 15, 17));
      if (a.abdomen === 2) for (let i = -1; i <= 1; i++) abdomen += `<line x1="${xC - 12}" y1="${y2 + i * 7}" x2="${xC + 12}" y2="${y2 + i * 7}" stroke="${edge}" stroke-width="1.6" opacity=".7"/>`;
      else if (a.abdomen === 3) for (const s of [-1, 1]) for (const dy of [-7, 1, 9]) abdomen += `<polygon points="${pts([[xC + s * 15, y2 + dy], [xC + s * 22, y2 + dy - 3], [xC + s * 15, y2 + dy + 4]])}" fill="${cBot}" stroke="${edge}" stroke-width="1"/>`;
    }
  }

  // ---- tórax (opcional) ----
  let thorax = '';
  if (hasTh) {
    thorax = plate(hex(xC, y1, 12, 12));
    if (a.thorax === 1) thorax += `<line x1="${xC - 9}" y1="${y1}" x2="${xC + 9}" y2="${y1}" stroke="${edge}" stroke-width="2" opacity=".7"/>`;
    else if (a.thorax === 2) for (let i = -1; i <= 1; i++) thorax += `<line x1="${xC + i * 5}" y1="${y1 - 8}" x2="${xC + i * 5}" y2="${y1 + 8}" stroke="${edge}" stroke-width="1.5" opacity=".6"/>`;
  }

  // ---- cabeza (frente = arriba) ----
  let head, hw = 12, hh = 13;
  if (a.head === 1) head = plate([[xC, y0 - 15], [xC + 11, y0 + 7], [xC - 11, y0 + 7]]);          // cuña (mantis)
  else if (a.head === 3) { hw = 15; head = plate([[xC - 15, y0 + 8], [xC - 10, y0 - 11], [xC + 10, y0 - 11], [xC + 15, y0 + 8]]); } // trapecio ancho
  else if (a.head === 2) { // hex + mandíbulas al frente
    head = plate(hex(xC, y0, 12, 13));
    head += `<line x1="${xC - 5}" y1="${y0 - 11}" x2="${xC - 9}" y2="${y0 - 19}" stroke="${edge}" stroke-width="2.6" stroke-linecap="round"/>`;
    head += `<line x1="${xC + 5}" y1="${y0 - 11}" x2="${xC + 9}" y2="${y0 - 19}" stroke="${edge}" stroke-width="2.6" stroke-linecap="round"/>`;
  } else head = plate(hex(xC, y0, 12, 13));

  // ojos angulares (rombos) al FRENTE (arriba), mirando al enemigo
  const eyeY = a.head === 3 ? y0 - 7 : y0 - 8;
  const eyeD = (ex) => `<polygon points="${pts([[ex, eyeY - 2.6], [ex + 2.4, eyeY], [ex, eyeY + 2.6], [ex - 2.4, eyeY]])}" fill="${glow}"/><polygon points="${pts([[ex, eyeY - 1.1], [ex + 1, eyeY], [ex, eyeY + 1.1], [ex - 1, eyeY]])}" fill="#05040c"/>`;
  let eyes = eyeD(xC - 4.5) + eyeD(xC + 4.5);
  if (a.head === 3) eyes += eyeD(xC); // tercer ojo (cabeza ancha)

  // antenas (rectas, al frente)
  let ant = '';
  if (a.antennae) {
    ant = `<polyline points="${xC - 3},${y0 - 11} ${xC - 8},${y0 - 18} ${xC - 6},${y0 - 24}" fill="none" stroke="${edge}" stroke-width="2" stroke-linejoin="miter"/>`
      + `<polyline points="${xC + 3},${y0 - 11} ${xC + 8},${y0 - 18} ${xC + 6},${y0 - 24}" fill="none" stroke="${edge}" stroke-width="2" stroke-linejoin="miter"/>`;
  }

  // ---- encuadre: centrar y escalar el bicho dentro del círculo según su tamaño ----
  const headTop = a.antennae ? (y0 - 24) : (a.head === 1 ? (y0 - 15) : (a.head === 2 ? (y0 - 19) : (y0 - 13)));
  const segBottom = hasAb ? (y2 + 18) : (hasTh ? (y1 + 12) : (y0 + 13));
  const legBottom = legRowMax >= 0 ? (rowY[legRowMax] + 8) : 0;
  const minY = headTop, maxY = Math.max(segBottom, legBottom);
  const halfW = L0 > 0 ? 34 : 16;
  const cy = (minY + maxY) / 2;
  let s = 80 / Math.max(maxY - minY, 2 * halfW);
  s = Math.max(0.7, Math.min(1.7, s));
  const tf = `translate(50 50) scale(${s.toFixed(3)}) translate(${-xC} ${(-cy).toFixed(2)})`;

  return `<svg viewBox="0 0 100 100" width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${critter.name || 'critter'}">
  <defs><linearGradient id="${uid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${cTop}"/><stop offset="1" stop-color="${cBot}"/></linearGradient></defs>
  <circle cx="50" cy="50" r="48" fill="none" stroke="${ri.color}" stroke-width="3" opacity=".8"/>
  <g transform="${tf}">${legs}${spine}${abdomen}${thorax}${head}${ant}${eyes}</g>
</svg>`;
}
