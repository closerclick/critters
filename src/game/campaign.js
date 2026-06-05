// Campaña PvE: equipos rivales deterministas por nivel (generados por semilla),
// dificultad creciente, recompensas y captura del "jefe" en el primer despeje.
import { rngFrom } from '../lib/rng.js';
import { battleSeed } from '../battle/engine.js';

export const SLOTS5 = [4, 0, 2, 6, 8];   // colocación por defecto (centro + esquinas)

export function enemyLevel (n) { return Math.max(1, Math.round(1 + (n - 1) * 0.7)); }
// Cantidad de rivales: empieza en 2 y sube hasta 5 (dificultad creciente).
export function enemyCount (n) { return Math.min(5, 2 + Math.floor((n - 1) / 2)); }

/** Equipo rival del nivel n: criaturas deterministas (`lvlN-i`). */
export function enemyTeam (n) {
  const lvl = enemyLevel(n);
  const cnt = enemyCount(n);
  const out = [];
  for (let i = 0; i < cnt; i++) out.push({ id: `lvl${n}-${i}`, level: lvl, slot: SLOTS5[i] });
  return out;
}

export function levelSeed (n) { return 'campaign:' + n; }
export function campaignBattleSeed (mine, n) { return battleSeed(mine, enemyTeam(n), levelSeed(n)); }

export function reward (n) { return { coins: 30 + n * 10, frags: 1 + Math.floor(n / 3) }; }

/** Captura del jefe (centro) en algunos niveles: id de criatura o null. Determinista. */
export function captureDrop (n) {
  const rng = rngFrom('capture:' + n);
  return rng() < 0.6 ? `lvl${n}-2` : null;
}
