// Estado reactivo del juego (Vue) + persistencia (store durable + cache local).
// La colección guarda INSTANCIAS { uid, id, level, xp }; los datos de la criatura
// se derivan del `id` con makeCritter (cacheado).
import { reactive } from 'vue';
import { loadDoc, saveDoc, clearSave, SAVE_THREAD } from '../store.js';
import { makeCritter } from '../critter/forge.js';

const LS_KEY = 'critters.save';

export const game = reactive({
  ready: false,
  collection: [],            // [{ uid, id, level, xp }]
  wallet: { coins: 0, frags: 0 },
  team: Array(9).fill(null), // slot 0..8 → uid de instancia (o null)
  starterOptions: null,      // 3 ids candidatos para elegir la primera criatura
  seed: null,                // semilla de la telaraña de campaña (per-usuario)
  cleared: [],               // ids de nodos despejados
});

// ---- cache de criaturas (id → descriptor) ----
const _cache = new Map();
export function critterById (id) { let c = _cache.get(id); if (!c) { c = makeCritter(id); _cache.set(id, c); } return c; }
export function instanceByUid (uid) { return game.collection.find(i => i.uid === uid) || null; }
export function critterOf (uid) { const i = instanceByUid(uid); return i ? critterById(i.id) : null; }

export function newUid () { return 'i' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

// ---- persistencia ----
function snapshot () { return { collection: game.collection, wallet: game.wallet, team: game.team, starterOptions: game.starterOptions, seed: game.seed, cleared: game.cleared }; }
let _t = null;
export function persist () {
  try { localStorage.setItem(LS_KEY, JSON.stringify(snapshot())); } catch {}
  clearTimeout(_t); _t = setTimeout(() => { saveDoc(SAVE_THREAD, snapshot()).catch(() => {}); }, 300);
}
function apply (d) {
  if (Array.isArray(d.collection)) game.collection = d.collection;
  if (d.wallet) game.wallet = { coins: d.wallet.coins || 0, frags: d.wallet.frags || 0 };
  if (Array.isArray(d.team)) { const t = Array(9).fill(null); d.team.slice(0, 9).forEach((v, i) => t[i] = v || null); game.team = t; }
  if (Array.isArray(d.starterOptions)) game.starterOptions = d.starterOptions;
  if (d.seed) game.seed = d.seed;
  if (Array.isArray(d.cleared)) game.cleared = d.cleared;
}

export async function loadGame () {
  // 1) Local primero (sincrónico): la UI arranca sin esperar la red del store.
  try { const d = JSON.parse(localStorage.getItem(LS_KEY)); if (d) apply(d); } catch {}
  if (!game.collection.length) ensureStarterOptions();   // primer arranque → elegir 1 de 3
  if (!game.seed) game.seed = 'u' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);  // telaraña per-usuario
  if (!Array.isArray(game.cleared)) game.cleared = [];
  game.ready = true;
  persist();
  // 2) Store en segundo plano: fusiona si trae más progreso.
  loadDoc(SAVE_THREAD).then(remote => {
    if (remote && Array.isArray(remote.collection) && remote.collection.length > game.collection.length) { apply(remote); persist(); }
  }).catch(() => {});
}

// Borra TODA la partida (local + store) y recarga. Botón temporal de dev.
export async function resetGame () {
  try { localStorage.removeItem(LS_KEY); } catch {}
  try { await clearSave(); } catch {}
  try { location.reload(); } catch {}
}

// Primer arranque: genera 3 candidatos de nivel 1 (variados en elemento/rol) para
// que el jugador elija UNO. Se persisten hasta que elige (estables al recargar).
function makeStarterOptions () {
  const opts = [], seen = new Set();
  let n = 0;
  while (opts.length < 3 && n < 60) {
    const id = 'start-' + Date.now().toString(36) + '-' + n + '-' + Math.random().toString(36).slice(2, 6);
    const c = critterById(id);
    const key = c.element + ':' + c.role;
    if (!seen.has(key)) { seen.add(key); opts.push(id); }
    n++;
  }
  while (opts.length < 3) opts.push('start-x' + opts.length + '-' + Math.random().toString(36).slice(2, 6));
  return opts;
}
function ensureStarterOptions () {
  if (!game.collection.length && (!Array.isArray(game.starterOptions) || game.starterOptions.length !== 3)) {
    game.starterOptions = makeStarterOptions();
  }
}
