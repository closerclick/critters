<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import { game, loadGame } from './game/state.js';
import { fightCampaign } from './game/actions.js';
import { i18n, t, toggleLang } from './i18n.js';
import { nav } from './nav.js';
import CampaignView from './components/CampaignView.vue';
import CollectionView from './components/CollectionView.vue';
import TeamView from './components/TeamView.vue';
import SummonView from './components/SummonView.vue';
import BattleView from './components/BattleView.vue';
import StarterView from './components/StarterView.vue';

const needsStarter = computed(() => game.ready && game.collection.length === 0);

const tab = ref('campana');
const battle = ref(null);
const toast = ref('');
let toastT = null;
function showToast (m) { toast.value = m; clearTimeout(toastT); toastT = setTimeout(() => { toast.value = ''; }, 1900); }

onMounted(() => { loadGame(); });

function fight (n) {
  const r = fightCampaign(n);
  if (r.error === 'noteam') { showToast(t('equipoVacio')); return; }
  battle.value = r;
}
function onNext (n) { fight(n); }
function onClose () {
  const cap = battle.value && battle.value.captured;
  battle.value = null;
  if (cap) showToast('✨ ' + t('capturaste'));
}

// La batalla es una "capa" de navegación: el back físico / chevron la cierra.
let battleNav = null;
watch(battle, (b) => {
  if (b) { if (!battleNav) battleNav = nav.open(() => onClose()); }
  else if (battleNav) { const h = battleNav; battleNav = null; try { h.close(); } catch (e) {} }
});
</script>

<template>
  <StarterView v-if="needsStarter" />
  <template v-else>
  <div class="topbar">
    <closer-click-back style="color:var(--text);--cc-back-size:34px"></closer-click-back>
    <div class="brand"><img src="/icon.svg" alt="" /><span>Critters</span></div>
    <div class="spacer"></div>
    <div class="wallet">
      <span class="coin">🪙 {{ game.wallet.coins }}</span>
      <span class="frag">🔹 {{ game.wallet.frags }}</span>
    </div>
    <button class="tb-btn" @click="toggleLang">{{ i18n.lang === 'es' ? 'EN' : 'ES' }}</button>
    <closer-click-install class="cc-install"></closer-click-install>
  </div>

  <nav class="tabs">
    <button :class="{ on: tab === 'campana' }" @click="tab = 'campana'">{{ t('campana') }}</button>
    <button :class="{ on: tab === 'equipo' }" @click="tab = 'equipo'">{{ t('equipo') }}</button>
    <button :class="{ on: tab === 'coleccion' }" @click="tab = 'coleccion'">{{ t('coleccion') }}</button>
    <button :class="{ on: tab === 'invocar' }" @click="tab = 'invocar'">{{ t('invocar') }}</button>
  </nav>

  <main class="view" v-if="game.ready">
    <CampaignView v-if="tab === 'campana'" @fight="fight" />
    <TeamView v-else-if="tab === 'equipo'" />
    <CollectionView v-else-if="tab === 'coleccion'" />
    <SummonView v-else-if="tab === 'invocar'" />
  </main>
  <main class="view center" v-else><p class="hint">…</p></main>

  <BattleView v-if="battle" :payload="battle" @close="onClose" @next="onNext" />

  <div class="toast" v-if="toast">{{ toast }}</div>
  </template>
</template>
