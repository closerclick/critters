<script setup>
import { computed } from 'vue';
import { critterById } from '../game/state.js';
import { statsAtLevel, RARITY_BY_KEY } from '../critter/forge.js';
import { critterSvg } from '../critter/svg.js';
import { ELEMENT_INFO } from '../critter/types.js';
import { ROLE_INFO } from '../critter/roles.js';
import { t, loc } from '../i18n.js';

const props = defineProps({ instance: Object, size: { type: Number, default: 92 }, stats: { type: Boolean, default: true } });
const critter = computed(() => critterById(props.instance.id));
const svg = computed(() => critterSvg(critter.value, props.size));
const st = computed(() => statsAtLevel(critter.value, props.instance.level || 1));
const rar = computed(() => RARITY_BY_KEY[critter.value.rarity]);
const el = computed(() => ELEMENT_INFO[critter.value.element]);
const role = computed(() => ROLE_INFO[critter.value.role]);

const CAP = { HP: 1400, ATK: 320, DEF: 320, SPD: 220 };
const w = (k) => Math.max(6, Math.min(100, Math.round(100 * st.value[k] / CAP[k]))) + '%';
</script>

<template>
  <div class="card" :style="{ '--el': el.color, '--el2': el.color2, '--rar': rar.color }">
    <span class="lv">{{ t('nv') }}{{ instance.level || 1 }}</span>
    <span class="rar-dot" :style="{ background: rar.color, boxShadow: '0 0 9px ' + rar.color }"></span>
    <div class="portrait"><div class="aura"></div><div class="cs" v-html="svg"></div></div>
    <div class="nm">{{ critter.name }}</div>
    <div class="chips">
      <span class="chip el">{{ loc(el) }}</span>
      <span class="chip">{{ loc(role) }}</span>
    </div>
    <div class="stats" v-if="stats">
      <div class="s hp"><span class="k">{{ t('statHP') }}</span><span class="bar"><i :style="{ width: w('HP') }"></i></span><span class="v">{{ st.HP }}</span></div>
      <div class="s atk"><span class="k">{{ t('statATK') }}</span><span class="bar"><i :style="{ width: w('ATK') }"></i></span><span class="v">{{ st.ATK }}</span></div>
      <div class="s def"><span class="k">{{ t('statDEF') }}</span><span class="bar"><i :style="{ width: w('DEF') }"></i></span><span class="v">{{ st.DEF }}</span></div>
      <div class="s spd"><span class="k">{{ t('statSPD') }}</span><span class="bar"><i :style="{ width: w('SPD') }"></i></span><span class="v">{{ st.SPD }}</span></div>
    </div>
  </div>
</template>
