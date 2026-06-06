// Fusión DETERMINISTA basada en PARTES. Dos criaturas se fusionan si difieren en
// EXACTAMENTE una pieza (una es la otra + 1 parte). La hija tiene una parte MÁS que
// la mayor (sube hacia la rareza alta; 9 = legendaria) y, si los elementos difieren,
// nace con un SUBELEMENTO. Todo deriva de un genoma-id → reproducible.
import { partsOf, genomeId, makeCritter, MAX_PARTS } from '../critter/forge.js';
import { mixElements } from '../critter/types.js';

// "Piezas" estructurales que cuentan para la fusión.
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

/** ¿Se pueden fusionar? Difieren en EXACTAMENTE una pieza y la mayor no está llena. */
export function canFuse (cA, cB) {
  if (!cA || !cB || cA.id === cB.id) return false;
  const big = bigger(cA, cB), small = big === cA ? cB : cA;
  if (partsOf(big.appearance) >= MAX_PARTS) return false;   // ya llena (9) → no sube más
  return isPlusOne(small.appearance, big.appearance);
}

// Agrega UNA pieza nueva (orden fijo: abdomen → tórax → +1 pata). Tipo determinista.
function addPiece (a) {
  const r = { ...a };
  if (r.abdomen < 0) r.abdomen = a.head % 4;
  else if (r.thorax < 0) r.thorax = a.head % 3;
  else if (r.legs < 6) r.legs = r.legs + 1;
  return r;
}

/** Fusiona CUALQUIER par distinto → NUEVO descriptor determinista. Compatible (difieren
 *  en una pieza) → la hija sube una parte (sube rareza). Incompatible → NO sube parte
 *  (queda como la mayor), pero igual acumula los ingredientes → más impuesto de mezcla
 *  = nace más débil. En ambos casos el elemento es la unión. Null solo si par inválido. */
export function fuse (cA, cB) {
  if (!cA || !cB || cA.id === cB.id) return null;
  const big = bigger(cA, cB);
  const climbs = canFuse(cA, cB);   // compatible → sube de parte/rareza
  const appearance = climbs ? addPiece(big.appearance) : { ...big.appearance };
  const element = mixElements(cA.element, cB.element);
  return makeCritter(genomeId({ element, role: big.role, appearance }));
}
