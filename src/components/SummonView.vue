<script setup>
import { ref } from 'vue';
import { game } from '../game/state.js';
import { summon, SUMMON_COST } from '../game/actions.js';
import { t } from '../i18n.js';
import CritterCard from './CritterCard.vue';

const last = ref(null);
const err = ref('');
function doSummon () { const r = summon(); if (r.error === 'coins') { err.value = t('sinMonedas'); return; } err.value = ''; last.value = r.instance; }
</script>

<template>
  <div class="center">
    <p class="hint" style="text-align:center;max-width:320px">{{ t('invocarHint') }}</p>
    <CritterCard v-if="last" :instance="last" :size="120" />
    <p v-if="last" style="font-weight:800;color:var(--accent)">{{ t('nuevaCriatura') }}</p>
    <button class="btn" :disabled="game.wallet.coins < SUMMON_COST" @click="doSummon">{{ t('invocarBtn') }} · 🪙 {{ SUMMON_COST }}</button>
    <p v-if="err" class="hint" style="color:var(--bad)">{{ err }}</p>
  </div>
</template>
