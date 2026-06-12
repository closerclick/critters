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
  rotate: { type: Number, default: 0 },          // grados a rotar SOLO la imagen 3D (campo)
  // Vistas a cargar: por defecto la TOP ESTÁTICA (1 frame = sin animación de patas).
  views: { type: Array, default: () => ['top'] },
});

const critter = computed(() => critterById(props.instance.id));
const svg = computed(() => critter.value ? critterSvg(critter.value, props.size, { frame: props.frame }) : '');
const imgStyle = computed(() => props.rotate ? { transform: `rotate(${props.rotate}deg)` } : null);
const { src, ready, pending } = use3dRender(() => genomeOf(props.instance), { views: props.views });
</script>

<template>
  <div class="ci" :class="{ ring: spinner, loading: spinner && pending && !ready }" :style="{ width: size + 'px', height: size + 'px' }">
    <div v-show="!ready" class="ci-svg" v-html="svg"></div>
    <img v-show="ready" class="ci-img" :src="src" alt="" :style="imgStyle" />
  </div>
</template>

<style scoped>
.ci{position:relative;display:flex;align-items:center;justify-content:center}
.ci-svg{display:flex;align-items:center;justify-content:center}
.ci-img{width:100%;height:100%;object-fit:contain;animation:cifade .3s ease-out}
@keyframes cifade{from{opacity:0}to{opacity:1}}
/* Anillo SIEMPRE presente (queda cuando está el 3D); solo gira mientras carga. */
.ci.ring::after{content:'';position:absolute;inset:-3px;border-radius:50%;box-sizing:border-box;
  border:2px solid color-mix(in srgb,var(--el,var(--accent)) 45%,transparent)}
.ci.ring.loading::after{border-top-color:var(--el,var(--accent));border-right-color:var(--el,var(--accent));
  animation:cispin .85s linear infinite}
@keyframes cispin{to{transform:rotate(360deg)}}
</style>
