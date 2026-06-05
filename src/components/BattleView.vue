<script setup>
import { ref, reactive, computed, onMounted, onUnmounted, watch } from 'vue';
import { critterById } from '../game/state.js';
import { critterSvg } from '../critter/svg.js';
import { t } from '../i18n.js';

const props = defineProps({ payload: Object });
const emit = defineEmits(['close', 'next']);

const unitsMap = reactive({});
const finished = ref(false);
let timer = null, i = 0;

function res () { return props.payload.result; }
function initUnits () {
  for (const k in unitsMap) delete unitsMap[k];
  for (const u of [...res().teams.A, ...res().teams.B]) unitsMap[u.uid] = { ...u, hp: u.maxHp, dead: false, flash: false, dmg: null, dmgClass: '' };
}
function svgFor (u) { return critterSvg(critterById(u.id), 42); }
function cellOf (side, slot) { return unitsMap[side + ':' + slot]; }

function showDmg (u, val, cls) { u.dmg = val; u.dmgClass = cls; u.flash = true; setTimeout(() => { u.flash = false; }, 200); }
function applyEv (ev, silent) {
  const tgt = ev.target && unitsMap[ev.target];
  if (ev.t === 'attack' || ev.t === 'thorns') { if (tgt) { tgt.hp = Math.max(0, tgt.hp - (ev.dmg || 0)); if (!silent) showDmg(tgt, ev.dmg, ev.crit ? 'crit' : ''); } }
  else if (ev.t === 'heal' || ev.t === 'lifesteal' || ev.t === 'regen') { if (tgt) { tgt.hp = Math.min(tgt.maxHp, tgt.hp + (ev.heal || 0)); if (!silent) showDmg(tgt, '+' + (ev.heal || 0), 'heal'); } }
  else if (ev.t === 'faint') { if (tgt) { tgt.hp = 0; tgt.dead = true; } }
}
function step () {
  const log = res().log;
  if (i >= log.length) { finish(); return; }
  applyEv(log[i++]);
}
function finish () { clearInterval(timer); timer = null; finished.value = true; }
function skip () { if (finished.value) return; const log = res().log; while (i < log.length) applyEv(log[i++], true); finish(); }
function start () {
  initUnits(); finished.value = false; i = 0; clearInterval(timer);
  const ms = Math.max(70, Math.min(320, Math.round(9000 / Math.max(1, res().log.length))));
  timer = setInterval(step, ms);
}

onMounted(start);
onUnmounted(() => clearInterval(timer));
watch(() => props.payload, start);

const outcome = computed(() => props.payload.win ? 'win' : (res().winner === 'draw' ? 'draw' : 'lose'));
function next () { emit('next', (props.payload.level || 1) + 1); }
</script>

<template>
  <div class="battle">
    <closer-click-back class="battle-back" style="--cc-back-size:32px;color:var(--text)" @click="emit('close')"></closer-click-back>
    <h2>{{ t('campana') }} · {{ t('nivel') }} {{ payload.level }}</h2>
    <div class="arena" @click="skip">
      <div class="side-label">▲ {{ t('rival') }}</div>
      <div class="bgrid enemy">
        <div v-for="slot in 9" :key="'b' + (slot - 1)" class="unit"
             :class="{ empty: !cellOf(1, slot - 1), dead: cellOf(1, slot - 1) && cellOf(1, slot - 1).dead, hit: cellOf(1, slot - 1) && cellOf(1, slot - 1).flash }">
          <template v-if="cellOf(1, slot - 1)">
            <span v-if="cellOf(1, slot - 1).flash && cellOf(1, slot - 1).dmg != null" class="dmgnum" :class="cellOf(1, slot - 1).dmgClass">{{ cellOf(1, slot - 1).dmg }}</span>
            <div v-html="svgFor(cellOf(1, slot - 1))"></div>
            <div class="hpbar" :class="{ low: cellOf(1, slot - 1).hp / cellOf(1, slot - 1).maxHp < 0.35 }"><i :style="{ width: (100 * cellOf(1, slot - 1).hp / cellOf(1, slot - 1).maxHp) + '%' }"></i></div>
          </template>
        </div>
      </div>
      <div class="bgrid">
        <div v-for="slot in 9" :key="'a' + (slot - 1)" class="unit"
             :class="{ empty: !cellOf(0, slot - 1), dead: cellOf(0, slot - 1) && cellOf(0, slot - 1).dead, hit: cellOf(0, slot - 1) && cellOf(0, slot - 1).flash }">
          <template v-if="cellOf(0, slot - 1)">
            <span v-if="cellOf(0, slot - 1).flash && cellOf(0, slot - 1).dmg != null" class="dmgnum" :class="cellOf(0, slot - 1).dmgClass">{{ cellOf(0, slot - 1).dmg }}</span>
            <div v-html="svgFor(cellOf(0, slot - 1))"></div>
            <div class="hpbar" :class="{ low: cellOf(0, slot - 1).hp / cellOf(0, slot - 1).maxHp < 0.35 }"><i :style="{ width: (100 * cellOf(0, slot - 1).hp / cellOf(0, slot - 1).maxHp) + '%' }"></i></div>
          </template>
        </div>
      </div>
      <div class="side-label">▼ {{ t('tuEquipo') }}</div>
    </div>

    <div class="bresult" v-if="finished">
      <div class="big" :class="outcome === 'win' ? 'win' : (outcome === 'lose' ? 'lose' : '')">
        {{ outcome === 'win' ? t('victoria') : (outcome === 'lose' ? t('derrota') : t('empate')) }}
      </div>
      <p class="hint" v-if="payload.win && payload.reward">+🪙{{ payload.reward.coins }} · +🔹{{ payload.reward.frags }}</p>
      <p class="hint" v-if="payload.captured">✨ {{ t('capturaste') }} {{ critterById(payload.captured.id).name }}</p>
      <div class="row-btns">
        <button class="btn sec" @click="start">↻ {{ t('repetir') }}</button>
        <button v-if="payload.win" class="btn" @click="next">{{ t('siguiente') }} →</button>
        <button class="btn sec" @click="emit('close')">{{ t('cerrar') }}</button>
      </div>
    </div>
    <div class="blog" v-else>{{ t('rondas') }}: {{ res().rounds }}</div>
  </div>
</template>
