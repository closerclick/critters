<script setup>
import { ref } from 'vue';
import { game, instanceByUid, critterById } from '../game/state.js';
import { feed, FEED_COST, setPolicy, setTarget, adjustAlloc, resetAlloc } from '../game/actions.js';
import { critterSvg } from '../critter/svg.js';
import { statsAtLevel, STAT_KEYS, pointsFree } from '../critter/forge.js';
import { ACTIVES, PASSIVES } from '../critter/abilities.js';
import { POLICIES, POLICY_INFO, defaultPolicy, TARGET_PREFS, TARGET_INFO, defaultTarget } from '../battle/policies.js';
import { t, loc } from '../i18n.js';
import CritterCard from './CritterCard.vue';

const detail = ref(null);
const err = ref('');
function open (uid) { detail.value = uid; err.value = ''; }
function close () { detail.value = null; }
const inst = () => instanceByUid(detail.value);
const critter = () => { const i = inst(); return i ? critterById(i.id) : null; };
const svgBig = () => { const c = critter(); return c ? critterSvg(c, 130) : ''; };
const activeInfo = () => { const c = critter(); return c ? ACTIVES[c.active] : null; };
const passiveInfo = () => { const c = critter(); return c ? PASSIVES[c.passive] : null; };
function doFeed () { const r = feed(detail.value); if (r.error === 'frags') err.value = t('sinFrags'); else err.value = ''; }
const statsNow = () => { const c = critter(), i = inst(); return c ? statsAtLevel(c, (i && i.level) || 1, i && i.alloc) : null; };
const freePts = () => { const i = inst(); return i ? pointsFree(i.level, i.alloc) : 0; };
const allocOf = (s) => { const i = inst(); return (i && i.alloc && i.alloc[s]) || 0; };
function incPt (s) { adjustAlloc(detail.value, s, 1); }
function decPt (s) { adjustAlloc(detail.value, s, -1); }
function resetPts () { resetAlloc(detail.value); }
const curPolicy = () => { const i = inst(), c = critter(); return (i && i.policy) || (c ? defaultPolicy(c.role) : 'agresiva'); };
const curTarget = () => { const i = inst(), c = critter(); return (i && i.target) || (c ? defaultTarget(c.role) : 'cercano'); };
function setPol (p) { setPolicy(detail.value, p); }
function setTgt (p) { setTarget(detail.value, p); }
</script>

<template>
  <p v-if="!game.collection.length" class="hint">{{ t('colVacia') }}</p>
  <div class="grid-cards">
    <div v-for="i in game.collection" :key="i.uid" @click="open(i.uid)">
      <CritterCard :instance="i" :size="84" />
    </div>
  </div>

  <div v-if="detail" class="battle" style="background:rgba(2,6,15,.9)" @click.self="close">
    <div style="margin:auto;background:var(--panel2);border:1px solid var(--line2);border-radius:16px;max-width:360px;width:100%;max-height:90vh;overflow-y:auto;padding:18px;text-align:center">
      <div v-html="svgBig()" style="display:flex;justify-content:center"></div>
      <h2 style="margin-top:6px">{{ critter()?.name }}</h2>
      <div class="chips" style="justify-content:center;margin:8px 0"><span class="chip">{{ t('nv') }}{{ inst()?.level }}</span></div>
      <div style="text-align:left;font-size:13px;margin:8px 0">
        <p style="margin:6px 0"><b style="color:var(--accent)">{{ t('activa') }}:</b> {{ loc(activeInfo()) }} — <span style="color:var(--muted)">{{ loc(activeInfo()?.d) }}</span></p>
        <p style="margin:6px 0"><b style="color:var(--accent)">{{ t('pasiva') }}:</b> {{ loc(passiveInfo()) }} — <span style="color:var(--muted)">{{ loc(passiveInfo()?.d) }}</span></p>
      </div>

      <div style="margin:10px 0">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
          <span style="font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.05em">{{ t('puntos') }} · {{ t('lblLibres') }}: <b style="color:var(--cyan)">{{ freePts() }}</b></span>
          <button class="chip" @click="resetPts()">{{ t('resetear') }}</button>
        </div>
        <div v-for="s in STAT_KEYS" :key="s" class="alloc-row">
          <span class="al-k">{{ t('stat' + s) }}</span>
          <span class="al-v">{{ statsNow()[s] }}</span>
          <button class="al-btn" @click="decPt(s)" :disabled="allocOf(s) <= 0">−</button>
          <span class="al-c">{{ allocOf(s) }}</span>
          <button class="al-btn" @click="incPt(s)" :disabled="freePts() <= 0">+</button>
        </div>
      </div>

      <div style="margin:8px 0">
        <div style="font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:5px">{{ t('politica') }}</div>
        <div class="chips" style="justify-content:center">
          <button v-for="p in POLICIES" :key="p" class="chip" :style="curPolicy() === p ? { background: 'var(--accent2)', color: '#fff', borderColor: 'var(--accent)' } : {}" @click="setPol(p)">{{ loc(POLICY_INFO[p]) }}</button>
        </div>
        <div class="hint" style="margin-top:5px;text-align:center">{{ loc(POLICY_INFO[curPolicy()]?.d) }}</div>
      </div>
      <div style="margin:8px 0">
        <div style="font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:5px">{{ t('objetivo') }}</div>
        <div class="chips" style="justify-content:center">
          <button v-for="p in TARGET_PREFS" :key="p" class="chip" :style="curTarget() === p ? { background: 'var(--accent2)', color: '#fff', borderColor: 'var(--accent)' } : {}" @click="setTgt(p)">{{ loc(TARGET_INFO[p]) }}</button>
        </div>
        <div class="hint" style="margin-top:5px;text-align:center">{{ loc(TARGET_INFO[curTarget()]?.d) }}</div>
      </div>
      <div class="row-btns">
        <button class="btn" :disabled="game.wallet.frags < FEED_COST" @click="doFeed">{{ t('alimentar') }} · 🔹{{ FEED_COST }}</button>
        <button class="btn sec" @click="close">{{ t('cerrar') }}</button>
      </div>
      <p class="hint">{{ t('alimentarHint') }}</p>
      <p v-if="err" class="hint" style="color:var(--bad)">{{ err }}</p>
    </div>
  </div>
</template>
