<script setup>
import { computed, ref, watch, onUnmounted } from 'vue';
import { instanceByUid, critterById, game, displayName } from '../game/state.js';
import { feed, FEED_COST, setRol, setTarget, adjustAlloc, resetAlloc, setNick } from '../game/actions.js';
import { critterSvg } from '../critter/svg.js';
import { statsAtLevel, STAT_KEYS, pointsFree, xpForNext, RARITY_BY_KEY } from '../critter/forge.js';
import { ACTIVES, PASSIVES } from '../critter/abilities.js';
import { elementInfo, ELEMENT_INFO, comps } from '../critter/types.js';
import { ROL_INFO, ROL_KEYS, normalizeRol, normalizeTargets, TARGET_INFO, ALLY_INFO } from '../battle/policies.js';
import { t, loc } from '../i18n.js';

// Perfil + configuración de UNA criatura. Se abre tocando su avatar en cualquier
// vista (colección, equipo) — nunca en pelea. Separado en pestañas.
const props = defineProps({ uid: String });
const emit = defineEmits(['close']);

const inst = computed(() => instanceByUid(props.uid));
const critter = computed(() => { const i = inst.value; return i ? critterById(i.id) : null; });
const svgBig = computed(() => critter.value ? critterSvg(critter.value, 110) : '');
const stats = computed(() => critter.value ? statsAtLevel(critter.value, inst.value.level, inst.value.alloc) : null);
const free = computed(() => inst.value ? pointsFree(inst.value.level, inst.value.alloc) : 0);
const activeInfo = computed(() => critter.value ? ACTIVES[critter.value.active] : null);
const passiveInfo = computed(() => critter.value ? PASSIVES[critter.value.passive] : null);
const rar = computed(() => critter.value ? RARITY_BY_KEY[critter.value.rarity] : null);
const elInfo = computed(() => critter.value ? elementInfo(critter.value.element) : null);

// Composición de INGREDIENTES (multiset de bases con multiplicidad) → barra + leyenda.
const ingredients = computed(() => {
  const c = critter.value; if (!c) return [];
  const counts = {}; for (const k of comps(c.element)) if (ELEMENT_INFO[k]) counts[k] = (counts[k] || 0) + 1;
  const total = Object.values(counts).reduce((a, b) => a + b, 0) || 1;
  return ['fuego', 'agua', 'planta'].filter(b => counts[b]).map(b => ({ key: b, n: counts[b], pct: Math.round(100 * counts[b] / total), info: ELEMENT_INFO[b] }));
});
const ingTotal = computed(() => ingredients.value.reduce((a, x) => a + x.n, 0));

// XP hacia el siguiente nivel.
const xpCur = computed(() => inst.value ? inst.value.xp : 0);
const xpNeed = computed(() => xpForNext(inst.value ? inst.value.level : 1));
const xpPct = computed(() => Math.min(100, Math.round(100 * xpCur.value / xpNeed.value)));

const TABS = [
  { k: 'stats', i: '📊', l: 'tabStats' },
  { k: 'elem', i: '🧪', l: 'tabElemento' },
  { k: 'hab', i: '✦', l: 'tabHabilidades' },
  { k: 'comb', i: '⚔', l: 'tabCombate' },
];
const tab = ref('stats');

const err = ref('');
const allocOf = (s) => { const i = inst.value; return (i && i.alloc && i.alloc[s]) || 0; };
function incPt (s) { adjustAlloc(props.uid, s, 1); }
function decPt (s) { adjustAlloc(props.uid, s, -1); }
function resetPts () { resetAlloc(props.uid); }
function doFeed () { const r = feed(props.uid); err.value = (r && r.error === 'frags') ? t('sinFrags') : ''; }

// Prioridad de ROL + 3 listas de OBJETIVO (una por rol), reordenables por drag & drop.
const rolOrder = ref([]);     // prioridad de rol
const targetsObj = ref({});   // { atacante:[...], defensa:[...], soporte:[...] }
const tgtRol = ref('atacante');   // sub-tab de objetivo seleccionado
const order = ref([]);        // objetivo del rol seleccionado (vista editable)
watch(() => props.uid, () => {
  rolOrder.value = normalizeRol(inst.value && (inst.value.rol || inst.value.policy), critter.value && critter.value.role);
  targetsObj.value = normalizeTargets(inst.value && inst.value.target);
  tgtRol.value = 'atacante';
  order.value = targetsObj.value[tgtRol.value].slice();
  tab.value = 'stats';
}, { immediate: true });
function pickTgtRol (r) { if (r === tgtRol.value) return; tgtRol.value = r; order.value = targetsObj.value[r].slice(); }
const tgtInfo = computed(() => tgtRol.value === 'soporte' ? ALLY_INFO : TARGET_INFO);   // soporte = criterios de ALIADOS
const dragIdx = ref(-1);
function tDown (e, i) { e.preventDefault(); dragIdx.value = i; window.addEventListener('pointermove', tMove, { passive: false }); window.addEventListener('pointerup', tUp); }
function tMove (e) {
  if (dragIdx.value < 0) return;
  e.preventDefault();
  const el = document.elementFromPoint(e.clientX, e.clientY);
  const row = el && el.closest && el.closest('[data-tidx]');
  if (!row) return;
  const j = Number(row.dataset.tidx);
  if (j !== dragIdx.value) { const arr = order.value.slice(); const [m] = arr.splice(dragIdx.value, 1); arr.splice(j, 0, m); order.value = arr; dragIdx.value = j; }
}
function tUp () { window.removeEventListener('pointermove', tMove); window.removeEventListener('pointerup', tUp); if (dragIdx.value >= 0) { targetsObj.value[tgtRol.value] = order.value.slice(); setTarget(props.uid, tgtRol.value, order.value.slice()); dragIdx.value = -1; } }
const rolIdx = ref(-1);
function rDown (e, i) { e.preventDefault(); rolIdx.value = i; window.addEventListener('pointermove', rMove, { passive: false }); window.addEventListener('pointerup', rUp); }
function rMove (e) {
  if (rolIdx.value < 0) return;
  e.preventDefault();
  const el = document.elementFromPoint(e.clientX, e.clientY);
  const row = el && el.closest && el.closest('[data-ridx]');
  if (!row) return;
  const j = Number(row.dataset.ridx);
  if (j !== rolIdx.value) { const arr = rolOrder.value.slice(); const [m] = arr.splice(rolIdx.value, 1); arr.splice(j, 0, m); rolOrder.value = arr; rolIdx.value = j; }
}
function rUp () { window.removeEventListener('pointermove', rMove); window.removeEventListener('pointerup', rUp); if (rolIdx.value >= 0) { setRol(props.uid, rolOrder.value.slice()); rolIdx.value = -1; } }
onUnmounted(() => { window.removeEventListener('pointermove', tMove); window.removeEventListener('pointerup', tUp); });
</script>

<template>
  <div class="detail-modal" @click.self="emit('close')">
    <div class="detail-card" v-if="critter">
      <div class="d-portrait">
        <div v-html="svgBig" style="display:flex;justify-content:center"></div>
        <span v-if="free > 0" class="d-pts" :title="t('lblLibres')">✦{{ free }}</span>
      </div>
      <h2 style="margin-top:4px">{{ displayName(inst, critter) }}</h2>
      <input class="nick-in" :value="inst.nick || ''" :placeholder="t('apodoPh') + ' (' + critter.name + ')'" maxlength="16" @change="e => setNick(uid, e.target.value)" :title="t('apodo')" />
      <div class="chips" style="justify-content:center;margin:6px 0 4px">
        <span class="chip">{{ t('nv') }}{{ inst.level }}</span>
        <span v-if="rar" class="chip" :style="{ color: rar.color, borderColor: rar.color }">{{ loc(rar) }}</span>
      </div>

      <div class="dtabs">
        <button v-for="x in TABS" :key="x.k" class="dtab" :class="{ on: tab === x.k }" @click="tab = x.k">{{ x.i }} {{ t(x.l) }}</button>
      </div>

      <!-- STATS -->
      <div v-show="tab === 'stats'" class="dpane">
        <div class="xpbar"><i :style="{ width: xpPct + '%' }"></i></div>
        <div class="xp-cap">XP {{ xpCur }}/{{ xpNeed }} · {{ Math.max(0, xpNeed - xpCur) }} → {{ t('nv') }}{{ inst.level + 1 }}</div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin:8px 0 4px">
          <span style="font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.05em">{{ t('puntos') }} · {{ t('lblLibres') }}: <b style="color:var(--cyan)">{{ free }}</b></span>
          <button class="chip" @click="resetPts">{{ t('resetear') }}</button>
        </div>
        <div v-for="s in STAT_KEYS" :key="s" class="alloc-row">
          <span class="al-k">{{ t('stat' + s) }}</span>
          <span class="al-v">{{ stats[s] }}</span>
          <button class="al-btn" @click="decPt(s)" :disabled="allocOf(s) <= 0">−</button>
          <span class="al-c">{{ allocOf(s) }}</span>
          <button class="al-btn" @click="incPt(s)" :disabled="free <= 0">+</button>
        </div>
      </div>

      <!-- ELEMENTO + composición de ingredientes -->
      <div v-show="tab === 'elem'" class="dpane">
        <div class="chips" style="justify-content:center;margin-bottom:8px">
          <span v-if="elInfo" class="chip" :style="{ color: elInfo.color, borderColor: elInfo.color }">{{ loc(elInfo) }}</span>
        </div>
        <div class="comp-title">{{ t('composicion') }}</div>
        <div class="comp-bar">
          <span v-for="g in ingredients" :key="g.key" class="comp-seg" :style="{ width: g.pct + '%', background: g.info.color }"></span>
        </div>
        <div class="comp-legend">
          <span v-for="g in ingredients" :key="g.key" class="comp-leg">
            <span class="comp-dot" :style="{ background: g.info.color }"></span>{{ loc(g.info) }} <b>×{{ g.n }}</b>
          </span>
        </div>
        <div class="hint" style="margin-top:6px">{{ ingTotal }} {{ t('ingredientes') }} · {{ ingredients.length }} {{ t('distintos') }}</div>
      </div>

      <!-- HABILIDADES -->
      <div v-show="tab === 'hab'" class="dpane" style="text-align:left;font-size:13px">
        <p style="margin:8px 0"><b style="color:var(--accent)">{{ t('activa') }}:</b> {{ loc(activeInfo) }}<br><span style="color:var(--muted)">{{ loc(activeInfo?.d) }}</span></p>
        <p style="margin:8px 0"><b style="color:var(--accent)">{{ t('pasiva') }}:</b> {{ loc(passiveInfo) }}<br><span style="color:var(--muted)">{{ loc(passiveInfo?.d) }}</span></p>
      </div>

      <!-- COMBATE: política + objetivo -->
      <div v-show="tab === 'comb'" class="dpane">
        <div style="font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:5px">{{ t('rol') }}</div>
        <div class="tgt-list">
          <div v-for="(k, i) in rolOrder" :key="k" class="tgt-row" :data-ridx="i" :class="{ drag: rolIdx === i }" @pointerdown="rDown($event, i)">
            <span class="tgt-handle">⠿</span>
            <span class="tgt-num">{{ i + 1 }}</span>
            <span class="tgt-txt"><b>{{ loc(ROL_INFO[k]) }}</b><small>{{ loc(ROL_INFO[k].d) }}</small></span>
          </div>
        </div>

        <div style="font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;margin:12px 0 6px">{{ t('objetivo') }} · {{ t('porRol') }}</div>
        <div class="dtabs" style="margin:0 0 6px">
          <button v-for="r in ROL_KEYS" :key="r" class="dtab" :class="{ on: tgtRol === r }" @click="pickTgtRol(r)">{{ loc(ROL_INFO[r]) }}</button>
        </div>
        <div class="tgt-list">
          <div v-for="(k, i) in order" :key="k" class="tgt-row" :data-tidx="i" :class="{ drag: dragIdx === i }" @pointerdown="tDown($event, i)">
            <span class="tgt-handle">⠿</span>
            <span class="tgt-num">{{ i + 1 }}</span>
            <span class="tgt-txt"><b>{{ loc(tgtInfo[k]) }}</b><small>{{ loc(tgtInfo[k].d) }}</small></span>
          </div>
        </div>
        <div class="hint" style="margin-top:6px;text-align:center">{{ t('objetivoHint') }}</div>
      </div>

      <div class="row-btns" style="margin-top:12px">
        <button class="btn" :disabled="game.wallet.frags < FEED_COST" @click="doFeed">{{ t('alimentar') }} · 🔹{{ FEED_COST }}</button>
        <button class="btn sec" @click="emit('close')">{{ t('cerrar') }}</button>
      </div>
      <p class="hint" v-if="tab === 'stats'">{{ t('alimentarHint') }}</p>
      <p v-if="err" class="hint" style="color:var(--bad)">{{ err }}</p>
    </div>
  </div>
</template>

<style scoped>
.detail-modal{position:fixed;inset:0;z-index:45;display:flex;align-items:center;justify-content:center;padding:16px;
  background:rgba(2,4,12,.78);backdrop-filter:blur(5px);animation:dfade .22s ease-out}
@keyframes dfade{from{opacity:0}to{opacity:1}}
.nick-in{display:block;margin:2px auto 0;max-width:240px;width:100%;text-align:center;background:var(--panel);color:var(--text);border:1px solid var(--line2);border-radius:8px;padding:4px 8px;font-size:12px}
.nick-in::placeholder{color:var(--muted)}
.d-portrait{position:relative;width:max-content;margin:0 auto}
.d-pts{position:absolute;top:2px;right:-6px;font-family:var(--fmono);font-size:12px;font-weight:800;color:var(--ink);background:var(--cyan);border-radius:9px;padding:1px 7px;box-shadow:0 0 8px var(--cyan)}
.detail-card{width:100%;max-width:360px;max-height:90vh;overflow-y:auto;background:var(--panel2);border:1px solid var(--line2);
  border-radius:16px;padding:18px;text-align:center;box-shadow:0 22px 60px rgba(0,0,0,.6);animation:dpop .3s cubic-bezier(.2,1.25,.4,1)}
@keyframes dpop{from{opacity:0;transform:scale(.93)}to{opacity:1;transform:scale(1)}}

.dtabs{display:flex;gap:4px;margin:8px 0 4px;border-bottom:1px solid var(--line);padding-bottom:0}
.dtab{flex:1 1 0;min-width:0;font-family:var(--fdisplay);font-weight:700;font-size:11px;padding:7px 4px;border:none;background:none;color:var(--muted);
  border-bottom:2px solid transparent;border-radius:0;cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dtab.on{color:var(--text);border-bottom-color:var(--accent)}
.dpane{min-height:160px;padding-top:8px;animation:dfade .18s ease-out}

.xpbar{height:7px;border-radius:5px;background:rgba(7,6,17,.7);overflow:hidden;margin:0 0 3px;border:1px solid var(--line)}
.xpbar i{display:block;height:100%;background:linear-gradient(90deg,var(--cyan),var(--accent));transition:width .3s}
.xp-cap{font-family:var(--fmono);font-size:10.5px;color:var(--muted);margin-bottom:4px}

.comp-title{font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px}
.comp-bar{display:flex;height:16px;border-radius:8px;overflow:hidden;border:1px solid var(--line);background:rgba(7,6,17,.6)}
.comp-seg{height:100%;transition:width .3s}
.comp-legend{display:flex;flex-wrap:wrap;gap:10px;justify-content:center;margin-top:8px;font-size:12.5px}
.comp-leg{display:inline-flex;align-items:center;gap:5px}
.comp-dot{width:11px;height:11px;border-radius:50%;display:inline-block}

.tgt-list{display:flex;flex-direction:column;gap:6px}
.tgt-row{display:flex;align-items:center;gap:9px;padding:7px 10px;border-radius:10px;border:1px solid var(--line2);
  background:rgba(167,139,250,.06);cursor:grab;touch-action:none;text-align:left;transition:border-color .12s, box-shadow .12s}
.tgt-row:active{cursor:grabbing}
.tgt-row.drag{border-color:var(--cyan);box-shadow:0 0 0 2px var(--cyan);opacity:.92}
.tgt-handle{color:var(--muted);font-size:13px}
.tgt-num{font-family:var(--fmono);font-weight:800;color:var(--cyan);width:16px;text-align:center}
.tgt-txt{display:flex;flex-direction:column;line-height:1.18;min-width:0}
.tgt-txt small{color:var(--muted);font-size:10.5px}
</style>
