// Fusión y DEGRADADO deterministas basados en PARTES. La rareza la dan las partes;
// el elemento se EXPRESA hasta la capacidad de esa rareza (clampElement). La SEMILLA
// genética (identidad) se conserva al degradar.
import { partsOf, genomeId, makeCritter, MAX_PARTS, clampElement, foldElement, rarityIndexFromParts, seedOfId } from '../critter/forge.js';
import { mixElements } from '../critter/types.js';
import { hash32 } from '../lib/hash.js';

// Casillas (estructura) en las que difieren dos apariencias: |patas| + tórax presente? + abdomen presente?
function cellDiff (a, b) {
  return Math.abs((a.legs || 0) - (b.legs || 0)) + ((a.thorax >= 0) !== (b.thorax >= 0) ? 1 : 0) + ((a.abdomen >= 0) !== (b.abdomen >= 0) ? 1 : 0);
}
const bigger = (cA, cB) => (partsOf(cA.appearance) >= partsOf(cB.appearance) ? cA : cB);

/** Solo se pueden fusionar arañas que difieran en 1 o 2 casillas (ni iguales, ni >2). */
export function canFuse (cA, cB) {
  if (!cA || !cB || cA.id === cB.id) return false;
  const d = cellDiff(cA.appearance, cB.appearance);
  if (d < 1 || d > 2) return false;
  if (Math.max(partsOf(cA.appearance), partsOf(cB.appearance)) >= MAX_PARTS) return false;   // ya llena → no sube
  return true;
}

// Agrega/quita UNA pieza (orden: abdomen → tórax → +pata / inverso al quitar).
function addPiece (a) { const r = { ...a }; if (r.abdomen < 0) r.abdomen = a.head % 4; else if (r.thorax < 0) r.thorax = a.head % 3; else if (r.legs < 6) r.legs = r.legs + 1; return r; }
function removePiece (a) { const r = { ...a }; if (r.legs > 0) r.legs--; else if (r.thorax >= 0) r.thorax = -1; else if (r.abdomen >= 0) r.abdomen = -1; return r; }
// Unión de estructuras (todas las piezas de ambas).
function unionApp (a, b) {
  return { ...a,
    thorax: (a.thorax >= 0) ? a.thorax : (b.thorax >= 0 ? b.thorax : -1),
    abdomen: (a.abdomen >= 0) ? a.abdomen : (b.abdomen >= 0 ? b.abdomen : -1),
    legs: Math.max(a.legs || 0, b.legs || 0),
  };
}
const fuseSeed = (cA, cB) => 's' + ((hash32(cA.id + '|' + cB.id) >>> 0).toString(36));

/** Fusiona dos arañas compatibles (difieren en 1-2 casillas) → hija con UNA parte más
 *  que la mayor (sube de rareza). Elemento = unión recortada a la capacidad. null si no
 *  son fusionables. */
export function fuse (cA, cB) {
  if (!canFuse(cA, cB)) return null;
  const big = bigger(cA, cB);
  const target = Math.min(MAX_PARTS, Math.max(partsOf(cA.appearance), partsOf(cB.appearance)) + 1);
  let app = unionApp(cA.appearance, cB.appearance);
  let guard = 0;
  while (partsOf(app) < target && partsOf(app) < MAX_PARTS && guard++ < 12) app = addPiece(app);
  const ri = rarityIndexFromParts(partsOf(app));
  const element = foldElement(mixElements(cA.element, cB.element), ri);   // si la rareza no alcanza, acumula (no descarta)
  return makeCritter(genomeId({ seed: fuseSeed(cA, cB), element, role: big.role, appearance: app }));
}

/** Degrada UNA araña un TRAMO de rareza (piso = común): quita partes hasta bajar de
 *  rareza, recorta el elemento a la nueva capacidad (DESTRUCTIVO) y CONSERVA la semilla.
 *  null si ya en común. (Consume un compañero como costo; eso lo maneja la acción.) */
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
