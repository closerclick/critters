<script setup>
import { computed } from 'vue';
import { game } from '../game/state.js';
import { teamCount, isUnlocked } from '../game/actions.js';
import { allNodes, edges } from '../game/campaign.js';
import { t } from '../i18n.js';

const emit = defineEmits(['fight']);
const nodes = computed(() => allNodes(game.seed));
const nmap = computed(() => Object.fromEntries(nodes.value.map(n => [n.id, n])));
const E = computed(() => edges(game.seed));

const cleared = (id) => game.cleared.includes(id);
const unlocked = (id) => isUnlocked(id);
const access = (id) => cleared(id) || unlocked(id);
const X = (n) => (n.x * 100).toFixed(2);
const Y = (n) => (n.y * 100).toFixed(2);
function nodeCls (n) { return { core: n.id === 'core', boss: n.boss, cleared: cleared(n.id), open: unlocked(n.id) && !cleared(n.id), locked: !unlocked(n.id) && !cleared(n.id) }; }
function play (n) { if (unlocked(n.id)) emit('fight', n.id); }
</script>

<template>
  <p class="view-title">{{ t('campana') }}</p>
  <p class="hint" v-if="teamCount() === 0">{{ t('equipoVacio') }}</p>
  <div class="webwrap">
    <svg viewBox="0 0 100 100" class="web" preserveAspectRatio="xMidYMid meet">
      <line v-for="(e, i) in E" :key="i" :x1="X(nmap[e[0]])" :y1="Y(nmap[e[0]])" :x2="X(nmap[e[1]])" :y2="Y(nmap[e[1]])"
            class="thread" :class="{ on: access(e[0]) && access(e[1]) }" />
      <g v-for="n in nodes" :key="n.id" class="node" :class="nodeCls(n)" @click="play(n)">
        <circle :cx="X(n)" :cy="Y(n)" r="4" fill="transparent" />
        <circle :cx="X(n)" :cy="Y(n)" :r="n.id === 'core' ? 3.6 : (n.boss ? 3.7 : 2.9)" class="dot" />
        <text v-if="n.id !== 'core'" :x="X(n)" :y="Number(Y(n)) + 1" class="lab">{{ unlocked(n.id) || cleared(n.id) ? (n.boss ? '★' : n.diff) : '🔒' }}</text>
        <text v-else :x="X(n)" :y="Number(Y(n)) + 1.1" class="lab">◆</text>
      </g>
    </svg>
  </div>
</template>

<style scoped>
.webwrap{width:100%;max-width:560px;margin:0 auto}
.web{width:100%;height:auto;aspect-ratio:1;display:block}
.thread{stroke:rgba(167,139,250,.12);stroke-width:.5}
.thread.on{stroke:rgba(167,139,250,.5);stroke-width:.7}
.node{cursor:default}
.node .dot{stroke-width:.8}
.node .lab{font-family:var(--fmono);font-size:2.6px;text-anchor:middle;dominant-baseline:middle;fill:#e2e8f0;pointer-events:none}
.node.locked .dot{fill:#1a1633;stroke:rgba(148,163,184,.25)}
.node.locked .lab{fill:#6b6494}
.node.open{cursor:pointer}
.node.open .dot{fill:#241d44;stroke:var(--accent);filter:drop-shadow(0 0 2px var(--accent))}
.node.cleared{cursor:pointer}
.node.cleared .dot{fill:#14532d;stroke:var(--good)}
.node.core .dot{fill:#241d44;stroke:var(--cyan)}
.node.boss .dot{stroke:var(--gold)!important;stroke-width:1.1}
.node.boss .lab{fill:var(--gold)}
</style>
