<script setup>
import { ref } from 'vue';
import { game, instanceByUid, critterById } from '../game/state.js';
import { feed, FEED_COST, setPolicy } from '../game/actions.js';
import { critterSvg } from '../critter/svg.js';
import { ACTIVES, PASSIVES } from '../critter/abilities.js';
import { POLICIES, POLICY_INFO, defaultPolicy } from '../battle/policies.js';
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
const curPolicy = () => { const i = inst(), c = critter(); return (i && i.policy) || (c ? defaultPolicy(c.role) : 'agresiva'); };
function setPol (p) { setPolicy(detail.value, p); }
</script>

<template>
  <p v-if="!game.collection.length" class="hint">{{ t('colVacia') }}</p>
  <div class="grid-cards">
    <div v-for="i in game.collection" :key="i.uid" @click="open(i.uid)">
      <CritterCard :instance="i" :size="84" />
    </div>
  </div>

  <div v-if="detail" class="battle" style="background:rgba(2,6,15,.9)" @click.self="close">
    <div style="margin:auto;background:var(--panel2);border:1px solid var(--line2);border-radius:16px;max-width:360px;width:100%;padding:18px;text-align:center">
      <div v-html="svgBig()" style="display:flex;justify-content:center"></div>
      <h2 style="margin-top:6px">{{ critter()?.name }}</h2>
      <div class="chips" style="justify-content:center;margin:8px 0"><span class="chip">{{ t('nv') }}{{ inst()?.level }}</span></div>
      <div style="text-align:left;font-size:13px;margin:8px 0">
        <p style="margin:6px 0"><b style="color:var(--accent)">{{ t('activa') }}:</b> {{ loc(activeInfo()) }} — <span style="color:var(--muted)">{{ loc(activeInfo()?.d) }}</span></p>
        <p style="margin:6px 0"><b style="color:var(--accent)">{{ t('pasiva') }}:</b> {{ loc(passiveInfo()) }} — <span style="color:var(--muted)">{{ loc(passiveInfo()?.d) }}</span></p>
      </div>
      <div style="margin:8px 0">
        <div style="font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:5px">{{ t('politica') }}</div>
        <div class="chips" style="justify-content:center">
          <button v-for="p in POLICIES" :key="p" class="chip" :style="curPolicy() === p ? { background: 'var(--accent2)', color: '#fff', borderColor: 'var(--accent)' } : {}" @click="setPol(p)">{{ loc(POLICY_INFO[p]) }}</button>
        </div>
        <div class="hint" style="margin-top:5px;text-align:center">{{ loc(POLICY_INFO[curPolicy()]?.d) }}</div>
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
