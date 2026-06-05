// Campaña como TELARAÑA procedural IRREGULAR y determinista (semilla per-usuario):
// nodo central + anillos; cada anillo hacia afuera tiene MÁS nodos (más niveles) y
// posiciones con jitter (no regular). Las conexiones radiales van al nodo de ángulo
// más cercano del anillo interior (fan-out tipo tela). La dificultad crece hacia
// afuera; hay JEFES cada ~10 nodos. Se avanza por las aristas (desbloquea vecinos).
import { rngFrom } from '../lib/rng.js';
import { battleSeed } from '../battle/engine.js';

export const SLOTS5 = [4, 0, 2, 6, 8];
const RINGS = 5, BASE = 5, GROWTH = 2;   // anillo r tiene BASE+(r-1)*GROWTH nodos

const _cache = new Map();
const angOf = (n) => Math.atan2(n.y - 0.5, n.x - 0.5);
function angDiff (a, b) { const d = Math.abs(a - b) % (Math.PI * 2); return Math.min(d, Math.PI * 2 - d); }

function build (seed) {
  const a0 = rngFrom(seed + ':a')() * Math.PI * 2;
  const core = { id: 'core', ring: 0, x: 0.5, y: 0.5, diff: 1, boss: false };
  const nodes = [core];
  const ringNodes = [[core]];
  for (let r = 1; r <= RINGS; r++) {
    const cnt = BASE + (r - 1) * GROWTH, arr = [];
    for (let s = 0; s < cnt; s++) {
      const id = r + '-' + s, jr = rngFrom(seed + ':' + id);
      const ang = a0 + (s / cnt) * Math.PI * 2 + (jr() - 0.5) * 0.32;      // jitter angular (irregular pero legible)
      const rad = 0.13 + ((r - 1) / Math.max(1, RINGS - 1)) * 0.31 + (jr() - 0.5) * 0.05;   // anillos separados; core despejado
      arr.push({ id, ring: r, x: 0.5 + Math.cos(ang) * rad, y: 0.5 + Math.sin(ang) * rad });
    }
    ringNodes.push(arr); nodes.push(...arr);
  }
  // dificultad + jefes (índice global, ~cada 10 nodos)
  const bossOff = Math.floor(rngFrom(seed + ':boss')() * 10);
  nodes.forEach((n, idx) => {
    if (n.ring === 0) return;
    n.diff = 1 + n.ring * 2 + Math.floor(rngFrom(seed + ':d:' + n.id)() * 3);
    n.boss = idx % 10 === bossOff;
    if (n.boss) n.diff = Math.round(n.diff * 1.6) + 2;
  });
  // adyacencia
  const adj = {}; nodes.forEach(n => (adj[n.id] = new Set()));
  const link = (a, b) => { adj[a].add(b); adj[b].add(a); };
  for (let r = 1; r <= RINGS; r++) { const arr = ringNodes[r]; for (let i = 0; i < arr.length; i++) link(arr[i].id, arr[(i + 1) % arr.length].id); } // circular
  for (let r = 1; r <= RINGS; r++) {                                                  // radial al ángulo más cercano del anillo interior
    const inner = ringNodes[r - 1];
    for (const n of ringNodes[r]) { let best = inner[0], bd = Infinity; const an = angOf(n); for (const m of inner) { const d = m.ring === 0 ? 0 : angDiff(an, angOf(m)); if (m.ring === 0) { best = m; break; } if (d < bd) { bd = d; best = m; } } link(n.id, best.id); }
  }
  const seen = new Set(), edges = [];
  for (const a in adj) for (const b of adj[a]) { const k = a < b ? a + '|' + b : b + '|' + a; if (!seen.has(k)) { seen.add(k); edges.push([a, b]); } }
  return { nodes, edges, byId: Object.fromEntries(nodes.map(n => [n.id, n])), adj: Object.fromEntries(Object.entries(adj).map(([k, v]) => [k, [...v]])) };
}

export function graph (seed) { if (!_cache.has(seed)) _cache.set(seed, build(seed)); return _cache.get(seed); }
export const allNodes = (seed) => graph(seed).nodes;
export const edges = (seed) => graph(seed).edges;
export const neighbors = (seed, id) => graph(seed).adj[id] || [];
export const nodeById = (seed, id) => graph(seed).byId[id] || null;

export const enemyLevel = (d) => Math.max(1, d);
export const enemyCount = (d) => Math.min(5, 1 + Math.floor(d / 2));
export function enemyTeam (node, seed) {
  const d = node.diff, cnt = node.boss ? 5 : enemyCount(d), out = [];
  for (let i = 0; i < cnt; i++) out.push({ id: `e:${seed}:${node.id}:${i}`, level: enemyLevel(d), slot: SLOTS5[i] });
  return out;
}
export function reward (node) { const d = node.diff, m = node.boss ? 2.5 : 1; return { coins: Math.round((30 + d * 10) * m), frags: Math.round((1 + Math.floor(d / 3)) * m) }; }
export function captureDrop (node, seed) { return (node.boss || rngFrom('cap:' + seed + ':' + node.id)() < 0.6) ? `e:${seed}:${node.id}:0` : null; }
export function nodeBattleSeed (mine, node, seed) { return battleSeed(mine, enemyTeam(node, seed), 'node:' + seed + ':' + node.id); }
