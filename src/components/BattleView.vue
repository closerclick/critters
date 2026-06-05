<script setup>
import { ref, reactive, computed, onMounted, onUnmounted, watch } from 'vue';
import { critterById } from '../game/state.js';
import { critterSvg } from '../critter/svg.js';
import { COLS, ROWS } from '../battle/engine.js';
import { t } from '../i18n.js';

const props = defineProps({ payload: Object });
const emit = defineEmits(['close', 'next']);

const U = reactive({});           // uid → estado vivo
const list = ref([]);             // uids para render
const finished = ref(false);
let timer = null, i = 0, alive = true;

const res = () => props.payload.result;
function initUnits () {
  for (const k in U) delete U[k];
  for (const u of res().units) U[u.uid] = { ...u, hp: u.maxHp, dead: false, flash: false, dmg: null, dmgClass: '' };
  list.value = res().units.map(u => u.uid);
}
const svgFor = (u) => critterSvg(critterById(u.id), 40);
const leftOf = (u) => (u.col / COLS * 100) + '%';
const topOf = (u) => (u.row / ROWS * 100) + '%';

function showDmg (u, val, cls) { u.dmg = val; u.dmgClass = cls; u.flash = true; setTimeout(() => { if (alive) u.flash = false; }, 220); }
function applyEv (ev, silent) {
  const u = ev.target && U[ev.target], by = ev.by && U[ev.by];
  if (ev.t === 'move') { if (by) { by.row = ev.r; by.col = ev.c; } }
  else if (ev.t === 'attack' || ev.t === 'thorns') { if (u) { u.hp = Math.max(0, u.hp - (ev.dmg || 0)); if (!silent) showDmg(u, ev.dmg, ev.crit ? 'crit' : ''); } }
  else if (ev.t === 'heal' || ev.t === 'lifesteal' || ev.t === 'regen') { if (u) { u.hp = Math.min(u.maxHp, u.hp + (ev.heal || 0)); if (!silent) showDmg(u, '+' + (ev.heal || 0), 'heal'); } }
  else if (ev.t === 'faint') { if (u) { u.hp = 0; u.dead = true; } }
}
function step () { const log = res().log; if (i >= log.length) { finish(); return; } applyEv(log[i++]); }
function finish () { clearInterval(timer); timer = null; finished.value = true; }
function skip () { if (finished.value) return; const log = res().log; while (i < log.length) applyEv(log[i++], true); finish(); }
function start () { initUnits(); finished.value = false; i = 0; clearInterval(timer); const ms = Math.max(60, Math.min(260, Math.round(8000 / Math.max(1, res().log.length)))); timer = setInterval(step, ms); }

onMounted(start);
onUnmounted(() => { alive = false; clearInterval(timer); });
watch(() => props.payload, start);

const outcome = computed(() => props.payload.win ? 'win' : (res().winner === 'draw' ? 'draw' : 'lose'));
function next () { if (props.payload.nextNode) emit('next', props.payload.nextNode); }
</script>

<template>
  <div class="battle">
    <closer-click-back class="battle-back" style="--cc-back-size:32px;color:var(--text)"></closer-click-back>
    <h2>{{ t('campana') }} · {{ payload.boss ? 'BOSS ★' : (t('nivel') + ' ' + payload.level) }}</h2>
    <div class="arena" @click="skip">
      <div class="field">
        <div class="zone you"></div><div class="zone foe"></div>
        <div v-for="uid in list" :key="uid" class="fu" :class="{ dead: U[uid].dead, hit: U[uid].flash, foe: U[uid].side === 1 }"
             :style="{ left: leftOf(U[uid]), top: topOf(U[uid]) }">
          <span v-if="U[uid].flash && U[uid].dmg != null" class="dmgnum" :class="U[uid].dmgClass">{{ U[uid].dmg }}</span>
          <div class="fu-svg" v-html="svgFor(U[uid])"></div>
          <div class="hpbar" :class="{ low: U[uid].hp / U[uid].maxHp < 0.35 }"><i :style="{ width: (100 * U[uid].hp / U[uid].maxHp) + '%' }"></i></div>
        </div>
      </div>
      <div class="field-tags"><span>◀ {{ t('tuEquipo') }}</span><span>{{ t('rival') }} ▶</span></div>
    </div>

    <div class="bresult" v-if="finished">
      <div class="big" :class="outcome === 'win' ? 'win' : (outcome === 'lose' ? 'lose' : '')">{{ outcome === 'win' ? t('victoria') : (outcome === 'lose' ? t('derrota') : t('empate')) }}</div>
      <p class="hint" v-if="payload.win && payload.reward">+🪙{{ payload.reward.coins }} · +🔹{{ payload.reward.frags }}</p>
      <p class="hint" v-if="payload.captured">✨ {{ t('capturaste') }} {{ critterById(payload.captured.id).name }}</p>
      <div class="row-btns">
        <button class="btn sec" @click="start">↻ {{ t('repetir') }}</button>
        <button v-if="payload.win && payload.nextNode" class="btn" @click="next">{{ t('siguiente') }} →</button>
        <button class="btn sec" @click="emit('close')">{{ t('cerrar') }}</button>
      </div>
    </div>
    <div class="blog" v-else>{{ t('ciclos') }}: {{ res().cycles }}</div>
  </div>
</template>

<style scoped>
.arena{flex:1 1 auto;display:flex;flex-direction:column;justify-content:center;gap:8px;min-height:0}
.field{position:relative;width:100%;aspect-ratio:8/3;border-radius:14px;border:1px solid var(--line);overflow:hidden;
  background:linear-gradient(90deg, rgba(124,58,237,.10) 0 37.5%, transparent 37.5% 62.5%, rgba(56,225,214,.10) 62.5% 100%),
  repeating-linear-gradient(90deg, transparent 0 calc(12.5% - 1px), rgba(167,139,250,.10) calc(12.5% - 1px) 12.5%),
  repeating-linear-gradient(0deg, transparent 0 calc(33.333% - 1px), rgba(167,139,250,.10) calc(33.333% - 1px) 33.333%)}
.zone{position:absolute;top:0;bottom:0;width:37.5%;pointer-events:none}
.fu{position:absolute;width:12.5%;height:33.333%;transition:left .28s ease, top .28s ease;display:flex;flex-direction:column;align-items:center;justify-content:center}
.fu-svg{width:84%;display:flex;align-items:center;justify-content:center;filter:drop-shadow(0 2px 5px rgba(0,0,0,.6))}
.fu-svg :deep(svg){width:100%;height:auto;transform:rotate(90deg)}      /* jugador mira a la derecha (al enemigo) */
.fu.foe .fu-svg :deep(svg){transform:rotate(-90deg)}                    /* enemigo mira a la izquierda */
.fu.dead{opacity:.25;filter:grayscale(1)}
.fu.hit .fu-svg{transform:scale(1.14)}
.hpbar{width:80%;height:4px;background:rgba(7,6,17,.85);border-radius:3px;overflow:hidden;margin-top:1px}
.hpbar i{display:block;height:100%;background:linear-gradient(90deg,#4ade80,#a3e635);transition:width .22s}
.hpbar.low i{background:linear-gradient(90deg,#ff5d6c,#fb923c)}
.dmgnum{position:absolute;top:-2px;font-family:var(--fdisplay);font-weight:900;font-size:14px;color:#fff;text-shadow:0 2px 6px #000;pointer-events:none;animation:rise .7s ease-out forwards;z-index:4}
.dmgnum.crit{color:var(--gold);font-size:17px}
.dmgnum.heal{color:#86efac}
@keyframes rise{0%{opacity:0;transform:translateY(5px)}25%{opacity:1}100%{opacity:0;transform:translateY(-16px)}}
.field-tags{display:flex;justify-content:space-between;font-family:var(--fdisplay);font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.12em;padding:0 4px}
</style>
