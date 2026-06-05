<script setup>
import { computed } from 'vue';
import { game } from '../game/state.js';
import { teamCount } from '../game/actions.js';
import { enemyLevel } from '../game/campaign.js';
import { t } from '../i18n.js';

const emit = defineEmits(['fight']);
const levels = computed(() => { const arr = []; for (let i = 1; i <= game.campaignMax + 3; i++) arr.push(i); return arr; });
function play (n) { if (n <= game.campaignMax) emit('fight', n); }
</script>

<template>
  <p class="hint" v-if="teamCount() === 0">{{ t('equipoVacio') }}</p>
  <div class="lvls">
    <button v-for="n in levels" :key="n" class="lvl"
            :class="{ locked: n > game.campaignMax, cleared: n < game.campaignMax }"
            :disabled="n > game.campaignMax" @click="play(n)">
      <span class="n">{{ n }}</span>
      <span class="st">{{ n > game.campaignMax ? '🔒' : t('nv') + ' ' + enemyLevel(n) }}</span>
    </button>
  </div>
</template>
