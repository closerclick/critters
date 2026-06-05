// Estado reactivo del juego (Vue) + persistencia (store durable + cache local).
// La colección guarda INSTANCIAS { uid, id, level, xp }; los datos de la criatura
// se derivan del `id` con makeCritter (cacheado).
import { reactive } from 'vue';
import { loadDoc, saveDoc, SAVE_THREAD } from '../store.js';
import { makeCritter } from '../critter/forge.js';

const LS_KEY = 'critters.save';

export const game = reactive({
  ready: false,
  collection: [],            // [{ uid, id, level, xp }]
  wallet: { coins: 150, frags: 0 },
  team: Array(9).fill(null), // slot 0..8 → uid de instancia (o null)
  campaignMax: 1,            // nivel más alto desbloqueado
});

// ---- cache de criaturas (id → descriptor) ----
const _cache = new Map();
export function critterById (id) { let c = _cache.get(id); if (!c) { c = makeCritter(id); _cache.set(id, c); } return c; }
export function instanceByUid (uid) { return game.collection.find(i => i.uid === uid) || null; }
export function critterOf (uid) { const i = instanceByUid(uid); return i ? critterById(i.id) : null; }

export function newUid () { return 'i' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

// ---- persistencia ----
function snapshot () { return { collection: game.collection, wallet: game.wallet, team: game.team, campaignMax: game.campaignMax }; }
let _t = null;
export function persist () {
  try { localStorage.setItem(LS_KEY, JSON.stringify(snapshot())); } catch {}
  clearTimeout(_t); _t = setTimeout(() => { saveDoc(SAVE_THREAD, snapshot()).catch(() => {}); }, 300);
}
function apply (d) {
  if (Array.isArray(d.collection)) game.collection = d.collection;
  if (d.wallet) game.wallet = { coins: d.wallet.coins || 0, frags: d.wallet.frags || 0 };
  if (Array.isArray(d.team)) { const t = Array(9).fill(null); d.team.slice(0, 9).forEach((v, i) => t[i] = v || null); game.team = t; }
  if (d.campaignMax) game.campaignMax = d.campaignMax;
}

export async function loadGame () {
  // 1) Local primero (sincrónico): la UI arranca sin esperar la red del store.
  try { const d = JSON.parse(localStorage.getItem(LS_KEY)); if (d) apply(d); } catch {}
  if (!game.collection.length) grantStarter();
  game.ready = true;
  persist();
  // 2) Store en segundo plano: fusiona si trae más progreso.
  loadDoc(SAVE_THREAD).then(remote => {
    if (remote && Array.isArray(remote.collection) && remote.collection.length > game.collection.length) { apply(remote); persist(); }
  }).catch(() => {});
}

// Primer arranque: 3 criaturas iniciales colocadas en el frente.
function grantStarter () {
  const ids = ['inicio-fuego', 'inicio-agua', 'inicio-planta'];
  game.collection = ids.map(id => ({ uid: newUid(), id, level: 1, xp: 0 }));
  game.team = Array(9).fill(null);
  game.team[4] = game.collection[0].uid;  // centro
  game.team[0] = game.collection[1].uid;  // frente izq
  game.team[2] = game.collection[2].uid;  // frente der
  game.wallet = { coins: 150, frags: 0 };
  game.campaignMax = 1;
}
