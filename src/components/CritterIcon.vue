<script setup>
// Icono de critter REUSABLE: muestra el esquema SVG hasta que existe el render 3D de
// vista superior (animado top1/top2), y entonces lo prefiere. Spinner opcional en la
// circunferencia mientras se genera. Usado en cartas, equipo y batalla.
import { computed } from 'vue';
import { critterById } from '../game/state.js';
import { critterSvg } from '../critter/svg.js';
import { use3dRender, genomeOf } from '../critter/render3d.js';

const props = defineProps({
  instance: Object,                              // cualquier objeto con .id (instancia o unidad)
  size: { type: Number, default: 64 },
  frame: { type: Boolean, default: true },       // se pasa a critterSvg
  spinner: { type: Boolean, default: true },     // anillo de carga
});

const critter = computed(() => critterById(props.instance.id));
const svg = computed(() => critter.value ? critterSvg(critter.value, props.size, { frame: props.frame }) : '');
const { src, ready, pending } = use3dRender(() => genomeOf(props.instance));
</script>

<template>
  <div class="ci" :class="{ loading: spinner && pending && !ready }" :style="{ width: size + 'px', height: size + 'px' }">
    <div v-show="!ready" class="ci-svg" v-html="svg"></div>
    <img v-show="ready" class="ci-img" :src="src" alt="" />
  </div>
</template>

<style scoped>
.ci{position:relative;display:flex;align-items:center;justify-content:center}
.ci-svg{display:flex;align-items:center;justify-content:center}
.ci-img{width:100%;height:100%;object-fit:contain;animation:cifade .3s ease-out}
@keyframes cifade{from{opacity:0}to{opacity:1}}
.ci.loading::after{content:'';position:absolute;inset:-3px;border-radius:50%;box-sizing:border-box;
  border:2px solid transparent;border-top-color:var(--el,var(--accent));border-right-color:var(--el,var(--accent));
  animation:cispin .85s linear infinite}
@keyframes cispin{to{transform:rotate(360deg)}}
</style>
