// FUSIÓN unificada (determinista, por PARTES). Es por RAREZA (= nº de piezas, las 9), NO
// por nivel. Dos arañas de la MISMA rareza → una:
//  - EVOLUCIONA (≤1 pieza de diferencia): idénticas → +la siguiente pieza; "swap" (cada una
//    aporta 1) → la UNIÓN. En ambos casos +1 pieza (sube de rareza). cabeza+cabeza → +tórax.
//  - DEGRADA (≥2 piezas de diferencia, o legendaria+legendaria): pierde TODAS las partes
//    diferentes → la INTERSECCIÓN; el techo (9+9) pierde el tórax. Baja de rareza.
// Rarezas distintas → no fusiona. Elemento: al evolucionar ACUMULA (foldElement); al degradar
// descarta lo que no cabe (clampElement, destructivo).
import { partsOf, genomeId, makeCritter, MAX_PARTS, clampElement, foldElement, rarityIndexFromParts, seedOfId } from '../critter/forge.js';
import { mixElements } from '../critter/types.js';
import { hash32 } from '../lib/hash.js';

// Piezas que cada apariencia tiene y la otra NO (patas anidadas + tórax + abdomen).
function pieceDiff (a, b) {
  const onlyA = Math.max(0, (a.legs || 0) - (b.legs || 0)) + (a.thorax >= 0 && b.thorax < 0 ? 1 : 0) + (a.abdomen >= 0 && b.abdomen < 0 ? 1 : 0);
  const onlyB = Math.max(0, (b.legs || 0) - (a.legs || 0)) + (b.thorax >= 0 && a.thorax < 0 ? 1 : 0) + (b.abdomen >= 0 && a.abdomen < 0 ? 1 : 0);
  return { onlyA, onlyB };
}
const bigger = (cA, cB) => (partsOf(cA.appearance) >= partsOf(cB.appearance) ? cA : cB);
// Unión (todas las piezas de ambas) e intersección (solo las comunes).
function unionApp (a, b) { return { ...a, thorax: a.thorax >= 0 ? a.thorax : (b.thorax >= 0 ? b.thorax : -1), abdomen: a.abdomen >= 0 ? a.abdomen : (b.abdomen >= 0 ? b.abdomen : -1), legs: Math.max(a.legs || 0, b.legs || 0) }; }
function interApp (a, b) { return { ...a, thorax: (a.thorax >= 0 && b.thorax >= 0) ? a.thorax : -1, abdomen: (a.abdomen >= 0 && b.abdomen >= 0) ? a.abdomen : -1, legs: Math.min(a.legs || 0, b.legs || 0) }; }
const fuseSeed = (cA, cB) => 's' + ((hash32(cA.id + '|' + cB.id) >>> 0).toString(36));

/** 'evolve' | 'degrade' | null (ver cabecera). NO mira el nivel (eso lo valida la acción). */
export function fuseKind (cA, cB) {
  if (!cA || !cB || cA.id === cB.id) return null;
  const pa = partsOf(cA.appearance), pb = partsOf(cB.appearance);
  if (pa !== pb) return null;                                   // misma RAREZA (nº de piezas, las 9)
  const { onlyA } = pieceDiff(cA.appearance, cB.appearance);    // onlyA === onlyB cuando pa === pb
  if (onlyA === 0) return pa === 1 ? 'evolve' : (pa >= MAX_PARTS ? 'degrade' : 'merge');   // idénticas: piso cabeza→+tórax, techo→-tórax, medio→REFORZAR
  if (onlyA === 1) return 'evolve';                             // swap → unión (+1 pieza)
  return 'degrade';                                             // ≥2 diferencias → intersección
}
export const canFuse = (cA, cB) => fuseKind(cA, cB) !== null;

/** Resultado determinista de fusionar A y B (evolucionar / reforzar / devolucionar). */
export function fuse (cA, cB) {
  const kind = fuseKind(cA, cB);
  if (!kind) return null;
  const big = bigger(cA, cB);
  const { onlyA } = pieceDiff(cA.appearance, cB.appearance);
  let app, element, seed;
  if (kind === 'merge') {                                                                         // idénticas → MISMA araña + ingredientes (+ XP en la acción)
    app = { ...big.appearance };
    element = foldElement(mixElements(cA.element, cB.element), rarityIndexFromParts(partsOf(app)));
    seed = seedOfId(big.id);
  } else if (kind === 'evolve') {
    app = (onlyA === 0) ? { ...big.appearance, thorax: 0 } : unionApp(cA.appearance, cB.appearance);   // cabeza+cabeza → +tórax; swap → unión
    element = foldElement(mixElements(cA.element, cB.element), rarityIndexFromParts(partsOf(app)));
    seed = fuseSeed(cA, cB);
  } else {
    app = (onlyA === 0) ? { ...big.appearance, thorax: -1 } : interApp(cA.appearance, cB.appearance);  // leyenda+leyenda → -tórax; resto → intersección
    element = clampElement(mixElements(cA.element, cB.element), rarityIndexFromParts(partsOf(app)));
    seed = fuseSeed(cA, cB);
  }
  return makeCritter(genomeId({ seed, element, role: big.role, appearance: app }));
}
