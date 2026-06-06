// FUSIÓN unificada (determinista, por PARTES). Dos arañas → una:
//  - EVOLUCIONA: cabeza+cabeza (→tórax) o un "swap" exacto (cada una aporta 1 pieza que la
//    otra no tiene; mismo nº de piezas) → la UNIÓN, con +1 pieza (sube de rareza).
//  - DEGRADA: si difieren en MÁS de una pieza → la hija pierde TODAS las partes diferentes
//    (queda la INTERSECCIÓN), bajando de rareza.
//  - null: subconjunto de 1 (no aporta) o idénticas.
// El elemento al evolucionar se ACUMULA (foldElement); al degradar se descarta lo que no
// cabe (clampElement, destructivo). La restricción de MISMO NIVEL se aplica en actions.js.
import { partsOf, genomeId, makeCritter, MAX_PARTS, clampElement, foldElement, rarityIndexFromParts } from '../critter/forge.js';
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
  if (pa === 1 && pb === 1) return 'evolve';                                    // cabeza + cabeza → +tórax (piso)
  if (pa === MAX_PARTS && pb === MAX_PARTS) return 'degrade';                   // legendaria + legendaria → -tórax (techo)
  const { onlyA, onlyB } = pieceDiff(cA.appearance, cB.appearance);
  if (onlyA === 1 && onlyB === 1) return Math.max(pa, pb) >= MAX_PARTS ? null : 'evolve';   // swap → +1
  if (onlyA > 1 || onlyB > 1) return 'degrade';                                 // >1 diferencia → intersección
  return null;                                                                  // subconjunto de 1 / idénticas
}
export const canFuse = (cA, cB) => fuseKind(cA, cB) !== null;

/** Resultado determinista de fusionar A y B (evolución o degradación). null si no aplica. */
export function fuse (cA, cB) {
  const kind = fuseKind(cA, cB);
  if (!kind) return null;
  const big = bigger(cA, cB);
  const headOnly = partsOf(cA.appearance) === 1 && partsOf(cB.appearance) === 1;
  const fullBoth = partsOf(cA.appearance) === MAX_PARTS && partsOf(cB.appearance) === MAX_PARTS;
  let app, element;
  if (kind === 'evolve') {
    app = headOnly ? { ...big.appearance, thorax: 0, abdomen: -1, legs: 0 } : unionApp(cA.appearance, cB.appearance);
    element = foldElement(mixElements(cA.element, cB.element), rarityIndexFromParts(partsOf(app)));   // acumula
  } else {
    app = fullBoth ? { ...big.appearance, thorax: -1 } : interApp(cA.appearance, cB.appearance);      // techo: -tórax; resto: intersección
    element = clampElement(mixElements(cA.element, cB.element), rarityIndexFromParts(partsOf(app)));   // destructivo
  }
  return makeCritter(genomeId({ seed: fuseSeed(cA, cB), element, role: big.role, appearance: app }));
}
