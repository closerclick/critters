<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { game } from '../game/state.js';
import { teamCount, isUnlocked } from '../game/actions.js';
import { allNodes, edges, RING_GAP } from '../game/campaign.js';
import { elementInfo } from '../critter/types.js';
import { t, loc } from '../i18n.js';

const emit = defineEmits(['fight']);
const nodes = computed(() => allNodes(game.seed));
const nmap = computed(() => Object.fromEntries(nodes.value.map(n => [n.id, n])));
const E = computed(() => edges(game.seed));

const cleared = (id) => game.cleared.includes(id);
const unlocked = (id) => isUnlocked(id);
const access = (id) => cleared(id) || unlocked(id);
const nodeCls = (n) => ({ core: n.id === 'core', boss: n.boss, cleared: cleared(n.id), open: unlocked(n.id) && !cleared(n.id), locked: !unlocked(n.id) && !cleared(n.id) });

const NR = 22, BR = 26, CR = 28;     // radios de nodo (unidades de mundo)
const nodeR = (n) => (n.id === 'core' ? CR : (n.boss ? BR : NR));
const terrainColor = (n) => (n.terrain ? elementInfo(n.terrain).color : null);
const terrainShow = (n) => (n.terrain && access(n.id)) ? elementInfo(n.terrain).color : null;

// Vista paneable que LLENA todo el área: el viewBox toma el aspecto del contenedor
// (la dimensión menor muestra ~3.4 anillos; la mayor muestra más) → sin recorte ni
// franjas vacías. Se mide el SVG y se recalcula al redimensionar.
const BASE = 3.4 * RING_GAP;         // mundo visible en la dimensión MENOR
const svgEl = ref(null);
const vw = ref(BASE), vh = ref(BASE);
const panX = ref(0), panY = ref(0);
const viewBox = computed(() => `${(panX.value - vw.value / 2).toFixed(1)} ${(panY.value - vh.value / 2).toFixed(1)} ${vw.value.toFixed(1)} ${vh.value.toFixed(1)}`);
function measure () { const el = svgEl.value; if (!el) return; const r = el.getBoundingClientRect(); const m = Math.min(r.width, r.height) || 1; vw.value = BASE * ((r.width || m) / m); vh.value = BASE * ((r.height || m) / m); }

function recenter () {
  const open = nodes.value.filter(n => unlocked(n.id) && !cleared(n.id));
  const pts = open.length ? open : nodes.value.filter(n => cleared(n.id));
  if (pts.length) { panX.value = pts.reduce((s, n) => s + n.x, 0) / pts.length; panY.value = pts.reduce((s, n) => s + n.y, 0) / pts.length; }
  else { panX.value = 0; panY.value = 0; }
}
function onResize () { measure(); }
onMounted(() => { measure(); recenter(); window.addEventListener('resize', onResize); });
onUnmounted(() => window.removeEventListener('resize', onResize));

// Pan por puntero; tap (sin arrastrar) sobre un nodo = pelear.
let drag = null, movedFlag = false;
function onDown (e) { drag = { sx: e.clientX, sy: e.clientY, px: panX.value, py: panY.value }; movedFlag = false; }
function onMove (e) {
  if (!drag) return;
  const w = svgEl.value.clientWidth || 1, k = vw.value / w;
  const dx = e.clientX - drag.sx, dy = e.clientY - drag.sy;
  if (Math.hypot(dx, dy) > 4) movedFlag = true;
  panX.value = drag.px - dx * k; panY.value = drag.py - dy * k;
}
function onUp () { drag = null; }
function play (n) { if (movedFlag) { movedFlag = false; return; } if (unlocked(n.id)) emit('fight', n.id); }
</script>

<template>
  <p class="view-title">{{ t('campana') }}</p>
  <p class="hint" v-if="teamCount() === 0">{{ t('equipoVacio') }}</p>
  <div class="webwrap">
    <svg ref="svgEl" :viewBox="viewBox" class="web" preserveAspectRatio="xMidYMid meet"
         @pointerdown="onDown" @pointermove="onMove" @pointerup="onUp" @pointercancel="onUp">
      <line v-for="(e, i) in E" :key="i" :x1="nmap[e[0]].x" :y1="nmap[e[0]].y" :x2="nmap[e[1]].x" :y2="nmap[e[1]].y"
            class="thread" :class="{ on: access(e[0]) && access(e[1]) }" />
      <g v-for="n in nodes" :key="n.id" class="node" :class="nodeCls(n)" @click="play(n)">
        <circle v-if="terrainShow(n)" :cx="n.x" :cy="n.y" :r="nodeR(n) + 11" :fill="terrainShow(n)" opacity="0.16" />
        <circle :cx="n.x" :cy="n.y" :r="nodeR(n) + 9" fill="transparent" />
        <circle :cx="n.x" :cy="n.y" :r="nodeR(n)" class="dot" :style="terrainShow(n) ? { stroke: terrainShow(n) } : {}" />
        <text v-if="n.id !== 'core'" :x="n.x" :y="n.y + 6" class="lab">{{ access(n.id) ? (n.boss ? '★' : n.diff) : '🔒' }}</text>
        <text v-else :x="n.x" :y="n.y + 7" class="lab">◆</text>
      </g>
    </svg>
    <button class="recenter" @click="recenter" title="centrar">⊙</button>
  </div>
  <p class="hint web-hint">{{ t('webHint') }}</p>
</template>

<style scoped>
.webwrap{position:relative;width:100%;height:calc(100dvh - 210px);min-height:300px;margin:0 auto}
.web{width:100%;height:100%;display:block;touch-action:none;cursor:grab;
  background:radial-gradient(circle at 50% 50%, rgba(167,139,250,.06), transparent 70%);border-radius:16px}
.web:active{cursor:grabbing}
.thread{stroke:rgba(167,139,250,.12);stroke-width:3}
.thread.on{stroke:rgba(167,139,250,.5);stroke-width:4}
.node{cursor:default}
.node .dot{stroke-width:5;fill:#1a1633}
.node .lab{font-family:var(--fmono);font-size:18px;text-anchor:middle;dominant-baseline:middle;fill:#e2e8f0;pointer-events:none}
.node.locked .dot{fill:#1a1633;stroke:rgba(148,163,184,.25)}
.node.locked .lab{fill:#6b6494}
.node.open{cursor:pointer}
.node.open .dot{fill:#241d44;stroke:var(--accent);filter:drop-shadow(0 0 6px var(--accent))}
.node.cleared{cursor:pointer}
.node.cleared .dot{fill:#14532d;stroke:var(--good)}
.node.core .dot{fill:#241d44;stroke:var(--cyan)}
.node.boss .dot{stroke:var(--gold)!important;stroke-width:7}
.node.boss .lab{fill:var(--gold)}
.recenter{position:absolute;right:10px;bottom:10px;width:38px;height:38px;border-radius:11px;border:1px solid var(--line2);
  background:rgba(20,16,40,.85);color:var(--cyan);font-size:18px;backdrop-filter:blur(4px)}
.web-hint{text-align:center;margin-top:6px}
</style>
