// Render 3D del critter como ICONO ANIMADO (marcha de 2 frames), bajo demanda desde el genoma.
// - frames en S3 (Cloudflare): https://s3.closer.click/critters/<sha256(id)[:32]>/<view>.webp
//   (top1/top2 = patas adelante/atrás intercaladas; ver tools/blender + tools/lambda).
// - si faltan (403), encola el render en https://render.closer.click/ y REINTENTA ~cada
//   minuto. Mientras tanto el icono muestra el SVG y la circunferencia gira (pending).
// - el icono alterna top1<->top2; la CADENCIA depende de la velocidad de batalla (speed).
import { ref, watch, onUnmounted } from 'vue';
import { speed } from '../speed.js';

const IMG_BASE = 'https://s3.closer.click/critters';
const INTAKE = 'https://render.closer.click/';
const RETRY_MS = 60000;    // reintenta encolar/cargar ~cada minuto
const STEP_MS = 360;       // ms por frame a speed 1 (la cadencia escala con speed)

async function keyOf (id) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(id));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
}

const queued = new Set();   // no reencolar el mismo id dentro de la sesión
function requestRender (id, views) {
  const k = id + ':' + views.join(',');
  if (queued.has(k)) return;
  queued.add(k);
  fetch(INTAKE, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ id, views }),
  }).catch(() => {});
}

const preload = (u) => new Promise((res, rej) => { const im = new Image(); im.onload = () => res(u); im.onerror = rej; im.src = u; });

// Icono animado: alterna `views` (por defecto los 2 frames top) a una cadencia ~STEP_MS/speed.
// Devuelve { src, ready, pending }: <img v-show="ready" :src="src">; gira mientras pending && !ready.
export function use3dRender (idGetter, { views = ['top1', 'top2'] } = {}) {
  const src = ref('');
  const ready = ref(false);
  const pending = ref(false);
  let curId = '', urls = [], frame = 0, timer = null;

  const stop = () => { if (timer) { clearTimeout(timer); timer = null; } };

  function animate () {
    stop(); frame = 0; src.value = urls[0];
    const loop = () => {
      frame = (frame + 1) % urls.length; src.value = urls[frame];
      timer = setTimeout(loop, Math.max(60, STEP_MS / (speed.value || 1)));   // cadencia por speed
    };
    if (urls.length > 1) timer = setTimeout(loop, Math.max(60, STEP_MS / (speed.value || 1)));
  }

  async function begin (id) {
    stop(); ready.value = false; pending.value = false; src.value = ''; curId = id || '';
    if (!id || !String(id).startsWith('g:')) return;
    const key = await keyOf(id);
    if (curId !== id) return;
    urls = views.map(v => `${IMG_BASE}/${key}/${v}.webp`);
    pending.value = true;
    Promise.all(urls.map(preload)).then(() => {           // todos los frames listos → animar
      if (curId !== id) return;
      ready.value = true; pending.value = false; animate();
    }).catch(() => {                                       // falta alguno → encolar + reintentar
      if (curId !== id) return;
      requestRender(curId, views);
      pending.value = true;
      timer = setTimeout(() => begin(id), RETRY_MS);
    });
  }

  watch(idGetter, begin, { immediate: true });
  onUnmounted(stop);
  return { src, ready, pending };
}
