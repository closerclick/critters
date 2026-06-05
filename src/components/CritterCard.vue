<script setup>
import { computed } from 'vue';
import { critterById } from '../game/state.js';
import { statsAtLevel, RARITY_BY_KEY } from '../critter/forge.js';
import { critterSvg } from '../critter/svg.js';
import { ELEMENT_INFO } from '../critter/types.js';
import { ROLE_INFO } from '../critter/roles.js';
import { t, loc } from '../i18n.js';

const props = defineProps({ instance: Object, size: { type: Number, default: 84 }, stats: { type: Boolean, default: true } });
const critter = computed(() => critterById(props.instance.id));
const svg = computed(() => critterSvg(critter.value, props.size));
const st = computed(() => statsAtLevel(critter.value, props.instance.level || 1));
const rar = computed(() => RARITY_BY_KEY[critter.value.rarity]);
const el = computed(() => ELEMENT_INFO[critter.value.element]);
const role = computed(() => ROLE_INFO[critter.value.role]);
</script>

<template>
  <div class="card">
    <span class="lv">{{ t('nv') }}{{ instance.level || 1 }}</span>
    <span class="rar" :style="{ background: rar.color }" :title="loc(rar)"></span>
    <div class="cs" v-html="svg"></div>
    <div class="nm">{{ critter.name }}</div>
    <div class="chips">
      <span class="chip" :style="{ color: el.color, borderColor: el.color }">{{ loc(el) }}</span>
      <span class="chip">{{ loc(role) }}</span>
    </div>
    <div class="stats" v-if="stats">
      <div class="s"><span class="k">{{ t('statHP') }}</span><b>{{ st.HP }}</b></div>
      <div class="s"><span class="k">{{ t('statATK') }}</span><b>{{ st.ATK }}</b></div>
      <div class="s"><span class="k">{{ t('statDEF') }}</span><b>{{ st.DEF }}</b></div>
      <div class="s"><span class="k">{{ t('statSPD') }}</span><b>{{ st.SPD }}</b></div>
    </div>
  </div>
</template>
