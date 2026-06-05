// Render SVG procedural por PARTES (desde el descriptor, sin rng):
//   cabeza (obligatoria, 4 tipos) · tórax (opcional, 3 tipos) · abdomen (opcional,
//   4 tipos) · 0–6 patas que salen de la CABEZA (2 estilos) · antenas opcionales.
// Color por elemento, marco por rareza.
import { ELEMENT_INFO } from './types.js';
import { RARITY_BY_KEY } from './forge.js';

function shift (hex, deg) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, b = n & 255; const g = (n >> 8) & 255;
  const f = 1 + deg / 255;
  r = Math.max(0, Math.min(255, Math.round(r * f)));
  b = Math.max(0, Math.min(255, Math.round(b * (2 - f))));
  return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

export function critterSvg (critter, size = 96) {
  const a = critter.appearance || { head: 0, thorax: -1, abdomen: -1, legs: 4, legStyle: 1, antennae: true, hue: 0, pattern: 0 };
  const ei = ELEMENT_INFO[critter.element] || ELEMENT_INFO.fuego;
  const ri = RARITY_BY_KEY[critter.rarity] || { color: '#94a3b8' };
  const c1 = shift(ei.color, a.hue || 0), c2 = ei.color2;
  const eye = '#0b1020';
  const uid = 'c' + String(critter.id || '').replace(/[^a-zA-Z0-9]/g, '').slice(0, 8);
  const hasTh = (a.thorax ?? -1) >= 0, hasAb = (a.abdomen ?? -1) >= 0;

  // Layout vertical según qué partes existan (la cabeza siempre está).
  let headCY, headR, thCY, abCY;
  const thRX = 15, thRY = 12, abRX = 21, abRY = 20;
  if (!hasTh && !hasAb) { headR = 21; headCY = 48; }
  else if (hasTh && hasAb) { headR = 12; headCY = 18; thCY = 40; abCY = 70; }
  else if (hasTh) { headR = 14; headCY = 27; thCY = 57; }
  else { headR = 14; headCY = 29; abCY = 64; }

  // ---- patas (salen de la CABEZA; detrás del cuerpo) ----
  const oneLeg = (x, y, dir) => {
    const ex = x + dir * 18, ey = y + 14;
    if (a.legStyle === 1) { const mx = x + dir * 12, my = y - 4; return `<path d="M${x.toFixed(1)},${y.toFixed(1)} L${mx.toFixed(1)},${my.toFixed(1)} L${ex.toFixed(1)},${ey.toFixed(1)}" fill="none" stroke="${c2}" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/>`; }
    return `<path d="M${x.toFixed(1)},${y.toFixed(1)} Q${(x + dir * 10).toFixed(1)},${(y + 2).toFixed(1)} ${ex.toFixed(1)},${ey.toFixed(1)}" fill="none" stroke="${c2}" stroke-width="3.2" stroke-linecap="round"/>`;
  };
  const legTop = headCY - headR * 0.45, legBot = headCY + headR * 0.85, atX = headR - 1;
  const sideLegs = (count, dir) => {
    let s = '';
    for (let k = 0; k < count; k++) { const t = count === 1 ? 0.5 : k / (count - 1); s += oneLeg(50 + dir * atX, legTop + t * (legBot - legTop), dir); }
    return s;
  };
  const L = Math.max(0, Math.min(6, a.legs | 0));
  const legs = L > 0 ? sideLegs(Math.ceil(L / 2), -1) + sideLegs(Math.floor(L / 2), 1) : '';

  const seg = (cx, cy, rx, ry) => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="url(#${uid})" stroke="${c2}" stroke-width="2.5"/><ellipse cx="${cx}" cy="${(cy - ry * 0.42).toFixed(1)}" rx="${(rx * 0.5).toFixed(1)}" ry="${(ry * 0.3).toFixed(1)}" fill="#fff" opacity=".18"/>`;

  // ---- abdomen (opcional, 4 tipos) ----
  let abdomen = '';
  if (hasAb) {
    abdomen = seg(50, abCY, abRX, abRY);
    if (a.abdomen === 1) abdomen += `<path d="M44,${abCY + abRY - 3} L50,${abCY + abRY + 11} L56,${abCY + abRY - 3} Z" fill="${c2}"/>`;
    else if (a.abdomen === 2) for (let i = -1; i <= 1; i++) abdomen += `<path d="M${50 - abRX * 0.8},${abCY + i * 7} Q50,${abCY + i * 7 + 5} ${50 + abRX * 0.8},${abCY + i * 7}" fill="none" stroke="${c2}" stroke-width="1.8" opacity=".5"/>`;
    else if (a.abdomen === 3) for (let i = 0; i < 6; i++) { const ang = Math.PI * (0.15 + 0.7 * i / 5); const sx = 50 + Math.cos(ang) * abRX, sy = abCY + Math.sin(ang) * abRY; abdomen += `<path d="M${sx.toFixed(1)},${sy.toFixed(1)} l${(Math.cos(ang) * 6).toFixed(1)},${(Math.sin(ang) * 6).toFixed(1)}" stroke="${c2}" stroke-width="3" stroke-linecap="round"/>`; }
  }

  // ---- tórax (opcional, 3 tipos) ----
  let thorax = '';
  if (hasTh) {
    thorax = seg(50, thCY, thRX, thRY);
    if (a.thorax === 1) thorax += `<line x1="${50 - thRX * 0.7}" y1="${thCY}" x2="${50 + thRX * 0.7}" y2="${thCY}" stroke="${c2}" stroke-width="2" opacity=".6"/>`;
    else if (a.thorax === 2) for (let i = -1; i <= 1; i++) thorax += `<line x1="${50 + i * 6}" y1="${thCY - thRY * 0.7}" x2="${50 + i * 6}" y2="${thCY + thRY * 0.7}" stroke="${c2}" stroke-width="1.6" opacity=".5"/>`;
  }

  // ---- cabeza (4 tipos) + ojos + antenas ----
  const pupil = (x, y, r) => `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r}" fill="#fff"/><circle cx="${x.toFixed(1)}" cy="${(y + r * 0.15).toFixed(1)}" r="${(r * 0.5).toFixed(1)}" fill="${eye}"/>`;
  let head = '';
  if (a.head === 1) {
    head += `<path d="M${50 - headR},${headCY - headR * 0.6} L${50 + headR},${headCY - headR * 0.6} L50,${headCY + headR} Z" fill="url(#${uid})" stroke="${c2}" stroke-width="2.5" stroke-linejoin="round"/>`;
    head += `<ellipse cx="${50 - headR * 0.5}" cy="${headCY - headR * 0.15}" rx="${headR * 0.32}" ry="${headR * 0.44}" fill="#fff"/><circle cx="${50 - headR * 0.5}" cy="${headCY + headR * 0.08}" r="${headR * 0.18}" fill="${eye}"/>`;
    head += `<ellipse cx="${50 + headR * 0.5}" cy="${headCY - headR * 0.15}" rx="${headR * 0.32}" ry="${headR * 0.44}" fill="#fff"/><circle cx="${50 + headR * 0.5}" cy="${headCY + headR * 0.08}" r="${headR * 0.18}" fill="${eye}"/>`;
  } else if (a.head === 3) {
    head += `<ellipse cx="50" cy="${headCY}" rx="${headR * 1.18}" ry="${headR * 0.82}" fill="url(#${uid})" stroke="${c2}" stroke-width="2.5"/>`;
    head += pupil(50 - headR * 0.72, headCY + 1, headR * 0.26) + pupil(50, headCY - headR * 0.42, headR * 0.26) + pupil(50 + headR * 0.72, headCY + 1, headR * 0.26);
  } else {
    head += `<ellipse cx="50" cy="${headCY}" rx="${headR}" ry="${headR * 0.94}" fill="url(#${uid})" stroke="${c2}" stroke-width="2.5"/>`;
    head += pupil(50 - headR * 0.42, headCY, headR * 0.32) + pupil(50 + headR * 0.42, headCY, headR * 0.32);
    if (a.head === 2) {
      head += `<path d="M50,${headCY - headR + 2} L47,${headCY - headR - 9} L53,${headCY - headR - 9} Z" fill="${c2}"/>`;
      head += `<path d="M${50 - headR * 0.6},${headCY + headR * 0.7} q-5,4 -8,0" fill="none" stroke="${c2}" stroke-width="2.4" stroke-linecap="round"/>`;
      head += `<path d="M${50 + headR * 0.6},${headCY + headR * 0.7} q5,4 8,0" fill="none" stroke="${c2}" stroke-width="2.4" stroke-linecap="round"/>`;
    }
  }
  if (a.antennae) {
    const ty = headCY - headR * 0.7;
    head += `<path d="M${50 - 4},${ty} Q${50 - 14},${ty - 12} ${50 - 9},${ty - 18}" fill="none" stroke="${c2}" stroke-width="2.2" stroke-linecap="round"/><circle cx="${50 - 9}" cy="${ty - 18}" r="2" fill="${c1}"/>`;
    head += `<path d="M${50 + 4},${ty} Q${50 + 14},${ty - 12} ${50 + 9},${ty - 18}" fill="none" stroke="${c2}" stroke-width="2.2" stroke-linecap="round"/><circle cx="${50 + 9}" cy="${ty - 18}" r="2" fill="${c1}"/>`;
  }

  return `<svg viewBox="0 0 100 100" width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${critter.name || 'critter'}">
  <defs><linearGradient id="${uid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient></defs>
  <circle cx="50" cy="50" r="48" fill="none" stroke="${ri.color}" stroke-width="3" opacity=".85"/>
  <g stroke-linejoin="round">${legs}${abdomen}${thorax}${head}</g>
</svg>`;
}
