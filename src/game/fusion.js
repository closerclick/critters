// Fusión y DEGRADADO deterministas basados en PARTES. La rareza la dan las partes;
// el elemento se EXPRESA hasta la capacidad de esa rareza (clampElement). La SEMILLA
// genética (identidad) se conserva al degradar.
import { partsOf, genomeId, makeCritter, MAX_PARTS, clampElement, foldElement, rarityIndexFromParts, seedOfId } from '../critter/forge.js';
import { mixElements } from '../critter/types.js';
import { hash32 } from '../lib/hash.js';

// Piezas que cada apariencia tiene y la otra NO (estructura: patas anidadas + tórax + abdomen).
function pieceDiff (a, b) {
  const onlyA = Math.max(0, (a.legs || 0) - (b.legs || 0)) + (a.thorax >= 0 && b.thorax < 0 ? 1 : 0) + (a.abdomen >= 0 && b.abdomen < 0 ? 1 : 0);
  const onlyB = Math.max(0, (b.legs || 0) - (a.legs || 0)) + (b.thorax >= 0 && a.thorax < 0 ? 1 : 0) + (b.abdomen >= 0 && a.abdomen < 0 ? 1 : 0);
  return { onlyA, onlyB };
}
const bigger = (cA, cB) => (partsOf(cA.appearance) >= partsOf(cB.appearance) ? cA : cB);

/** Para EVOLUCIONAR, cada araña debe aportar EXACTAMENTE una pieza que la otra no tiene
 *  (un "swap"): así la unión suma una pieza sobre ambas. Un subconjunto (cabeza ⊂
 *  cabeza+brazo) NO aporta nada nuevo → NO es fusionable. Tampoco iguales ni saltos >1. */
export function canFuse (cA, cB) {
  if (!cA || !cB || cA.id === cB.id) return false;
  const pa = partsOf(cA.appearance), pb = partsOf(cB.appearance);
  if (Math.max(pa, pb) >= MAX_PARTS) return false;            // ya llena
  if (pa === 1 && pb === 1) return true;                      // CABEZA + CABEZA → tórax (única opción de la cabeza-sola)
  const { onlyA, onlyB } = pieceDiff(cA.appearance, cB.appearance);
  return onlyA === 1 && onlyB === 1;
}

// Quita UNA pieza (orden inverso: pata → tórax → abdomen) — para el degradado.
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

/** EVOLUCIÓN: dos arañas del MISMO nº de piezas que difieren en un "swap" (cada una
 *  aporta 1 pieza que la otra no tiene) → hija = la UNIÓN, que tiene UNA pieza más que
 *  cada padre (sube de rareza). Elemento = mezcla acumulada a la capacidad. null si no
 *  son fusionables. */
export function fuse (cA, cB) {
  if (!canFuse(cA, cB)) return null;
  const big = bigger(cA, cB);
  const headOnly = partsOf(cA.appearance) === 1 && partsOf(cB.appearance) === 1;
  const app = headOnly
    ? { ...big.appearance, thorax: 0, abdomen: -1, legs: 0 }   // cabeza + cabeza → SIEMPRE tórax
    : unionApp(cA.appearance, cB.appearance);                  // swap → +1 pieza sobre cada padre
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
