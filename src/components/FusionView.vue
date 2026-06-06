<script setup>
import { ref, computed } from 'vue';
import { game, instanceByUid } from '../game/state.js';
import { fusePreview, fuseCritters, isCompatibleFuse } from '../game/actions.js';
import { openCritter } from '../ui.js';
import { elementInfo } from '../critter/types.js';
import { RARITY_BY_KEY } from '../critter/forge.js';
import { t, loc } from '../i18n.js';
import CritterCard from './CritterCard.vue';

const selA = ref(null);
const selB = ref(null);

const instA = computed(() => selA.value ? instanceByUid(selA.value) : null);
const instB = computed(() => selB.value ? instanceByUid(selB.value) : null);
const others = computed(() => game.collection.filter(i => i.uid !== selA.value));
const compatOf = (uid) => isCompatibleFuse(selA.value, uid);
const previewCompatible = computed(() => (selA.value && selB.value) ? isCompatibleFuse(selA.value, selB.value) : false);
const preview = computed(() => (selA.value && selB.value) ? fusePreview(selA.value, selB.value) : null);
const prevInst = computed(() => preview.value ? { uid: '__prev', id: preview.value.id, level: 1 } : null);
const prevEl = computed(() => preview.value ? elementInfo(preview.value.element) : null);
const prevRar = computed(() => preview.value ? RARITY_BY_KEY[preview.value.rarity] : null);

const gridList = computed(() => {
  if (!selA.value) return game.collection;
  if (!selB.value) return others.value;
  return [];
});
const subLabel = computed(() => {
  if (!selA.value) return t('fusionPick');
  if (!selB.value) return t('fusionPick2');
  return '';
});

function choose (uid) {
  if (!selA.value) { selA.value = uid; selB.value = null; return; }
  if (uid === selA.value) return;
  if (!selB.value) selB.value = uid;   // cualquiera: compatible (sube) o incompatible (débil)
}
function clearA () { selA.value = null; selB.value = null; }
function reset () { selA.value = null; selB.value = null; }
function doFuse () {
  const r = fuseCritters(selA.value, selB.value);
  reset();
  if (r && r.instance) openCritter(r.instance.uid);   // muestra la nueva criatura
}
</script>

<template>
  <p class="hint">{{ t('fusionHint') }}</p>

  <template v-if="game.collection.length >= 2">
    <div class="fuse-bar">
      <div class="fslot" :class="{ on: selA }" @click="clearA">
        <CritterCard v-if="instA" :instance="instA" :size="66" :stats="false" />
        <span v-else class="q">A</span>
      </div>
      <span class="op">+</span>
      <div class="fslot" :class="{ on: selB }" @click="selB = null">
        <CritterCard v-if="instB" :instance="instB" :size="66" :stats="false" />
        <span v-else class="q">B</span>
      </div>
      <span class="op">=</span>
      <div class="fslot res">
        <CritterCard v-if="prevInst" :instance="prevInst" :size="66" :stats="false" />
        <span v-else class="q">?</span>
      </div>
    </div>

    <div v-if="preview" class="prev-info">
      <div><b :style="{ color: prevEl.color }">{{ preview.name }}</b>
        <span class="dot">·</span> {{ loc(prevEl) }}
        <span class="dot">·</span> <span :style="{ color: prevRar.color }">{{ loc(prevRar) }}</span></div>
      <div class="fnote" :class="previewCompatible ? 'ok' : 'weak'">{{ previewCompatible ? '✓ ' + t('fusionSube') : '⚠ ' + t('fusionDebil') }}</div>
    </div>

    <div class="row-btns" v-if="selA || selB">
      <button class="btn sec" @click="reset">{{ t('cancelar') }}</button>
      <button class="btn" :disabled="!preview" @click="doFuse">✦ {{ t('fusionar') }}</button>
    </div>

    <div class="fsub" v-if="subLabel">{{ subLabel }}</div>
    <div class="grid-cards" v-if="gridList.length">
      <div v-for="i in gridList" :key="i.uid" @click="choose(i.uid)" class="fcell">
        <span v-if="selA && !selB" class="ftag" :class="compatOf(i.uid) ? 'ok' : 'weak'">{{ compatOf(i.uid) ? '✓' : t('fusionDebil') }}</span>
        <CritterCard :instance="i" :size="78" />
      </div>
    </div>
  </template>
</template>

<style scoped>
.fuse-bar{display:flex;align-items:center;justify-content:center;gap:8px;margin:10px 0}
.fslot{width:84px;height:104px;border-radius:14px;border:1px dashed var(--line2);background:rgba(167,139,250,.05);
  display:flex;align-items:center;justify-content:center;position:relative}
.fslot.on{border-style:solid;border-color:var(--accent)}
.fslot.res{border-color:color-mix(in srgb,var(--cyan) 50%,var(--line2));background:rgba(56,225,214,.06)}
.fslot .q{font-family:var(--fdisplay);font-size:24px;color:var(--muted);opacity:.6}
.fslot :deep(.card){transform:scale(.92)}
.op{font-family:var(--fdisplay);font-size:22px;color:var(--muted)}
.prev-info{text-align:center;font-size:13px;margin:2px 0 8px}
.prev-info .dot{color:var(--muted);margin:0 4px}
.fnote{font-family:var(--fmono);font-size:11px;margin-top:3px}
.fnote.ok{color:var(--good)} .fnote.weak{color:var(--gold)}
.fsub{font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;text-align:center;margin:10px 0 6px}
.fcell{position:relative;cursor:pointer}
.ftag{position:absolute;top:4px;left:50%;transform:translateX(-50%);z-index:3;font-family:var(--fmono);font-size:9px;font-weight:800;
  padding:1px 6px;border-radius:7px}
.ftag.ok{background:var(--good);color:#062b12}
.ftag.weak{background:rgba(120,113,108,.85);color:#e7e5e4}
</style>
