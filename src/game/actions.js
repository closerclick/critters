// Acciones del juego: invocación (gacha), XP/nivel, gestión del equipo 3×3 y
// batalla de campaña. Operan sobre el estado reactivo y persisten.
import { game, persist, newUid, instanceByUid } from './state.js';
import { enemyTeam, reward, captureDrop, campaignBattleSeed } from './campaign.js';
import { simulate } from '../battle/engine.js';
import { xpForNext } from '../critter/forge.js';

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
export function teamSnapshot () { return teamInstances().map(x => ({ id: x.instance.id, level: x.instance.level, slot: x.slot })); }

/** Pelea el nivel n de la campaña con el equipo actual. */
export function fightCampaign (n) {
  const ti = teamInstances();
  if (!ti.length) return { error: 'noteam' };
  const mine = ti.map(x => ({ id: x.instance.id, level: x.instance.level, slot: x.slot }));
  const enemies = enemyTeam(n);
  const seed = campaignBattleSeed(mine, n);
  const result = simulate(mine, enemies, seed);
  const win = result.winner === 'A';
  const payload = { result, win, level: n };
  if (win) {
    const firstClear = n >= game.campaignMax;
    const rw = reward(n);
    game.wallet.coins += rw.coins; game.wallet.frags += rw.frags;
    payload.reward = rw;
    for (const x of ti) awardXp(x.instance, 20 + n * 4);
    if (firstClear) {
      game.campaignMax = Math.max(game.campaignMax, n + 1);
      payload.firstClear = true;
      const drop = captureDrop(n);
      if (drop) payload.captured = addCritter(drop, 1);
    }
    persist();
  }
  return payload;
}
