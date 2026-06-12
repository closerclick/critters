<script setup>
import { computed } from 'vue';
import { critterById, displayName } from '../game/state.js';
import { statsAtLevel, RARITY_BY_KEY, pointsFree } from '../critter/forge.js';
import { critterSvg } from '../critter/svg.js';
import { use3dRender, genomeOf } from '../critter/render3d.js';
import { elementInfo } from '../critter/types.js';
import { ROLE_INFO } from '../critter/roles.js';
import { t, loc } from '../i18n.js';

const props = defineProps({ instance: Object, size: { type: Number, default: 92 }, stats: { type: Boolean, default: true } });
const critter = computed(() => critterById(props.instance.id));
const svg = computed(() => critterSvg(critter.value, props.size));
// Icono 3D animado (marcha top1/top2) bajo demanda; mientras no exista, el SVG + spinner.
const { src: art3d, ready: art3dReady, pending: art3dPending } = use3dRender(() => genomeOf(props.instance));
const st = computed(() => statsAtLevel(critter.value, props.instance.level || 1, props.instance.alloc));
const free = computed(() => pointsFree(props.instance.level || 1, props.instance.alloc));
const rar = computed(() => RARITY_BY_KEY[critter.value.rarity]);
const el = computed(() => elementInfo(critter.value.element));
const role = computed(() => ROLE_INFO[critter.value.role]);

// Referencia de las barras (≈ valores fuertes de media partida; el endgame satura al 100%).
const CAP = { HP: 1200, ATK: 480, DEF: 300, SPD: 340 };
const w = (k) => Math.max(6, Math.min(100, Math.round(100 * st.value[k] / CAP[k]))) + '%';
</script>

<template>
  <div class="card" :style="{ '--el': el.color, '--el2': el.color2, '--rar': rar.color }">
    <span class="lv">{{ t('nv') }}{{ instance.level || 1 }}</span>
    <span class="rar-dot" :style="{ background: rar.color, boxShadow: '0 0 9px ' + rar.color }"></span>
    <span class="pts" v-if="free > 0" :title="t('puntos')">✦{{ free }}</span>
    <div class="portrait" :class="{ loading: art3dPending && !art3dReady }">
      <div class="aura"></div>
      <div class="cs" v-show="!art3dReady" v-html="svg"></div>
      <img v-show="art3dReady" class="cs3d" :src="art3d" alt="" />
    </div>
    <div class="nm">{{ displayName(instance, critter) }}</div>
    <div class="chips">
      <span class="chip el">{{ loc(el) }}</span>
      <span class="chip">{{ loc(role) }}</span>
      <span class="chip">{{ critter.flanks ? t('flanquea') : t('frontal') }}</span>
    </div>
    <div class="stats" v-if="stats">
      <div class="s hp"><span class="k">{{ t('statHP') }}</span><span class="bar"><i :style="{ width: w('HP') }"></i></span><span class="v">{{ st.HP }}</span></div>
      <div class="s atk"><span class="k">{{ t('statATK') }}</span><span class="bar"><i :style="{ width: w('ATK') }"></i></span><span class="v">{{ st.ATK }}</span></div>
      <div class="s def"><span class="k">{{ t('statDEF') }}</span><span class="bar"><i :style="{ width: w('DEF') }"></i></span><span class="v">{{ st.DEF }}</span></div>
      <div class="s spd"><span class="k">{{ t('statSPD') }}</span><span class="bar"><i :style="{ width: w('SPD') }"></i></span><span class="v">{{ st.SPD }}</span></div>
    </div>
  </div>
</template>

<style scoped>
/* Icono 3D que reemplaza al SVG cuando el render existe + spinner en la circunferencia. */
.cs3d{position:relative;z-index:2;width:100%;height:100%;object-fit:contain;filter:drop-shadow(0 4px 10px rgba(0,0,0,.5));animation:csfade .3s ease-out}
@keyframes csfade{from{opacity:0}to{opacity:1}}
.portrait.loading::after{content:'';position:absolute;inset:-4px;border-radius:50%;box-sizing:border-box;
  border:2px solid transparent;border-top-color:var(--el);border-right-color:var(--el);animation:csspin .85s linear infinite;z-index:3}
@keyframes csspin{to{transform:rotate(360deg)}}
</style>
