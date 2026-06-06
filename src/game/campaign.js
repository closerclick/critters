// Campaña como TELARAÑA procedural IRREGULAR, determinista (semilla per-usuario) e
// INFINITA: se generan anillos SOLO hasta unos pasos más allá del frente desbloqueado
// (cleared + LOOKAHEAD). Coordenadas de MUNDO (polar absoluto, el radio crece por
// anillo) → la vista paneable la recorre. Cada zona/rama tiene un TERRENO (elemento)
// que favorece a los critters de ese elemento. Jefes cada ~10 nodos (índice estable).
import { rngFrom } from '../lib/rng.js';
import { battleSeed } from '../battle/engine.js';
import { makeCritter } from '../critter/forge.js';
import { ELEMENTS } from '../critter/types.js';
import { game } from './state.js';

export const SLOTS5 = [4, 0, 2, 6, 8];
const BASE = 5, GROWTH = 2;            // anillo r tiene BASE+(r-1)*GROWTH nodos
export const RING_GAP = 100;           // separación radial por anillo (unidades de mundo)
const INITIAL_RINGS = 3, LOOKAHEAD = 2;
const SECTORS = 6;                     // sectores angulares para el terreno

const _cache = new Map();              // 'seed#rings' → grafo
const angOf = (n) => Math.atan2(n.y, n.x);
function angDiff (a, b) { const d = Math.abs(a - b) % (Math.PI * 2); return Math.min(d, Math.PI * 2 - d); }

const ringOfId = (id) => { if (id === 'core') return 0; const m = /^(\d+)-/.exec(id); return m ? +m[1] : 0; };
function ringsNeeded (cleared) { let mx = 0; for (const id of (cleared || [])) mx = Math.max(mx, ringOfId(id)); return Math.max(INITIAL_RINGS, mx + LOOKAHEAD); }

// Terreno determinista por (sector angular, banda radial): zonas contiguas que
// cambian entre ramas y hacia afuera; ~40% son neutrales (sin terreno).
function terrainFor (seed, n) {
  const ang = (Math.atan2(n.y, n.x) / (Math.PI * 2) + 1) % 1;
  const sector = Math.floor(ang * SECTORS);
  const band = Math.floor((n.ring - 1) / 2);
  const rng = rngFrom(seed + ':terr:' + sector + ':' + band);
  if (rng() < 0.4) return null;
  return ELEMENTS[Math.floor(rng() * ELEMENTS.length)];
}

function build (seed, RINGS) {
  const a0 = rngFrom(seed + ':a')() * Math.PI * 2;
  const core = { id: 'core', ring: 0, x: 0, y: 0, diff: 1, boss: false, terrain: null };
  const nodes = [core];
  const ringNodes = [[core]];
  for (let r = 1; r <= RINGS; r++) {
    const cnt = BASE + (r - 1) * GROWTH, arr = [];
    for (let s = 0; s < cnt; s++) {
      const id = r + '-' + s, jr = rngFrom(seed + ':' + id);
      const ang = a0 + (s / cnt) * Math.PI * 2 + (jr() - 0.5) * 0.32;       // jitter angular
      const rad = (r + (jr() - 0.5) * 0.18) * RING_GAP;                     // anillos separados, jitter suave
      arr.push({ id, ring: r, x: Math.cos(ang) * rad, y: Math.sin(ang) * rad });
    }
    ringNodes.push(arr); nodes.push(...arr);
  }
  // dificultad + jefes (índice global ESTABLE al crecer) + terreno
  const bossOff = Math.floor(rngFrom(seed + ':boss')() * 10);
  nodes.forEach((n, idx) => {
    if (n.ring === 0) return;
    n.diff = 1 + n.ring * 2 + Math.floor(rngFrom(seed + ':d:' + n.id)() * 3);
    n.boss = idx % 10 === bossOff;
    if (n.boss) n.diff = Math.round(n.diff * 1.6) + 2;
    n.terrain = terrainFor(seed, n);
  });
  // adyacencia: circular dentro del anillo + radial al ángulo más cercano del interior
  const adj = {}; nodes.forEach(n => (adj[n.id] = new Set()));
  const link = (a, b) => { adj[a].add(b); adj[b].add(a); };
  for (let r = 1; r <= RINGS; r++) { const arr = ringNodes[r]; for (let i = 0; i < arr.length; i++) link(arr[i].id, arr[(i + 1) % arr.length].id); }
  for (let r = 1; r <= RINGS; r++) {
    const inner = ringNodes[r - 1];
    for (const n of ringNodes[r]) { let best = inner[0], bd = Infinity; const an = angOf(n); for (const m of inner) { if (m.ring === 0) { best = m; break; } const d = angDiff(an, angOf(m)); if (d < bd) { bd = d; best = m; } } link(n.id, best.id); }
  }
  const seen = new Set(), edges = [];
  for (const a in adj) for (const b of adj[a]) { const k = a < b ? a + '|' + b : b + '|' + a; if (!seen.has(k)) { seen.add(k); edges.push([a, b]); } }
  return { nodes, edges, byId: Object.fromEntries(nodes.map(n => [n.id, n])), adj: Object.fromEntries(Object.entries(adj).map(([k, v]) => [k, [...v]])), rings: RINGS };
}

// Genera SOLO hasta el frente desbloqueado + LOOKAHEAD (lee game.cleared, reactivo).
function currentRings () { return ringsNeeded(game && game.cleared); }
export function graph (seed) { const R = currentRings(); const key = seed + '#' + R; if (!_cache.has(key)) _cache.set(key, build(seed, R)); return _cache.get(key); }
export const allNodes = (seed) => graph(seed).nodes;
export const edges = (seed) => graph(seed).edges;
export const neighbors = (seed, id) => graph(seed).adj[id] || [];
export const nodeById = (seed, id) => graph(seed).byId[id] || null;

export const enemyLevel = (d) => Math.max(1, d);
export const enemyCount = (d) => Math.min(5, 1 + Math.floor(d / 2));
// Límite de ciclos para la 2ª estrella ("ganar rápido"): más enemigos → más margen.
export const starCycleLimit = (node) => 120 + enemyCount(node.diff) * 90;
// Las zonas con terreno generan enemigos NATIVOS (de ese elemento, que se benefician
// del terreno) ~70% de las veces; el resto, aleatorios. Determinista.
export function enemyTeam (node, seed) {
  const d = node.diff, cnt = node.boss ? 5 : enemyCount(d), out = [];
  for (let i = 0; i < cnt; i++) {
    let id = `e:${seed}:${node.id}:${i}`;
    if (node.terrain && rngFrom(`nat:${seed}:${node.id}:${i}`)() < 0.7) {
      for (let v = 0; v < 10; v++) { const cand = id + ':' + v; if (makeCritter(cand).element === node.terrain) { id = cand; break; } }
    }
    out.push({ id, level: enemyLevel(d), slot: SLOTS5[i] });
  }
  return out;
}
export function reward (node) { const d = node.diff, m = node.boss ? 2.5 : 1; return { coins: Math.round((30 + d * 10) * m), frags: Math.round((1 + Math.floor(d / 3)) * m) }; }
export function captureDrop (node, seed) {
  if (!(node.boss || rngFrom('cap:' + seed + ':' + node.id)() < 0.6)) return null;
  const team = enemyTeam(node, seed);   // la captura es uno de los enemigos reales (nativo del terreno)
  return team.length ? team[0].id : null;
}
export function nodeBattleSeed (mine, node, seed) { return battleSeed(mine, enemyTeam(node, seed), 'node:' + seed + ':' + node.id); }
