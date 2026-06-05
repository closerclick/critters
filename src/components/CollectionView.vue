<script setup>
import { game } from '../game/state.js';
import { openCritter } from '../ui.js';
import { t } from '../i18n.js';
import CritterCard from './CritterCard.vue';
// El detalle/config de cada criatura es un modal compartido (CritterDetail) que se
// abre tocando el avatar; acá solo mostramos la grilla.
</script>

<template>
  <p v-if="!game.collection.length" class="hint">{{ t('colVacia') }}</p>
  <div class="grid-cards">
    <div v-for="i in game.collection" :key="i.uid" @click="openCritter(i.uid)" style="cursor:pointer">
      <CritterCard :instance="i" :size="84" />
    </div>
  </div>
</template>
