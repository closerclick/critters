// Nombre procedural por semilla. Combina sílabas + un sufijo por rareza alta.
import { pick } from '../lib/rng.js';

const PRE = ['Gor', 'Zby', 'Mor', 'Kra', 'Vex', 'Lum', 'Nyx', 'Tor', 'Bru', 'Sil', 'Dra', 'Fen', 'Aqu', 'Pyr', 'Umb', 'Vol'];
const MID = ['a', 'o', 'i', 'u', 'or', 'ax', 'en', 'il', 'um', 'ys'];
const SUF = ['th', 'x', 'k', 'n', 'r', 'l', 'z', 'rn', 'gor', 'mir'];

export function makeName (rng, rarityIndex) {
  let n = pick(rng, PRE) + pick(rng, MID) + pick(rng, SUF);
  if (rng() < 0.4) n += pick(rng, MID) + pick(rng, SUF);
  n = n.charAt(0).toUpperCase() + n.slice(1).toLowerCase();
  return n;
}
