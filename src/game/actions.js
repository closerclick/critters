// Acciones del juego: invocación (gacha), XP/nivel, gestión del equipo 3×3 y
// batalla de campaña. Operan sobre el estado reactivo y persisten.
import { game, persist, newUid, instanceByUid, critterById } from './state.js';
import { neighbors, nodeById, enemyTeam, reward, captureDrop, nodeBattleSeed } from './campaign.js';
import { simulate } from '../battle/engine.js';
import { xpForNext, pointsFree } from '../critter/forge.js';
import { canFuse, fuse } from './fusion.js';

export const SUMMON_COST = 100;   // monedas por invocación
export const FEED_XP = 60;        // XP por alimentar
export const FEED_COST = 5;       // fragmentos por alimentar
export const TEAM_MAX = 5;        // criaturas en la rejilla

export function addCritter (id, level = 1) {
  const inst = { uid: newUid(), id, level, xp: 0 };
  game.collection.push(inst);
  return inst;
}

/** Elige la criatura inicial (1 de 3). La coloca en el centro y cierra la elección. */
export function chooseStarter (id) {
  if (game.collection.length) return null;
  const inst = addCritter(id, 1);
  game.team = Array(9).fill(null);
  game.team[4] = inst.uid;   // centro (la posición más protegida)
  game.starterOptions = null;
  persist();
  return inst;
}

export function awardXp (inst, amount) {
  inst.xp += amount;
  while (inst.xp >= xpForNext(inst.level)) { inst.xp -= xpForNext(inst.level); inst.level++; }
}

/** Invoca una criatura nueva (id fresco → criatura determinista por ese id). */
export function summon () {
  if (game.wallet.coins < SUMMON_COST) return { error: 'coins' };
  game.wallet.coins -= SUMMON_COST;
  const id = 'sm-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
  const inst = addCritter(id, 1);
  persist();
  return { instance: inst };
}

/** Alimenta una instancia con fragmentos → XP. */
export function feed (uid) {
  const inst = instanceByUid(uid);
  if (!inst) return { error: 'notfound' };
  if (game.wallet.frags < FEED_COST) return { error: 'frags' };
  game.wallet.frags -= FEED_COST;
  awardXp(inst, FEED_XP);
  persist();
  return { instance: inst };
}

// ---- equipo (rejilla 3×3, slots 0..8) ----
export function teamCount () { return game.team.filter(Boolean).length; }
export function slotOfUid (uid) { return game.team.indexOf(uid); }

/** Coloca/mueve una instancia en un slot. Una instancia ocupa un solo slot; tope TEAM_MAX. */
export function placeInSlot (slot, uid) {
  if (slot < 0 || slot > 8) return;
  const prev = game.team.indexOf(uid);
  if (prev >= 0) game.team[prev] = null;             // ya estaba: lo movemos
  if (uid && prev < 0 && teamCount() >= TEAM_MAX) return { error: 'full' };
  game.team[slot] = uid || null;
  persist();
}
export function clearSlot (slot) { if (slot >= 0 && slot <= 8) { game.team[slot] = null; persist(); } }

export function teamInstances () {
  const out = [];
  game.team.forEach((uid, slot) => { if (uid) { const inst = instanceByUid(uid); if (inst) out.push({ slot, instance: inst }); } });
  return out;
}
export function teamSnapshot () { return teamInstances().map(x => ({ id: x.instance.id, level: x.instance.level, slot: x.slot, policy: x.instance.policy, target: x.instance.target, alloc: x.instance.alloc })); }

/** Cambia la política de movimiento de una instancia. */
export function setPolicy (uid, policy) { const i = instanceByUid(uid); if (i) { i.policy = policy; persist(); } }
/** Cambia la preferencia de objetivo de una instancia. */
export function setTarget (uid, pref) { const i = instanceByUid(uid); if (i) { i.target = pref; persist(); } }

// ---- puntos de stat (híbrido; respec libre en cualquier momento) ----
export function adjustAlloc (uid, stat, delta) {
  const i = instanceByUid(uid); if (!i) return;
  if (!i.alloc) i.alloc = {};
  const cur = i.alloc[stat] || 0;
  const next = cur + delta;
  if (next < 0) return;
  if (delta > 0 && pointsFree(i.level, i.alloc) <= 0) return;   // sin puntos libres
  i.alloc[stat] = next; persist();
}
export function resetAlloc (uid) { const i = instanceByUid(uid); if (i) { i.alloc = {}; persist(); } }

// ---- fusión ----
/** uids de la colección que se pueden fusionar con `uid` (cualquiera; los incompatibles
 *  salen débiles). */
export function fusablePartners (uid) {
  return game.collection.filter(b => b.uid !== uid).map(b => b.uid);
}
/** ¿La fusión A+B es COMPATIBLE (sube rareza) o incompatible (débil)? */
export function isCompatibleFuse (uidA, uidB) {
  const a = instanceByUid(uidA), b = instanceByUid(uidB);
  return !!(a && b) && canFuse(critterById(a.id), critterById(b.id));
}
/** Vista previa del descriptor resultante (no consume nada). */
export function fusePreview (uidA, uidB) {
  const a = instanceByUid(uidA), b = instanceByUid(uidB);
  return (a && b) ? fuse(critterById(a.id), critterById(b.id)) : null;
}
/** Fusiona dos instancias: crea la hija (nivel 1) y CONSUME ambas (colección y equipo). */
export function fuseCritters (uidA, uidB) {
  const a = instanceByUid(uidA), b = instanceByUid(uidB);
  if (!a || !b || uidA === uidB) return { error: 'pick' };
  const child = fuse(critterById(a.id), critterById(b.id));
  if (!child) return { error: 'incompat' };
  for (let i = 0; i < game.team.length; i++) if (game.team[i] === uidA || game.team[i] === uidB) game.team[i] = null;
  game.collection = game.collection.filter(x => x.uid !== uidA && x.uid !== uidB);
  const inst = addCritter(child.id, 1);
  persist();
  return { instance: inst, critter: child };
}

// ---- telaraña de campaña ----
export function isUnlocked (id) { return id === 'core' || neighbors(game.seed, id).some(nb => game.cleared.includes(nb)); }

/** Pelea el NODO de la telaraña con el equipo actual. */
export function fightCampaign (nodeId) {
  const node = nodeById(game.seed, nodeId);
  if (!node) return { error: 'node' };
  if (!isUnlocked(nodeId)) return { error: 'locked' };
  const ti = teamInstances();
  if (!ti.length) return { error: 'noteam' };
  const mine = ti.map(x => ({ id: x.instance.id, level: x.instance.level, slot: x.slot, policy: x.instance.policy, target: x.instance.target, alloc: x.instance.alloc }));
  const enemies = enemyTeam(node, game.seed);
  const result = simulate(mine, enemies, nodeBattleSeed(mine, node, game.seed), { terrain: node.terrain || null });
  const win = result.winner === 'A';
  const winXp = 18 + node.diff * 4;
  // XP: ganar da winXp; perder da un CUARTO (entrena igual → anti-softlock).
  const gain = win ? winXp : Math.max(1, Math.round(winXp / 4));
  const payload = { result, win, node: node.id, level: node.diff, boss: node.boss, terrain: node.terrain || null, xp: {} };
  // Aplica XP a cada miembro y registra lo ganado por SLOT (para el resumen).
  for (const x of ti) {
    const before = x.instance.level;
    awardXp(x.instance, gain);
    payload.xp['0:' + x.slot] = { gained: gain, level: x.instance.level, up: x.instance.level > before, xp: x.instance.xp, need: xpForNext(x.instance.level) };
  }
  if (win) {
    const firstClear = !game.cleared.includes(node.id);
    const rw = reward(node);
    game.wallet.coins += rw.coins; game.wallet.frags += rw.frags;
    payload.reward = rw;
    if (firstClear) {
      game.cleared.push(node.id);
      payload.firstClear = true;
      const drop = captureDrop(node, game.seed);
      if (drop) payload.captured = addCritter(drop, 1);
    }
    const nb = neighbors(game.seed, node.id).find(id => isUnlocked(id) && !game.cleared.includes(id));
    if (nb) payload.nextNode = nb;
  }
  persist();
  return payload;
}
