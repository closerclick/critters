<script setup>
import { ref, reactive, computed, onMounted, onUnmounted, watch } from 'vue';
import { critterById } from '../game/state.js';
import { critterSvg } from '../critter/svg.js';
import { COLS, ROWS } from '../battle/engine.js';
import * as sfx from '../sfx.js';
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
  else if (ev.t === 'attack' || ev.t === 'thorns') { if (u) { u.hp = Math.max(0, u.hp - (ev.dmg || 0)); if (!silent) { showDmg(u, ev.dmg, ev.crit ? 'crit' : ''); if (ev.t === 'attack') sfx.hit(ev.crit); } } }
  else if (ev.t === 'heal' || ev.t === 'lifesteal' || ev.t === 'regen') { if (u) { u.hp = Math.min(u.maxHp, u.hp + (ev.heal || 0)); if (!silent) { showDmg(u, '+' + (ev.heal || 0), 'heal'); if (ev.t === 'heal') sfx.heal(); } } }
  else if (ev.t === 'active') { if (!silent) sfx.active(); }
  else if (ev.t === 'faint') { if (u) { u.hp = 0; u.dead = true; if (!silent) sfx.faint(); } }
}
function step () { const log = res().log; if (i >= log.length) { finish(); return; } applyEv(log[i++]); }
function finish () {
  clearInterval(timer); timer = null; finished.value = true;
  if (props.payload.win) { sfx.victory(); if (props.payload.captured) setTimeout(() => sfx.capture(), 500); }
  else sfx.defeat();
}
function skip () { if (finished.value) return; const log = res().log; while (i < log.length) applyEv(log[i++], true); finish(); }
function start () { initUnits(); finished.value = false; i = 0; clearInterval(timer); const ms = Math.max(60, Math.min(260, Math.round(8000 / Math.max(1, res().log.length)))); timer = setInterval(step, ms); }

onMounted(start);
onUnmounted(() => { alive = false; clearInterval(timer); });
watch(() => props.payload, start);

const outcome = computed(() => props.payload.win ? 'win' : (res().winner === 'draw' ? 'draw' : 'lose'));
function next () { if (props.payload.nextNode) emit('next', props.payload.nextNode); }

// Resumen al terminar: por cada critter de tu equipo (lado 0), daño hecho/recibido
// y vida restante, más el daño total recibido por el equipo. Se computa del log.
const summary = computed(() => {
  if (!finished.value) return null;
  const dealt = {}, taken = {};
  for (const e of res().log) {
    if (e.t === 'attack' || e.t === 'thorns') {
      if (e.by) dealt[e.by] = (dealt[e.by] || 0) + (e.dmg || 0);
      if (e.target) taken[e.target] = (taken[e.target] || 0) + (e.dmg || 0);
    }
  }
  const xp = props.payload.xp || {};
  const mine = res().units.filter(u => u.side === 0).map(u => ({
    name: u.name, hp: Math.max(0, U[u.uid] ? U[u.uid].hp : 0), maxHp: u.maxHp,
    dealt: dealt[u.uid] || 0, taken: taken[u.uid] || 0, dead: U[u.uid] && U[u.uid].dead,
    xp: xp[u.uid] || null,
  }));
  return { mine, totalTaken: mine.reduce((s, m) => s + m.taken, 0) };
});
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

    <div class="blog" v-if="!finished">{{ t('ciclos') }}: {{ res().cycles }}</div>
  </div>

  <div class="result-modal" v-if="finished">
    <div class="result-card" :class="outcome">
      <div class="rc-title" :class="outcome">{{ outcome === 'win' ? t('victoria') : (outcome === 'lose' ? t('derrota') : t('empate')) }}</div>
      <div class="rc-rewards" v-if="payload.win">
        <span v-if="payload.reward" class="rc-chip coin">+🪙 {{ payload.reward.coins }}</span>
        <span v-if="payload.reward" class="rc-chip frag">+🔹 {{ payload.reward.frags }}</span>
        <span v-if="payload.captured" class="rc-chip cap">✨ {{ critterById(payload.captured.id).name }}</span>
      </div>

      <div class="rtable" v-if="summary">
        <div class="rt-head">
          <span class="rt-name">{{ t('tuEquipo') }}</span>
          <span>❤ {{ t('lblVida') }}</span>
          <span>⚔ {{ t('lblDanio') }}</span>
          <span>🛡 {{ t('lblRecib') }}</span>
        </div>
        <div class="rt-row" v-for="(m, i) in summary.mine" :key="i" :class="{ dead: m.dead }">
          <span class="rt-name">{{ m.name }}<small v-if="m.xp" class="rt-xp">+{{ m.xp.gained }} XP{{ m.xp.up ? ' · ⬆ ' + t('nv') + m.xp.level : '' }}</small></span>
          <span class="rt-hp">{{ m.hp }}/{{ m.maxHp }}</span>
          <span class="rt-d">{{ m.dealt }}</span>
          <span class="rt-t">{{ m.taken }}</span>
        </div>
        <div class="rt-total">🛡 {{ t('dRecibido') }}: <b>{{ summary.totalTaken }}</b></div>
      </div>

      <div class="rc-btns">
        <button class="btn sec" @click="start">↻ {{ t('repetir') }}</button>
        <button v-if="payload.win && payload.nextNode" class="btn" @click="next">{{ t('siguiente') }} →</button>
        <button class="btn sec" @click="emit('close')">{{ t('cerrar') }}</button>
      </div>
    </div>
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
/* ---- modal de resultado ---- */
.result-modal{position:fixed;inset:0;z-index:35;display:flex;align-items:center;justify-content:center;padding:18px;
  background:rgba(2,4,12,.66);backdrop-filter:blur(5px);animation:fade .25s ease-out}
@keyframes fade{from{opacity:0}to{opacity:1}}
.result-card{width:100%;max-width:380px;background:linear-gradient(180deg,var(--panel2),var(--panel));border:1px solid var(--line2);
  border-radius:18px;padding:18px 16px;box-shadow:0 22px 60px rgba(0,0,0,.65);text-align:center;animation:pop .32s cubic-bezier(.2,1.3,.4,1)}
@keyframes pop{from{opacity:0;transform:scale(.9) translateY(8px)}to{opacity:1;transform:scale(1) translateY(0)}}
.result-card.win{border-color:color-mix(in srgb,var(--good) 45%,var(--line2))}
.result-card.lose{border-color:color-mix(in srgb,var(--bad) 45%,var(--line2))}
.rc-title{font-family:var(--fdisplay);font-weight:800;font-size:30px;margin-bottom:8px}
.rc-title.win{color:var(--good);text-shadow:0 0 26px rgba(74,222,128,.5)}
.rc-title.lose{color:var(--bad)} .rc-title.draw{color:var(--muted)}
.rc-rewards{display:flex;gap:6px;justify-content:center;flex-wrap:wrap;margin-bottom:12px}
.rc-chip{font-family:var(--fmono);font-size:12px;font-weight:700;padding:4px 10px;border-radius:999px;border:1px solid var(--line2);background:rgba(167,139,250,.08)}
.rc-chip.coin{color:var(--gold)} .rc-chip.frag{color:var(--cyan)} .rc-chip.cap{color:#e9d5ff}
.rtable{border:1px solid var(--line);border-radius:12px;overflow:hidden;margin-bottom:14px;background:rgba(7,6,17,.35)}
.rt-head,.rt-row{display:grid;grid-template-columns:1fr 64px 52px 56px;align-items:center;gap:4px;padding:7px 10px}
.rt-head{font-family:var(--fdisplay);font-size:10.5px;text-transform:uppercase;letter-spacing:.04em;color:var(--muted);background:rgba(167,139,250,.08);border-bottom:1px solid var(--line)}
.rt-head span:not(.rt-name),.rt-row span:not(.rt-name){text-align:right;font-variant-numeric:tabular-nums}
.rt-row{font-family:var(--fmono);font-size:12px;border-top:1px solid rgba(167,139,250,.06)}
.rt-row .rt-name{font-family:var(--fbody);font-weight:700;text-align:left;display:flex;flex-direction:column;align-items:flex-start;line-height:1.15;min-width:0}
.rt-row .rt-name > small{font-family:var(--fmono);font-size:9.5px;font-weight:400;color:var(--cyan);white-space:nowrap}
.rt-row .rt-hp{color:var(--good)} .rt-row .rt-d{color:var(--gold)} .rt-row .rt-t{color:#cbb6ff}
.rt-row.dead{opacity:.55} .rt-row.dead .rt-hp{color:var(--bad)}
.rt-total{font-family:var(--fmono);font-size:12px;text-align:center;padding:8px 10px;border-top:1px solid var(--line);background:rgba(167,139,250,.05)}
.rt-total b{color:var(--bad)}
.rc-btns{display:flex;gap:8px;justify-content:center;flex-wrap:wrap}
</style>
