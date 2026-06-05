// Motor de combate determinista y PURO: simulate(teamA, teamB, seed) → {winner, log}.
// Misma entrada ⇒ mismo ganador y mismo log en cualquier máquina (base del PvP
// asíncrono y del futuro competitivo verificable). La única aleatoriedad (crítico)
// sale de un RNG sembrado por `seed`.
import { mulberry32 } from '../lib/rng.js';
import { hash32 } from '../lib/hash.js';
import { makeCritter, statsAtLevel } from '../critter/forge.js';
import { typeMultiplier } from '../critter/types.js';
import { RANGED_ROLES } from '../critter/roles.js';
import { ACTIVES, PASSIVES } from '../critter/abilities.js';
import { BAL, basicDamage } from './balance.js';
import { attackableEnemies, chooseTarget, backmost } from './targeting.js';

// team = [{ id, level, slot }]  (slot 0..8; fila = slot/3 (0=frente), col = slot%3)
function buildUnits (team, side) {
  return team.map((m, i) => {
    const critter = makeCritter(m.id);
    const lvl = m.level || 1;
    const s = statsAtLevel(critter, lvl);
    const slot = m.slot != null ? m.slot : i;
    return {
      uid: side + ':' + slot, side, slot, row: (slot / 3) | 0, col: slot % 3,
      id: m.id, level: lvl, critter,
      name: critter.name, element: critter.element, role: critter.role, rarity: critter.rarity,
      maxHp: s.HP, hp: s.HP, ATK: s.ATK, DEF: s.DEF, SPD: s.SPD,
      energy: 0, stunTurns: 0, buffs: [], alive: true,
      passive: critter.passive, active: critter.active,
    };
  });
}

function eff (u, stat) {
  let v = u[stat];
  for (const b of u.buffs) if (b.stat === stat) v *= b.mult;
  if (stat === 'ATK') {
    const p = PASSIVES[u.passive];
    if (p && p.enrage && u.hp < u.maxHp * 0.5) v *= (1 + p.enrage);
  }
  return v;
}

function faint (u, log) { if (u.alive) { u.alive = false; u.hp = 0; log.push({ t: 'faint', target: u.uid }); } }

function gainEnergyOnHit (u) { u.energy = Math.min(ACTIVES[u.active].cost, u.energy + BAL.energyPerHit); }

function dealDamage (attacker, target, amount, log, kind, extra) {
  amount = Math.max(1, Math.round(amount));
  target.hp -= amount;
  gainEnergyOnHit(target);
  log.push({ t: kind || 'attack', by: attacker ? attacker.uid : null, target: target.uid, dmg: amount, ...(extra || {}) });
  // Espinas (reflejo) del que recibe.
  if (attacker && attacker.alive) {
    const tp = PASSIVES[target.passive];
    if (tp && tp.thorns && target.hp > 0) {
      const refl = Math.max(1, Math.round(amount * tp.thorns));
      attacker.hp -= refl;
      log.push({ t: 'thorns', by: target.uid, target: attacker.uid, dmg: refl });
      if (attacker.hp <= 0) faint(attacker, log);
    }
  }
  // Robo de vida del atacante.
  if (attacker && attacker.alive) {
    const ap = PASSIVES[attacker.passive];
    if (ap && ap.lifesteal) {
      const heal = Math.max(1, Math.round(amount * ap.lifesteal));
      attacker.hp = Math.min(attacker.maxHp, attacker.hp + heal);
      log.push({ t: 'lifesteal', target: attacker.uid, heal });
    }
  }
  if (target.hp <= 0) faint(target, log);
}

function basicAttack (u, enemyTeam, rng, log) {
  const ranged = RANGED_ROLES.has(u.role);
  const cands = attackableEnemies(enemyTeam, { ignoreProtect: ranged });
  const target = chooseTarget(u, cands);
  if (!target) return;
  const crit = rng() < BAL.critChance;
  const tm = typeMultiplier(u.element, target.element);
  const dmg = basicDamage(eff(u, 'ATK'), eff(target, 'DEF'), tm, crit);
  dealDamage(u, target, dmg, log, 'attack', { crit, adv: tm > 1 ? 1 : (tm < 1 ? -1 : 0) });
}

function castActive (u, ab, enemyTeam, allyTeam, rng, log) {
  log.push({ t: 'active', by: u.uid, ability: u.active });
  if (ab.type === 'damage') {
    let targets = [];
    if (ab.scope === 'all') targets = enemyTeam.filter(e => e.alive);
    else if (ab.scope === 'backmost') { const b = backmost(enemyTeam); if (b) targets = [b]; }
    else { const t = chooseTarget(u, attackableEnemies(enemyTeam, { ignoreProtect: ab.ignoreProtect || RANGED_ROLES.has(u.role) })); if (t) targets = [t]; }
    for (const t of targets) {
      const crit = rng() < BAL.critChance;
      const tm = typeMultiplier(u.element, t.element);
      const dmg = basicDamage(eff(u, 'ATK') * ab.mult, eff(t, 'DEF'), tm, crit);
      dealDamage(u, t, dmg, log, 'attack', { crit, adv: tm > 1 ? 1 : (tm < 1 ? -1 : 0), ability: u.active });
    }
  } else if (ab.type === 'stun') {
    const t = chooseTarget(u, attackableEnemies(enemyTeam, {}));
    if (t) {
      const tm = typeMultiplier(u.element, t.element);
      const dmg = basicDamage(eff(u, 'ATK') * ab.mult, eff(t, 'DEF'), tm, false);
      dealDamage(u, t, dmg, log, 'attack', { ability: u.active });
      if (t.alive) { t.stunTurns += ab.dur; log.push({ t: 'stun', target: t.uid, dur: ab.dur }); }
    }
  } else if (ab.type === 'heal') {
    let t = null;
    if (ab.scope === 'self') t = u;
    else { // lowestAlly por ratio de vida
      for (const a of allyTeam) { if (!a.alive) continue; if (!t || a.hp / a.maxHp < t.hp / t.maxHp) t = a; }
    }
    if (t) { const heal = Math.max(1, Math.round(eff(u, 'ATK') * ab.mult)); t.hp = Math.min(t.maxHp, t.hp + heal); log.push({ t: 'heal', by: u.uid, target: t.uid, heal }); }
  } else if (ab.type === 'buff') {
    const targets = ab.scope === 'allies' ? allyTeam.filter(a => a.alive) : [u];
    for (const a of targets) a.buffs.push({ stat: ab.stat, mult: ab.mult, turns: ab.dur });
    log.push({ t: 'buff', by: u.uid, stat: ab.stat, mult: ab.mult, dur: ab.dur, targets: targets.map(a => a.uid) });
  }
}

function takeTurn (u, enemyTeam, allyTeam, rng, log) {
  // Inicio de turno: vencer buffs, regen, stun.
  u.buffs = u.buffs.filter(b => (--b.turns) > 0);
  const p = PASSIVES[u.passive];
  if (p && p.regen) { const h = Math.max(1, Math.round(u.maxHp * p.regen)); if (u.hp < u.maxHp) { u.hp = Math.min(u.maxHp, u.hp + h); log.push({ t: 'regen', target: u.uid, heal: h }); } }
  if (u.stunTurns > 0) { u.stunTurns--; log.push({ t: 'stun-skip', target: u.uid }); return; }
  // Acción: activa si hay energía, si no básico.
  const ab = ACTIVES[u.active];
  if (u.energy >= ab.cost) { castActive(u, ab, enemyTeam, allyTeam, rng, log); u.energy = 0; }
  else { basicAttack(u, enemyTeam, rng, log); u.energy = Math.min(ab.cost, u.energy + BAL.energyPerAction); }
}

const aliveCount = (team) => team.reduce((n, u) => n + (u.alive ? 1 : 0), 0);
const totalHp = (team) => team.reduce((n, u) => n + Math.max(0, u.hp), 0);

/**
 * Simula la batalla. teamA/teamB = [{id, level, slot}]. Devuelve:
 *  { winner: 'A'|'B'|'draw', rounds, log, teams: {A:[...], B:[...]} }
 * `teams` es la composición inicial (para que la UI dibuje las grillas).
 */
export function simulate (teamA, teamB, seed) {
  const A = buildUnits(teamA, 0), B = buildUnits(teamB, 1);
  const all = [...A, ...B];
  const rng = mulberry32(hash32(String(seed || 'seed')));
  const log = [];
  const initial = { A: A.map(snap), B: B.map(snap) };

  let rounds = 0;
  while (rounds < BAL.maxRounds && aliveCount(A) > 0 && aliveCount(B) > 0) {
    const order = all.filter(u => u.alive).sort((x, y) =>
      eff(y, 'SPD') - eff(x, 'SPD') || x.side - y.side || x.row - y.row || x.col - y.col || (x.uid < y.uid ? -1 : 1));
    for (const u of order) {
      if (!u.alive) continue;
      takeTurn(u, u.side === 0 ? B : A, u.side === 0 ? A : B, rng, log);
      if (aliveCount(A) === 0 || aliveCount(B) === 0) break;
    }
    rounds++;
  }

  let winner;
  if (aliveCount(A) > 0 && aliveCount(B) === 0) winner = 'A';
  else if (aliveCount(B) > 0 && aliveCount(A) === 0) winner = 'B';
  else { const ha = totalHp(A), hb = totalHp(B); winner = ha > hb ? 'A' : (hb > ha ? 'B' : 'draw'); }

  return { winner, rounds, log, teams: initial };
}

// Instantánea de una unidad para la UI (sin estado mutable de batalla).
function snap (u) {
  return { uid: u.uid, side: u.side, slot: u.slot, row: u.row, col: u.col,
    id: u.id, level: u.level, name: u.name, element: u.element, role: u.role, rarity: u.rarity,
    maxHp: u.maxHp, ATK: u.ATK, DEF: u.DEF, SPD: u.SPD, passive: u.passive, active: u.active };
}

/** Semilla de batalla a partir de dos equipos + un id de match (determinista). */
export function battleSeed (teamA, teamB, matchId) {
  const key = (t) => t.map(m => `${m.id}@${m.level || 1}#${m.slot}`).join(',');
  return `${key(teamA)}|${key(teamB)}|${matchId || ''}`;
}
