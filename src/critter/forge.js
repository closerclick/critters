// Motor de creación de criaturas (determinista). makeCritter(id) deriva TODA la
// criatura de su id/semilla: rareza, elemento, rol, stats base, pasiva, activa,
// nombre y parámetros de apariencia. Reproducible por cualquiera con solo el id.
import { rngFrom, weighted, pick, rint } from '../lib/rng.js';
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

/** Crea la criatura completa a partir de su id. Puro y determinista. */
export function makeCritter (id) {
  const rng = rngFrom('critter:' + id);
  const rarity = weighted(rng, RARITIES.map(r => [r, r.weight]));
  const rarityIndex = RARITIES.indexOf(rarity);
  const element = pick(rng, ELEMENTS);
  const role = pick(rng, ROLES);
  const w = ROLE_WEIGHTS[role];
  const budget = BASE_BUDGET * rarity.budget;

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
  // Estilo de combate (rasgo de la especie): ¿flanquea (rodea, incl. por detrás)
  // o pelea de FRENTE (forma línea)? Determinista por semilla, sesgado por rol.
  const FLANK = { dps: 0.7, distancia: 0.7, control: 0.6, soporte: 0.5, peleador: 0.4, tanque: 0.2 };
  const flanks = rng() < (FLANK[role] ?? 0.5);

  // Anatomía compuesta por partes: SOLO la cabeza es obligatoria; tórax y abdomen
  // opcionales (-1 = ausente). Las patas (0..6) salen de la cabeza (estilo araña).
  const appearance = {
    head: rint(rng, 0, 3),                        // 4 tipos de cabeza
    thorax: rng() < 0.6 ? rint(rng, 0, 2) : -1,   // tórax opcional
    abdomen: rng() < 0.7 ? rint(rng, 0, 3) : -1,  // abdomen opcional
    legs: rint(rng, 0, 6),                         // 0..6 patas (en la cabeza)
    legStyle: rint(rng, 0, 1),                     // recta | articulada
    antennae: rng() < 0.6,                         // antenas
    hue: rint(rng, -18, 18),                       // variación de tono
    pattern: rint(rng, 0, 2),                      // patrón
  };

  const name = makeName(rng, rarityIndex);
  return { id, name, element, role, rarity: rarity.key, rarityIndex, base, passive, active, flanks, appearance };
}

/** Stats efectivas a un nivel dado (crecimiento + pasiva de stat). */
export function statsAtLevel (critter, level = 1) {
  const g = 1 + (Math.max(1, level) - 1) * 0.08;
  const s = {
    HP: critter.base.HP * g,
    ATK: critter.base.ATK * g,
    DEF: critter.base.DEF * g,
    SPD: critter.base.SPD * g,
  };
  const p = PASSIVES[critter.passive];
  if (p && p.statMult && p.stat) s[p.stat] *= p.statMult;
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
