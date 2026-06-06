// Fusión y DEGRADADO deterministas basados en PARTES. La rareza la dan las partes;
// el elemento se EXPRESA hasta la capacidad de esa rareza (clampElement). Subir acumula
// sin perder (la capacidad crece con las partes); degradar recorta destructivamente.
// La SEMILLA genética (identidad) se conserva al degradar.
import { partsOf, genomeId, makeCritter, MAX_PARTS, clampElement, rarityIndexFromParts, seedOfId } from '../critter/forge.js';
import { mixElements } from '../critter/types.js';
import { hash32 } from '../lib/hash.js';

const pieces = (a) => ({ thorax: a.thorax >= 0, abdomen: a.abdomen >= 0, legs: a.legs || 0 });
// ¿`big` es `small` + exactamente UNA pieza? (subconjunto estructural + 1 parte)
function isPlusOne (small, big) {
  if (partsOf(big) !== partsOf(small) + 1) return false;
  const s = pieces(small), b = pieces(big);
  if (s.thorax && !b.thorax) return false;
  if (s.abdomen && !b.abdomen) return false;
  if (s.legs > b.legs) return false;
  return true;
}
const bigger = (cA, cB) => (partsOf(cA.appearance) >= partsOf(cB.appearance) ? cA : cB);

/** ¿La fusión A+B es COMPATIBLE (sube rareza) o incompatible (débil)? */
export function canFuse (cA, cB) {
  if (!cA || !cB || cA.id === cB.id) return false;
  const big = bigger(cA, cB), small = big === cA ? cB : cA;
  if (partsOf(big.appearance) >= MAX_PARTS) return false;   // ya llena → no sube más
  return isPlusOne(small.appearance, big.appearance);
}

// Agrega/quita UNA pieza (orden: abdomen → tórax → +pata / inverso al quitar).
function addPiece (a) { const r = { ...a }; if (r.abdomen < 0) r.abdomen = a.head % 4; else if (r.thorax < 0) r.thorax = a.head % 3; else if (r.legs < 6) r.legs = r.legs + 1; return r; }
function removePiece (a) { const r = { ...a }; if (r.legs > 0) r.legs--; else if (r.thorax >= 0) r.thorax = -1; else if (r.abdomen >= 0) r.abdomen = -1; return r; }

const fuseSeed = (cA, cB) => 's' + ((hash32(cA.id + '|' + cB.id) >>> 0).toString(36));

/** Fusiona CUALQUIER par distinto. Compatible → hija con +1 parte (sube rareza).
 *  Incompatible → no sube parte (queda como la mayor), pero acumula ingredientes → más
 *  impuesto = más débil. El elemento se recorta a la capacidad de la rareza resultante. */
export function fuse (cA, cB) {
  if (!cA || !cB || cA.id === cB.id) return null;
  const big = bigger(cA, cB);
  const appearance = canFuse(cA, cB) ? addPiece(big.appearance) : { ...big.appearance };
  const ri = rarityIndexFromParts(partsOf(appearance));
  const element = clampElement(mixElements(cA.element, cB.element), ri);   // capacidad aplicada al subir también
  return makeCritter(genomeId({ seed: fuseSeed(cA, cB), element, role: big.role, appearance }));
}

/** Degrada UNA araña un TRAMO de rareza (piso = común): quita partes hasta bajar de
 *  rareza, recorta el elemento a la nueva capacidad (DESTRUCTIVO: pierde los que no
 *  entran) y CONSERVA la semilla (sigue siendo la misma araña). null si ya en común. */
export function degrade (c) {
  if (!c || partsOf(c.appearance) <= 1) return null;
  const target = rarityIndexFromParts(partsOf(c.appearance)) - 1;
  if (target < 0) return null;
  let app = { ...c.appearance };
  while (partsOf(app) > 1 && rarityIndexFromParts(partsOf(app)) > target) app = removePiece(app);
  const ri = rarityIndexFromParts(partsOf(app));
  const element = clampElement(c.element, ri);
  return makeCritter(genomeId({ seed: seedOfId(c.id), element, role: c.role, appearance: app }));
}
