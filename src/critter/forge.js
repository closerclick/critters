// Motor de creación de criaturas (determinista). makeCritter(id) deriva TODA la
// criatura de su id/semilla: rareza, elemento, rol, stats base, pasiva, activa,
// nombre y parámetros de apariencia. Reproducible por cualquiera con solo el id.
import { rngFrom, pick, rint } from '../lib/rng.js';
import { hash32 } from '../lib/hash.js';
import { ELEMENTS } from './types.js';
import { ROLES, ROLE_WEIGHTS } from './roles.js';
import { PASSIVES, ROLE_ACTIVE_POOL, ROLE_PASSIVE_POOL } from './abilities.js';
import { makeName } from './names.js';

export const RARITIES = [
  { key: 'comun',       es: 'Común',       en: 'Common',    weight: 50, budget: 1.00, color: '#94a3b8' },
  { key: 'infrecuente', es: 'Infrecuente', en: 'Uncommon',  weight: 28, budget: 1.15, color: '#22c55e' },
  { key: 'raro',        es: 'Raro',        en: 'Rare',      weight: 14, budget: 1.32, color: '#3b82f6' },
  { key: 'epico',       es: 'Épico',       en: 'Epic',      weight:  6, budget: 1.52, color: '#a855f7' },
  { key: 'legendario',  es: 'Legendario',  en: 'Legendary', weight:  2, budget: 1.78, color: '#f59e0b' },
];
export const RARITY_BY_KEY = Object.fromEntries(RARITIES.map((r, i) => [r.key, { ...r, index: i }]));

const BASE_BUDGET = 240;   // presupuesto de puntos (nivel 1, rareza común)
const HP_FACTOR = 6;       // los puntos de HP "rinden" más (vida en cientos)
export const MAX_PARTS = 9;   // grilla 3×3 llena (cabeza + tórax + abdomen + 6 patas)

// Nº de PARTES ocupadas en la grilla 3×3: cabeza (siempre) + tórax? + abdomen? + patas.
export function partsOf (a) { return 1 + (a.thorax >= 0 ? 1 : 0) + (a.abdomen >= 0 ? 1 : 0) + (a.legs || 0); }
// La RAREZA la da el nº de partes: 1-2 común, 3-4 infrecuente, 5-6 raro, 7-8 épico, 9 legendaria.
export function rarityIndexFromParts (parts) { return parts >= 9 ? 4 : parts >= 7 ? 3 : parts >= 5 ? 2 : parts >= 3 ? 1 : 0; }
export function rarityFromParts (parts) { return RARITIES[rarityIndexFromParts(parts)]; }

// Estilo de combate (rasgo): probabilidad de flanquear según el rol.
const FLANK = { dps: 0.7, distancia: 0.7, control: 0.6, soporte: 0.5, peleador: 0.4, tanque: 0.2 };

// "Genoma-id" de una criatura FUSIONADA: SEMILLA estable + elemento + rol + apariencia.
// La SEMILLA (genética) fija nombre/pasiva/activa/jitter y NO cambia al fusionar/degradar
// (la araña sigue siendo la misma); el elemento y las partes SÍ mutan.
export function genomeId (g) {
  const a = g.appearance;
  return ['g', g.seed, g.element, g.role, a.head, a.thorax, a.abdomen, a.legs, a.legStyle, a.antennae ? 1 : 0, a.hue, a.pattern].join(':');
}
const isElementToken = (s) => !!s && String(s).split('+').every(c => ELEMENTS.includes(c));
function parseGenome (id) {
  const p = id.split(':');
  const old = isElementToken(p[1]);   // compat formato viejo (sin semilla): elemento en p[1]
  const seed = old ? id : p[1];
  const o = old ? 1 : 2;              // offset del elemento
  return {
    seed,
    element: p[o] || 'fuego',
    role: ROLES.includes(p[o + 1]) ? p[o + 1] : ROLES[0],
    appearance: { head: +p[o + 2] || 0, thorax: p[o + 3] == null ? -1 : +p[o + 3], abdomen: p[o + 4] == null ? -1 : +p[o + 4], legs: +p[o + 5] || 0, legStyle: +p[o + 6] || 0, antennae: p[o + 7] === '1', hue: +p[o + 8] || 0, pattern: +p[o + 9] || 0 },
  };
}
/** Semilla genética estable de un id (la del genoma, o el id mismo si es salvaje). */
export function seedOfId (id) { return (typeof id === 'string' && id.startsWith('g:')) ? parseGenome(id).seed : id; }

// CAPACIDAD elemental por rareza: cuántos elementos DISTINTOS puede EXPRESAR.
export const CAP_DISTINCT = [1, 1, 2, 3, 3];   // rarityIndex 0..4 (común..legendaria)
export const capacityFor = (ri) => CAP_DISTINCT[Math.max(0, Math.min(4, ri | 0))];
const canonEl = (counts) => { const a = []; for (const k in counts) for (let i = 0; i < counts[k]; i++) a.push(k); return (a.length ? a.sort() : ['fuego']).join('+'); };
/** Recorta el multiset a la capacidad (distintos) de la rareza: conserva los más
 *  acumulados (multiplicidad desc, luego orden canónico). Determinista. */
export function clampElement (element, rarityIndex) {
  const cap = capacityFor(rarityIndex);
  const counts = {}; for (const c of String(element).split('+')) if (ELEMENTS.includes(c)) counts[c] = (counts[c] || 0) + 1;
  const distinct = Object.keys(counts);
  if (!distinct.length) return 'fuego';
  if (distinct.length <= cap) return canonEl(counts);
  distinct.sort((a, b) => (counts[b] - counts[a]) || (ELEMENTS.indexOf(a) - ELEMENTS.indexOf(b)));
  const kept = {}; for (const k of distinct.slice(0, cap)) kept[k] = counts[k];
  return canonEl(kept);
}

// POTENCIA del elemento (multiplica el presupuesto de stats). Dos partes:
//  - MEZCLA (por RAREZA × elementos DISTINTOS): puro 1.0; sub/triple débiles al nacer y
//    potentes al madurar ("héroe débil"). No depende de la cantidad.
//  - ACUMULACIÓN de duplicados, en gradiente por tier: BASE = convergente fuerte (rinde
//    poco, amontonar es desperdicio); SUBELEMENTO = convergente SUAVE (rinde más y más
//    tiempo); TRIPLE (sub-sub) = LINEAL sin tope → vale la pena farmear leyendas
//    (monstruos enormes del endgame).
export function elementMult (element, rarityIndex = 0) {
  const all = String(element).split('+').filter(e => ELEMENTS.includes(e));
  const distinct = new Set(all).size || 1;
  const extra = Math.max(0, all.length - distinct);   // ingredientes duplicados acumulados
  const mat = Math.max(0, Math.min(4, rarityIndex)) / 4;
  const reward = 0.5 * (distinct - 1) * mat;          // subelemento/triple más potentes al madurar
  const penalty = 0.4 * (distinct - 1) * (1 - mat);   // débil al nacer (mezcladas)
  const grade = distinct >= 3 ? 0.2 * extra                          // triple: LINEAL (leyendas, sin tope)
    : distinct === 2 ? 0.5 * (1 - Math.pow(0.7, extra))              // sub: convergente SUAVE (tope ~0.5)
      : 0.15 * (1 - Math.pow(0.5, extra));                           // base: convergente fuerte (tope 0.15)
  return Math.max(0.2, 1 - penalty + reward + grade);
}

// Cuerpo común: dados elemento/rol/apariencia, deriva rareza (por partes), stats,
// pasiva/activa, flanqueo y nombre con el rng del id. Comparte salvajes y genomas.
function buildBody (id, rng, element, role, appearance, nameTier) {
  const rarityIndex = rarityIndexFromParts(partsOf(appearance));
  const rarity = RARITIES[rarityIndex];
  const w = ROLE_WEIGHTS[role] || ROLE_WEIGHTS[ROLES[0]];
  const budget = BASE_BUDGET * rarity.budget * elementMult(element, rarityIndex);
  const j = () => 0.85 + rng() * 0.30;   // jitter por stat
  const base = {
    HP: Math.round(budget * w.HP * j() * HP_FACTOR),
    ATK: Math.round(budget * w.ATK * j()),
    DEF: Math.round(budget * w.DEF * j()),
    SPD: Math.round(budget * w.SPD * j()),
  };
  base.HP = Math.max(20, base.HP);
  base.ATK = Math.max(5, base.ATK);
  base.DEF = Math.max(1, base.DEF);
  base.SPD = Math.max(5, base.SPD);
  const passive = pick(rng, ROLE_PASSIVE_POOL[role]);
  const active = pick(rng, ROLE_ACTIVE_POOL[role]);
  const flanks = rng() < (FLANK[role] ?? 0.5);
  const name = makeName(rng, nameTier == null ? rarityIndex : nameTier);   // raza estable (no varía con la rareza en genomas)
  return { id, name, element, role, rarity: rarity.key, rarityIndex, base, passive, active, flanks, appearance };
}

/** Crea la criatura completa a partir de su id. Puro y determinista. */
export function makeCritter (id) {
  // Genoma: nombre/pasiva/activa derivan de la SEMILLA estable (no del elemento), así
  // degradar/fusionar cambia poder y elemento pero NO la identidad de la araña.
  if (typeof id === 'string' && id.startsWith('g:')) { const g = parseGenome(id); return buildBody(id, rngFrom('critter:' + g.seed), g.element, g.role, g.appearance, hash32(g.seed) % 5); }
  const rng = rngFrom('critter:' + id);

  // SALVAJES/invocadas: pocas partes → rareza 0/1; la rareza alta (hasta 9 =
  // legendaria) se consigue FUSIONANDO. Cabeza obligatoria; tórax/abdomen opcionales.
  const element = pick(rng, ELEMENTS);
  const role = pick(rng, ROLES);
  const appearance = {
    head: rint(rng, 0, 3),                         // 4 tipos de cabeza
    thorax: rng() < 0.35 ? rint(rng, 0, 2) : -1,   // tórax opcional
    abdomen: rng() < 0.35 ? rint(rng, 0, 3) : -1,  // abdomen opcional
    legs: rint(rng, 0, 3),                          // 0..3 patas (salvaje)
    legStyle: rint(rng, 0, 1),                      // recta | articulada
    antennae: rng() < 0.6,                          // antenas
    hue: rint(rng, -18, 18),                        // variación de tono
    pattern: rint(rng, 0, 2),                       // patrón
  };
  // Tope de 4 partes (rareza ≤ 1) para salvajes: quita abdomen, luego tórax, luego patas.
  while (partsOf(appearance) > 4) {
    if (appearance.abdomen >= 0) appearance.abdomen = -1;
    else if (appearance.thorax >= 0) appearance.thorax = -1;
    else appearance.legs--;
  }
  return buildBody(id, rng, element, role, appearance);
}

// Híbrido de subida de nivel: crecimiento automático (mantiene el arquetipo) +
// PUNTOS asignables por el jugador (reasignables cuando quiera). Cada punto suma un
// valor fijo por stat (HP rinde más porque va en cientos).
export const STAT_KEYS = ['HP', 'ATK', 'DEF', 'SPD'];
export const POINTS_PER_LEVEL = 2;
export const POINT_VALUE = { HP: 12, ATK: 3, DEF: 3, SPD: 2 };
export function pointsTotal (level) { return Math.max(0, (Math.max(1, level) - 1) * POINTS_PER_LEVEL); }
export function pointsSpent (alloc) { return alloc ? ((alloc.HP || 0) + (alloc.ATK || 0) + (alloc.DEF || 0) + (alloc.SPD || 0)) : 0; }
export function pointsFree (level, alloc) { return pointsTotal(level) - pointsSpent(alloc); }

/** Stats efectivas a un nivel dado (crecimiento + pasiva de stat + puntos asignados). */
export function statsAtLevel (critter, level = 1, alloc) {
  const g = 1 + (Math.max(1, level) - 1) * 0.08;
  const s = {
    HP: critter.base.HP * g,
    ATK: critter.base.ATK * g,
    DEF: critter.base.DEF * g,
    SPD: critter.base.SPD * g,
  };
  const p = PASSIVES[critter.passive];
  if (p && p.statMult && p.stat) s[p.stat] *= p.statMult;
  if (alloc) for (const k of STAT_KEYS) s[k] += (alloc[k] || 0) * POINT_VALUE[k];
  for (const k in s) s[k] = Math.round(s[k]);
  s.HP = Math.max(1, s.HP);
  return s;
}

/** Poder aproximado (para emparejar/ordenar). */
export function power (critter, level = 1) {
  const s = statsAtLevel(critter, level);
  return Math.round(s.HP / HP_FACTOR + s.ATK + s.DEF + s.SPD);
}

/** XP necesaria para pasar del nivel L a L+1. */
export function xpForNext (level) { return 50 + (level - 1) * 35; }

export const FORGE_CONST = { BASE_BUDGET, HP_FACTOR };
