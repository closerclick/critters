<script setup>
import { ref, reactive, computed, onUnmounted } from 'vue';
import { game, instanceByUid, critterById, persist } from '../game/state.js';
import { placeInSlot, clearSlot, teamCount, setActiveLineup, createLineup, renameLineup, deleteLineup } from '../game/actions.js';
import { openCritter } from '../ui.js';
import { critterSvg } from '../critter/svg.js';
import { elementInfo } from '../critter/types.js';
import { t } from '../i18n.js';

const drag = reactive({ active: false, uid: null, from: 'bench', fromSlot: -1, x: 0, y: 0, pending: null });
const overSlot = ref(-1);

const cellUid = (slot) => game.team[slot];
function critterFor (uid) { const inst = instanceByUid(uid); return inst ? critterById(inst.id) : null; }
function svgFor (uid, size) { const c = critterFor(uid); return c ? critterSvg(c, size) : ''; }
function elColor (uid) { const c = critterFor(uid); return c ? elementInfo(c.element).color : 'var(--line)'; }
function levelOf (uid) { const i = instanceByUid(uid); return i ? i.level : null; }
const bench = computed(() => { const on = new Set(game.team.filter(Boolean)); return game.collection.filter(i => !on.has(i.uid)); });

// Alineaciones: cambiar / crear / renombrar / borrar (una araña puede estar en varias).
const activeName = computed(() => { const l = game.lineups.find(x => x.id === game.activeLineup); return l ? l.name : ''; });
const countOf = (l) => l.team.filter(Boolean).length;
function onPickLineup (e) { setActiveLineup(e.target.value); }
function onRenameLineup (e) { renameLineup(game.activeLineup, e.target.value); }
function onNewLineup () { createLineup(); }
function onDeleteLineup () { deleteLineup(game.activeLineup); }

function onDown (e, uid, from, fromSlot) {
  if (!uid) return;
  e.preventDefault();   // evita iniciar selección de texto al arrastrar
  drag.pending = { uid, from, fromSlot, sx: e.clientX, sy: e.clientY };
  drag.x = e.clientX; drag.y = e.clientY;
  window.addEventListener('pointermove', onMove, { passive: false });
  window.addEventListener('pointerup', onUp);
}
function onMove (e) {
  if (!drag.pending) return;
  drag.x = e.clientX; drag.y = e.clientY;
  if (!drag.active) {
    if (Math.hypot(e.clientX - drag.pending.sx, e.clientY - drag.pending.sy) < 8) return;
    drag.active = true; drag.uid = drag.pending.uid; drag.from = drag.pending.from; drag.fromSlot = drag.pending.fromSlot;
  }
  e.preventDefault();
  const el = document.elementFromPoint(e.clientX, e.clientY);
  const cell = el && el.closest && el.closest('.tg-cell');
  overSlot.value = cell ? Number(cell.dataset.slot) : -1;
}
function onUp (e) {
  window.removeEventListener('pointermove', onMove);
  window.removeEventListener('pointerup', onUp);
  if (drag.active) {
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const cell = el && el.closest && el.closest('.tg-cell');
    if (cell) drop(Number(cell.dataset.slot));
    else if (drag.from === 'slot') clearSlot(drag.fromSlot);   // soltar fuera = quitar del equipo
  } else if (drag.pending) {
    openCritter(drag.pending.uid);   // tap (sin arrastrar) = abrir perfil/config
  }
  reset();
}
function reset () { drag.active = false; drag.uid = null; drag.from = 'bench'; drag.fromSlot = -1; drag.pending = null; overSlot.value = -1; }
onUnmounted(() => { window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); });
function drop (targetSlot) {
  const uid = drag.uid, occupant = game.team[targetSlot];
  if (uid === occupant) return;
  if (drag.from === 'slot') { game.team[drag.fromSlot] = occupant || null; game.team[targetSlot] = uid; persist(); }
  else { if (occupant) game.team[targetSlot] = null; placeInSlot(targetSlot, uid); }
}
</script>

<template>
  <div class="lu-bar">
    <select class="lu-select" :value="game.activeLineup" @change="onPickLineup">
      <option v-for="l in game.lineups" :key="l.id" :value="l.id">{{ l.name }} ({{ countOf(l) }}/5)</option>
    </select>
    <input class="lu-name" :value="activeName" @change="onRenameLineup" maxlength="24" :placeholder="t('alineacion')" />
    <button class="lu-btn" @click="onNewLineup" :title="t('nueva')">＋</button>
    <button class="lu-btn" @click="onDeleteLineup" :disabled="game.lineups.length <= 1" title="🗑">🗑</button>
  </div>
  <p class="hint">{{ t('elegiSlot') }}</p>

  <div class="tg-wrap">
    <div class="side-label">▲ {{ t('rival') }}</div>
    <div class="tg">
      <div v-for="slot in 9" :key="slot - 1" class="tg-cell" :data-slot="slot - 1"
           :class="{ has: cellUid(slot - 1), col1: (slot - 1) % 3 === 1, over: overSlot === slot - 1 }"
           :style="cellUid(slot - 1) ? { '--el': elColor(cellUid(slot - 1)) } : {}"
           @pointerdown="onDown($event, cellUid(slot - 1), 'slot', slot - 1)">
        <template v-if="cellUid(slot - 1) && !(drag.active && drag.from === 'slot' && drag.fromSlot === slot - 1)">
          <div class="tg-svg" v-html="svgFor(cellUid(slot - 1), 56)"></div>
          <span class="tg-lv">{{ t('nv') }}{{ levelOf(cellUid(slot - 1)) }}</span>
        </template>
        <span v-else-if="!cellUid(slot - 1)" class="tg-plus">+</span>
      </div>
    </div>
    <div class="tg-count">{{ teamCount() }}<span>/5</span></div>
  </div>

  <div class="bench" v-if="bench.length">
    <div v-for="i in bench" :key="i.uid" class="bench-item" :style="{ '--el': elColor(i.uid), opacity: drag.active && drag.uid === i.uid ? 0.4 : 1 }"
         @pointerdown="onDown($event, i.uid, 'bench', -1)">
      <div class="bench-svg" v-html="svgFor(i.uid, 56)"></div>
      <span class="bench-lv">{{ t('nv') }}{{ levelOf(i.uid) }}</span>
      <span class="bench-nm">{{ critterFor(i.uid).name }}</span>
    </div>
  </div>

  <!-- fantasma que sigue al puntero -->
  <div v-if="drag.active" class="drag-ghost" :style="{ left: drag.x + 'px', top: drag.y + 'px', '--el': elColor(drag.uid) }" v-html="svgFor(drag.uid, 64)"></div>
</template>

<style scoped>
.lu-bar{display:flex;gap:6px;align-items:center;margin:0 0 10px}
.lu-select{flex:1 1 auto;min-width:0;background:var(--panel2);color:var(--text);border:1px solid var(--line2);border-radius:9px;padding:7px 9px;font-size:13px}
.lu-name{width:96px;background:var(--panel);color:var(--text);border:1px solid var(--line2);border-radius:9px;padding:7px 9px;font-size:13px}
.lu-btn{flex:0 0 auto;width:34px;height:34px;border-radius:9px;border:1px solid var(--line2);background:rgba(167,139,250,.08);color:var(--text);font-size:15px}
.lu-btn:disabled{opacity:.35}
.tg-wrap{display:flex;flex-direction:column;align-items:center;gap:6px;margin:6px 0 16px}
.tg{display:grid;grid-template-columns:repeat(3,76px);grid-template-rows:repeat(3,76px);gap:8px;
  padding:10px;border-radius:18px;background:linear-gradient(180deg,rgba(167,139,250,.06),transparent);border:1px solid var(--line)}
.tg-cell{border-radius:13px;border:1px dashed var(--line2);background:rgba(167,139,250,.04);position:relative;
  display:flex;align-items:center;justify-content:center;touch-action:none;transition:.12s}
.tg-cell.col1{border-color:color-mix(in srgb,var(--accent) 45%,var(--line2))}
.tg-cell.has{border-style:solid;border-color:color-mix(in srgb,var(--el) 60%,transparent);background:radial-gradient(circle at 50% 35%, color-mix(in srgb,var(--el) 22%,transparent), rgba(18,15,36,.6))}
.tg-cell.over{border-color:var(--cyan);box-shadow:0 0 0 2px var(--cyan), 0 0 16px rgba(56,225,214,.5);transform:scale(1.05)}
.tg-svg{filter:drop-shadow(0 3px 6px rgba(0,0,0,.5))}
.tg-plus{font-family:var(--fdisplay);font-size:24px;color:var(--muted);opacity:.5}
.tg-lv{position:absolute;bottom:3px;right:5px;font-family:var(--fmono);font-size:9px;font-weight:700;color:var(--gold)}
.tg-count{font-family:var(--fmono);font-weight:700;font-size:15px}
.tg-count span{color:var(--muted)}

.bench{display:flex;flex-wrap:wrap;gap:9px;justify-content:center}
.bench-item{width:84px;border-radius:13px;padding:7px 4px;display:flex;flex-direction:column;align-items:center;gap:2px;position:relative;cursor:grab;touch-action:none;
  background:linear-gradient(180deg, color-mix(in srgb,var(--el) 16%,var(--panel)), var(--panel));border:1px solid color-mix(in srgb,var(--el) 35%,var(--line))}
.bench-item:active{cursor:grabbing}
.bench-svg{filter:drop-shadow(0 2px 5px rgba(0,0,0,.5))}
.bench-lv{font-family:var(--fmono);font-size:9px;font-weight:700;color:var(--gold)}
.bench-nm{font-size:10px;color:var(--muted);max-width:78px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}

.drag-ghost{position:fixed;z-index:60;transform:translate(-50%,-55%) scale(1.1);pointer-events:none;
  filter:drop-shadow(0 8px 16px rgba(0,0,0,.6)) drop-shadow(0 0 14px color-mix(in srgb,var(--el) 70%,transparent))}
</style>
