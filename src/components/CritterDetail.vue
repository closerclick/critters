<script setup>
import { computed, ref } from 'vue';
import { instanceByUid, critterById, game } from '../game/state.js';
import { feed, FEED_COST, setPolicy, setTarget, adjustAlloc, resetAlloc } from '../game/actions.js';
import { critterSvg } from '../critter/svg.js';
import { statsAtLevel, STAT_KEYS, pointsFree } from '../critter/forge.js';
import { ACTIVES, PASSIVES } from '../critter/abilities.js';
import { POLICIES, POLICY_INFO, defaultPolicy, TARGET_PREFS, TARGET_INFO, defaultTarget } from '../battle/policies.js';
import { t, loc } from '../i18n.js';

// Perfil + configuración de UNA criatura. Se abre tocando su avatar en cualquier
// vista (colección, equipo) — nunca en pelea. Toda la config (puntos, política,
// objetivo, alimentar) se cambia desde acá.
const props = defineProps({ uid: String });
const emit = defineEmits(['close']);

const inst = computed(() => instanceByUid(props.uid));
const critter = computed(() => { const i = inst.value; return i ? critterById(i.id) : null; });
const svgBig = computed(() => critter.value ? critterSvg(critter.value, 130) : '');
const stats = computed(() => critter.value ? statsAtLevel(critter.value, inst.value.level, inst.value.alloc) : null);
const free = computed(() => inst.value ? pointsFree(inst.value.level, inst.value.alloc) : 0);
const activeInfo = computed(() => critter.value ? ACTIVES[critter.value.active] : null);
const passiveInfo = computed(() => critter.value ? PASSIVES[critter.value.passive] : null);
const curPolicy = computed(() => { const i = inst.value, c = critter.value; return (i && i.policy) || (c ? defaultPolicy(c.role) : 'agresiva'); });
const curTarget = computed(() => { const i = inst.value, c = critter.value; return (i && i.target) || (c ? defaultTarget(c.role) : 'cercano'); });

const err = ref('');
const allocOf = (s) => { const i = inst.value; return (i && i.alloc && i.alloc[s]) || 0; };
function incPt (s) { adjustAlloc(props.uid, s, 1); }
function decPt (s) { adjustAlloc(props.uid, s, -1); }
function resetPts () { resetAlloc(props.uid); }
function setPol (p) { setPolicy(props.uid, p); }
function setTgt (p) { setTarget(props.uid, p); }
function doFeed () { const r = feed(props.uid); err.value = (r && r.error === 'frags') ? t('sinFrags') : ''; }
</script>

<template>
  <div class="detail-modal" @click.self="emit('close')">
    <div class="detail-card" v-if="critter">
      <div v-html="svgBig" style="display:flex;justify-content:center"></div>
      <h2 style="margin-top:6px">{{ critter.name }}</h2>
      <div class="chips" style="justify-content:center;margin:8px 0"><span class="chip">{{ t('nv') }}{{ inst.level }}</span></div>
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
        <div style="font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:5px">{{ t('objetivo') }}</div>
        <div class="chips" style="justify-content:center">
          <button v-for="p in TARGET_PREFS" :key="p" class="chip" :style="curTarget === p ? { background: 'var(--accent2)', color: '#fff', borderColor: 'var(--accent)' } : {}" @click="setTgt(p)">{{ loc(TARGET_INFO[p]) }}</button>
        </div>
        <div class="hint" style="margin-top:5px;text-align:center">{{ loc(TARGET_INFO[curTarget]?.d) }}</div>
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
</style>
