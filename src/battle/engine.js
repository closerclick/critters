// Motor de combate determinista y PURO sobre un CAMPO 3×8 con MOVIMIENTO.
// Cada bando arranca en su bloque 3×3 (jugador cols 0-2, enemigo cols 5-7). Cada
// turno un critter decide según su POLÍTICA: si el objetivo está en RANGO ataca;
// si no, avanza una casilla hacia él (los melee tienen rango 1 → deben acercarse).
// Las armas/escudos equipados (bonus en el snapshot) suman rango/ATK/DEF.
// simulate(teamA, teamB, seed) → {winner, rounds, log, units}. Mismo input ⇒ mismo
// resultado (base del PvP asíncrono / competitivo verificable).
import { mulberry32 } from '../lib/rng.js';
import { hash32 } from '../lib/hash.js';
import { makeCritter, statsAtLevel } from '../critter/forge.js';
import { typeMultiplier } from '../critter/types.js';
import { RANGED_ROLES } from '../critter/roles.js';
import { ACTIVES, PASSIVES } from '../critter/abilities.js';
import { BAL, basicDamage } from './balance.js';
import { defaultPolicy } from './policies.js';

export const COLS = 8, ROWS = 3;
const AOE = new Set(['all', 'self', 'allies', 'backmost']);   // activas que no requieren rango

function buildUnits (team, side) {
  return team.map((m, i) => {
    const critter = makeCritter(m.id);
    const lvl = m.level || 1;
    const s = statsAtLevel(critter, lvl);
    const slot = m.slot != null ? m.slot : i;
    const srow = (slot / 3) | 0, scol = slot % 3;
    const b = m.bonus || {};   // equipo en patas: { range, atk, def }
    const ranged = RANGED_ROLES.has(critter.role);
    return {
      uid: side + ':' + slot, side, slot,
      row: srow, col: side === 0 ? scol : (COLS - 1 - scol),   // jugador a la izq, enemigo a la der
      id: m.id, level: lvl, critter, name: critter.name, element: critter.element, role: critter.role, rarity: critter.rarity,
      maxHp: s.HP, hp: s.HP, ATK: s.ATK + (b.atk || 0), DEF: s.DEF + (b.def || 0), SPD: s.SPD,
      range: (ranged ? 3 : 1) + (b.range || 0),
      policy: m.policy || defaultPolicy(critter.role),
      energy: 0, stunTurns: 0, buffs: [], alive: true, passive: critter.passive, active: critter.active,
    };
  });
}

const cheb = (a, b) => Math.max(Math.abs(a.row - b.row), Math.abs(a.col - b.col));
function eff (u, stat) {
  let v = u[stat];
  for (const x of u.buffs) if (x.stat === stat) v *= x.mult;
  if (stat === 'ATK') { const p = PASSIVES[u.passive]; if (p && p.enrage && u.hp < u.maxHp * 0.5) v *= (1 + p.enrage); }
  return v;
}
function faint (u, log) { if (u.alive) { u.alive = false; u.hp = 0; log.push({ t: 'faint', target: u.uid }); } }
function gainHit (u) { u.energy = Math.min(ACTIVES[u.active].cost, u.energy + BAL.energyPerHit); }

function dealDamage (att, tgt, amount, log, extra) {
  amount = Math.max(1, Math.round(amount));
  tgt.hp -= amount; gainHit(tgt);
  log.push({ t: 'attack', by: att ? att.uid : null, target: tgt.uid, dmg: amount, ...(extra || {}) });
  if (att && att.alive) {
    const tp = PASSIVES[tgt.passive];
    if (tp && tp.thorns && tgt.hp > 0) { const r = Math.max(1, Math.round(amount * tp.thorns)); att.hp -= r; log.push({ t: 'thorns', by: tgt.uid, target: att.uid, dmg: r }); if (att.hp <= 0) faint(att, log); }
    const ap = PASSIVES[att.passive];
    if (ap && ap.lifesteal) { const h = Math.max(1, Math.round(amount * ap.lifesteal)); att.hp = Math.min(att.maxHp, att.hp + h); log.push({ t: 'lifesteal', target: att.uid, heal: h }); }
  }
  if (tgt.hp <= 0) faint(tgt, log);
}

function attackTarget (u, target, rng, log, mult, ability) {
  const crit = rng() < BAL.critChance;
  const tm = typeMultiplier(u.element, target.element);
  const dmg = basicDamage(eff(u, 'ATK') * (mult || 1), eff(target, 'DEF'), tm, crit);
  dealDamage(u, target, dmg, log, { crit, adv: tm > 1 ? 1 : (tm < 1 ? -1 : 0), ability: ability || null });
}

function chooseTarget (u, enemies) {
  const alive = enemies.filter(e => e.alive);
  if (!alive.length) return null;
  if (u.policy === 'cazador') { let b = alive[0]; for (const e of alive) if (e.hp < b.hp || (e.hp === b.hp && cheb(u, e) < cheb(u, b))) b = e; return b; }
  let b = alive[0]; for (const e of alive) { const d = cheb(u, e), db = cheb(u, b); if (d < db || (d === db && e.hp < b.hp)) b = e; }
  return b;
}
function farthest (u, enemies) { let b = null; for (const e of enemies) if (e.alive && (!b || cheb(u, e) > cheb(u, b))) b = e; return b; }

function moveToward (u, target, occ, log) {
  const dr = Math.sign(target.row - u.row), dc = Math.sign(target.col - u.col);
  for (const [mr, mc] of [[dr, dc], [0, dc], [dr, 0]]) {
    if (!mr && !mc) continue;
    const nr = u.row + mr, nc = u.col + mc;
    if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) continue;
    const k = nr + ',' + nc; if (occ[k]) continue;
    delete occ[u.row + ',' + u.col]; u.row = nr; u.col = nc; occ[k] = u.uid;
    log.push({ t: 'move', by: u.uid, r: nr, c: nc });
    return true;
  }
  return false;
}

function castActive (u, ab, enemies, allies, rng, log) {
  log.push({ t: 'active', by: u.uid, ability: u.active });
  if (ab.type === 'damage') {
    let targets = [];
    if (ab.scope === 'all') targets = enemies.filter(e => e.alive);
    else if (ab.scope === 'backmost') { const b = farthest(u, enemies); if (b) targets = [b]; }
    else { const tt = chooseTarget(u, enemies); if (tt) targets = [tt]; }
    for (const tt of targets) attackTarget(u, tt, rng, log, ab.mult, u.active);
  } else if (ab.type === 'stun') {
    const tt = chooseTarget(u, enemies);
    if (tt) { attackTarget(u, tt, rng, log, ab.mult, u.active); if (tt.alive) { tt.stunTurns += ab.dur; log.push({ t: 'stun', target: tt.uid, dur: ab.dur }); } }
  } else if (ab.type === 'heal') {
    let tt = ab.scope === 'self' ? u : null;
    if (!tt) for (const al of allies) { if (!al.alive) continue; if (!tt || al.hp / al.maxHp < tt.hp / tt.maxHp) tt = al; }
    if (tt) { const h = Math.max(1, Math.round(eff(u, 'ATK') * ab.mult)); tt.hp = Math.min(tt.maxHp, tt.hp + h); log.push({ t: 'heal', by: u.uid, target: tt.uid, heal: h }); }
  } else if (ab.type === 'buff') {
    const ts = ab.scope === 'allies' ? allies.filter(a => a.alive) : [u];
    for (const al of ts) al.buffs.push({ stat: ab.stat, mult: ab.mult, turns: ab.dur });
    log.push({ t: 'buff', by: u.uid, stat: ab.stat, mult: ab.mult, dur: ab.dur, targets: ts.map(a => a.uid) });
  }
}

function takeTurn (u, enemies, allies, occ, rng, log) {
  u.buffs = u.buffs.filter(b => (--b.turns) > 0);
  const p = PASSIVES[u.passive];
  if (p && p.regen && u.hp < u.maxHp) { const h = Math.max(1, Math.round(u.maxHp * p.regen)); u.hp = Math.min(u.maxHp, u.hp + h); log.push({ t: 'regen', target: u.uid, heal: h }); }
  if (u.stunTurns > 0) { u.stunTurns--; log.push({ t: 'stun-skip', target: u.uid }); return; }

  const target = chooseTarget(u, enemies);
  if (!target) return;
  const ab = ACTIVES[u.active];
  const inRange = cheb(u, target) <= u.range;
  if (u.energy >= ab.cost && (AOE.has(ab.scope) || inRange)) { castActive(u, ab, enemies, allies, rng, log); u.energy = 0; return; }
  if (inRange) { attackTarget(u, target, rng, log); u.energy = Math.min(ab.cost, u.energy + BAL.energyPerAction); return; }
  if (u.policy === 'defensiva') { u.energy = Math.min(ab.cost, u.energy + 8); return; }   // aguanta
  // avanzar (guardián avanza poco: solo si está lejos)
  if (u.policy === 'guardian' && cheb(u, target) <= 2) { u.energy = Math.min(ab.cost, u.energy + 8); return; }
  if (moveToward(u, target, occ, log)) {
    if (cheb(u, target) <= u.range) attackTarget(u, target, rng, log);
    else u.energy = Math.min(ab.cost, u.energy + 6);
  }
}

const aliveN = (t) => t.reduce((n, u) => n + (u.alive ? 1 : 0), 0);
const totHp = (t) => t.reduce((n, u) => n + Math.max(0, u.hp), 0);
const snap = (u) => ({ uid: u.uid, side: u.side, slot: u.slot, row: u.row, col: u.col, id: u.id, level: u.level, name: u.name, element: u.element, role: u.role, rarity: u.rarity, maxHp: u.maxHp, range: u.range, policy: u.policy });

export function simulate (teamA, teamB, seed) {
  const A = buildUnits(teamA, 0), B = buildUnits(teamB, 1), all = [...A, ...B];
  const occ = {}; for (const u of all) occ[u.row + ',' + u.col] = u.uid;
  const rng = mulberry32(hash32(String(seed || 'seed')));
  const log = [];
  const units = all.map(snap);

  let rounds = 0;
  while (rounds < BAL.maxRounds && aliveN(A) > 0 && aliveN(B) > 0) {
    const order = all.filter(u => u.alive).sort((x, y) => eff(y, 'SPD') - eff(x, 'SPD') || x.side - y.side || x.col - y.col || x.row - y.row || (x.uid < y.uid ? -1 : 1));
    for (const u of order) {
      if (!u.alive) continue;
      takeTurn(u, u.side === 0 ? B : A, u.side === 0 ? A : B, occ, rng, log);
      if (aliveN(A) === 0 || aliveN(B) === 0) break;
    }
    rounds++;
  }
  let winner;
  if (aliveN(A) > 0 && aliveN(B) === 0) winner = 'A';
  else if (aliveN(B) > 0 && aliveN(A) === 0) winner = 'B';
  else { const ha = totHp(A), hb = totHp(B); winner = ha > hb ? 'A' : (hb > ha ? 'B' : 'draw'); }
  return { winner, rounds, log, units };
}

export function battleSeed (teamA, teamB, matchId) {
  const key = (t) => t.map(m => `${m.id}@${m.level || 1}#${m.slot}`).join(',');
  return `${key(teamA)}|${key(teamB)}|${matchId || ''}`;
}
