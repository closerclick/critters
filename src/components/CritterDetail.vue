<script setup>
import { computed, ref, watch, onUnmounted } from 'vue';
import { instanceByUid, critterById, game } from '../game/state.js';
import { feed, FEED_COST, setPolicy, setTarget, adjustAlloc, resetAlloc } from '../game/actions.js';
import { critterSvg } from '../critter/svg.js';
import { statsAtLevel, STAT_KEYS, pointsFree, xpForNext, RARITY_BY_KEY } from '../critter/forge.js';
import { ACTIVES, PASSIVES } from '../critter/abilities.js';
import { elementInfo } from '../critter/types.js';
import { POLICIES, POLICY_INFO, defaultPolicy, TARGET_INFO, normalizeTarget } from '../battle/policies.js';
import { t, loc } from '../i18n.js';

// Perfil + configuración de UNA criatura. Se abre tocando su avatar en cualquier
// vista (colección, equipo) — nunca en pelea.
const props = defineProps({ uid: String });
const emit = defineEmits(['close']);

const inst = computed(() => instanceByUid(props.uid));
const critter = computed(() => { const i = inst.value; return i ? critterById(i.id) : null; });
const svgBig = computed(() => critter.value ? critterSvg(critter.value, 130) : '');
const stats = computed(() => critter.value ? statsAtLevel(critter.value, inst.value.level, inst.value.alloc) : null);
const free = computed(() => inst.value ? pointsFree(inst.value.level, inst.value.alloc) : 0);
const activeInfo = computed(() => critter.value ? ACTIVES[critter.value.active] : null);
const passiveInfo = computed(() => critter.value ? PASSIVES[critter.value.passive] : null);
const rar = computed(() => critter.value ? RARITY_BY_KEY[critter.value.rarity] : null);
const elInfo = computed(() => critter.value ? elementInfo(critter.value.element) : null);
const curPolicy = computed(() => { const i = inst.value, c = critter.value; return (i && i.policy) || (c ? defaultPolicy(c.role) : 'agresiva'); });

// XP hacia el siguiente nivel.
const xpCur = computed(() => inst.value ? inst.value.xp : 0);
const xpNeed = computed(() => xpForNext(inst.value ? inst.value.level : 1));
const xpPct = computed(() => Math.min(100, Math.round(100 * xpCur.value / xpNeed.value)));

const err = ref('');
const allocOf = (s) => { const i = inst.value; return (i && i.alloc && i.alloc[s]) || 0; };
function incPt (s) { adjustAlloc(props.uid, s, 1); }
function decPt (s) { adjustAlloc(props.uid, s, -1); }
function resetPts () { resetAlloc(props.uid); }
function setPol (p) { setPolicy(props.uid, p); }
function doFeed () { const r = feed(props.uid); err.value = (r && r.error === 'frags') ? t('sinFrags') : ''; }

// Prioridad de objetivos: lista reordenable por drag & drop (puntero, mobile-friendly).
const order = ref([]);
watch(() => props.uid, () => { order.value = normalizeTarget(inst.value && inst.value.target, critter.value && critter.value.role); }, { immediate: true });
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
function tUp () { window.removeEventListener('pointermove', tMove); window.removeEventListener('pointerup', tUp); if (dragIdx.value >= 0) { setTarget(props.uid, order.value.slice()); dragIdx.value = -1; } }
onUnmounted(() => { window.removeEventListener('pointermove', tMove); window.removeEventListener('pointerup', tUp); });
</script>

<template>
  <div class="detail-modal" @click.self="emit('close')">
    <div class="detail-card" v-if="critter">
      <div v-html="svgBig" style="display:flex;justify-content:center"></div>
      <h2 style="margin-top:6px">{{ critter.name }}</h2>
      <div class="chips" style="justify-content:center;margin:8px 0">
        <span class="chip">{{ t('nv') }}{{ inst.level }}</span>
        <span v-if="rar" class="chip" :style="{ color: rar.color, borderColor: rar.color }">{{ loc(rar) }}</span>
        <span v-if="elInfo" class="chip" :style="{ color: elInfo.color }">{{ loc(elInfo) }}</span>
      </div>

      <div class="xpbar"><i :style="{ width: xpPct + '%' }"></i></div>
      <div class="xp-cap">XP {{ xpCur }}/{{ xpNeed }} · {{ Math.max(0, xpNeed - xpCur) }} → {{ t('nv') }}{{ inst.level + 1 }}</div>

      <div style="text-align:left;font-size:13px;margin:8px 0">
        <p style="margin:6px 0"><b style="color:var(--accent)">{{ t('activa') }}:</b> {{ loc(activeInfo) }} — <span style="color:var(--muted)">{{ loc(activeInfo?.d) }}</span></p>
        <p style="margin:6px 0"><b style="color:var(--accent)">{{ t('pasiva') }}:</b> {{ loc(passiveInfo) }} — <span style="color:var(--muted)">{{ loc(passiveInfo?.d) }}</span></p>
      </div>

      <div style="margin:10px 0">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
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

      <div style="margin:8px 0">
        <div style="font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:5px">{{ t('politica') }}</div>
        <div class="chips" style="justify-content:center">
          <button v-for="p in POLICIES" :key="p" class="chip" :style="curPolicy === p ? { background: 'var(--accent2)', color: '#fff', borderColor: 'var(--accent)' } : {}" @click="setPol(p)">{{ loc(POLICY_INFO[p]) }}</button>
        </div>
        <div class="hint" style="margin-top:5px;text-align:center">{{ loc(POLICY_INFO[curPolicy]?.d) }}</div>
      </div>

      <div style="margin:8px 0">
        <div style="font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px">{{ t('objetivo') }}</div>
        <div class="tgt-list">
          <div v-for="(k, i) in order" :key="k" class="tgt-row" :data-tidx="i" :class="{ drag: dragIdx === i }" @pointerdown="tDown($event, i)">
            <span class="tgt-handle">⠿</span>
            <span class="tgt-num">{{ i + 1 }}</span>
            <span class="tgt-txt"><b>{{ loc(TARGET_INFO[k]) }}</b><small>{{ loc(TARGET_INFO[k].d) }}</small></span>
          </div>
        </div>
        <div class="hint" style="margin-top:6px;text-align:center">{{ t('objetivoHint') }}</div>
      </div>

      <div class="row-btns">
        <button class="btn" :disabled="game.wallet.frags < FEED_COST" @click="doFeed">{{ t('alimentar') }} · 🔹{{ FEED_COST }}</button>
        <button class="btn sec" @click="emit('close')">{{ t('cerrar') }}</button>
      </div>
      <p class="hint">{{ t('alimentarHint') }}</p>
      <p v-if="err" class="hint" style="color:var(--bad)">{{ err }}</p>
    </div>
  </div>
</template>

<style scoped>
.detail-modal{position:fixed;inset:0;z-index:45;display:flex;align-items:center;justify-content:center;padding:16px;
  background:rgba(2,4,12,.78);backdrop-filter:blur(5px);animation:dfade .22s ease-out}
@keyframes dfade{from{opacity:0}to{opacity:1}}
.detail-card{width:100%;max-width:360px;max-height:90vh;overflow-y:auto;background:var(--panel2);border:1px solid var(--line2);
  border-radius:16px;padding:18px;text-align:center;box-shadow:0 22px 60px rgba(0,0,0,.6);animation:dpop .3s cubic-bezier(.2,1.25,.4,1)}
@keyframes dpop{from{opacity:0;transform:scale(.93)}to{opacity:1;transform:scale(1)}}

.xpbar{height:7px;border-radius:5px;background:rgba(7,6,17,.7);overflow:hidden;margin:0 0 3px;border:1px solid var(--line)}
.xpbar i{display:block;height:100%;background:linear-gradient(90deg,var(--cyan),var(--accent));transition:width .3s}
.xp-cap{font-family:var(--fmono);font-size:10.5px;color:var(--muted);margin-bottom:8px}

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
