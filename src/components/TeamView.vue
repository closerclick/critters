<script setup>
import { ref, computed } from 'vue';
import { game, instanceByUid, critterById } from '../game/state.js';
import { placeInSlot, clearSlot, teamCount } from '../game/actions.js';
import { critterSvg } from '../critter/svg.js';
import { t } from '../i18n.js';
import CritterCard from './CritterCard.vue';

const sel = ref(null);
const cellUid = (slot) => game.team[slot];
function cellSvg (slot) { const uid = cellUid(slot); if (!uid) return ''; const inst = instanceByUid(uid); return inst ? critterSvg(critterById(inst.id), 58) : ''; }
function cellLevel (slot) { const uid = cellUid(slot); const inst = uid && instanceByUid(uid); return inst ? inst.level : null; }
function tapCell (slot) {
  const uid = cellUid(slot);
  if (uid) { if (sel.value && sel.value !== uid) { placeInSlot(slot, sel.value); sel.value = null; } else clearSlot(slot); }
  else if (sel.value) { placeInSlot(slot, sel.value); sel.value = null; }
}
function tapRoster (uid) { sel.value = sel.value === uid ? null : uid; }
const onTeam = computed(() => new Set(game.team.filter(Boolean)));
</script>

<template>
  <p class="hint">{{ t('elegiSlot') }}</p>
  <div class="tg-wrap">
    <div class="tg-label">▲ {{ t('rival') }}</div>
    <div class="tg">
      <div v-for="slot in 9" :key="slot - 1" class="cell"
           :class="{ has: cellUid(slot - 1), col1: (slot - 1) % 3 === 1, sel: sel && cellUid(slot - 1) === sel }"
           @click="tapCell(slot - 1)">
        <div v-if="cellUid(slot - 1)" v-html="cellSvg(slot - 1)"></div>
        <span v-if="cellLevel(slot - 1)" class="clv">{{ t('nv') }}{{ cellLevel(slot - 1) }}</span>
      </div>
    </div>
    <div class="tg-label" style="margin-top:2px">{{ teamCount() }}/5</div>
  </div>
  <div class="grid-cards">
    <div v-for="inst in game.collection" :key="inst.uid" @click="tapRoster(inst.uid)"
         :style="{ outline: sel === inst.uid ? '2px solid var(--accent)' : '', borderRadius: '14px', opacity: onTeam.has(inst.uid) && sel !== inst.uid ? 0.55 : 1 }">
      <CritterCard :instance="inst" :size="68" :stats="false" />
    </div>
  </div>
</template>
