// Render 3D del critter servido BAJO DEMANDA desde su genoma-id.
// - GET a S3 (Cloudflare): https://s3.closer.click/critters/<sha256(id)[:32]>/<view>.webp
// - si falta (403/404), encola el render en https://render.closer.click/ (API Gateway →
//   SQS → Lambda → Blender) y la imagen aparece sola en una próxima visita.
// Pipeline e infra: tools/lambda/README.md. La key es DETERMINISTA por genoma, así que
// la imagen de un critter siempre es la misma y se cachea inmutable en el edge.
import { ref, watch } from 'vue';

const IMG_BASE = 'https://s3.closer.click/critters';
const INTAKE = 'https://render.closer.click/';

// sha256(id) hex, primeros 32 — igual que handler.py / spec_derive (Web Crypto, async).
async function keyOf (id) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(id));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
}

const queued = new Set();   // no reencolar el mismo id dentro de la sesión
function requestRender (id, views) {
  if (queued.has(id)) return;
  queued.add(id);
  fetch(INTAKE, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ id, views }),
  }).catch(() => {});   // fire-and-forget: el fallback SVG ya está a la vista
}

// Composable para un <img> que muestra el render en perspectiva ("beauty").
// Devuelve { src, ready, onError }: pintás <img :src="src" v-show="ready"
// @load="ready=true" @error="onError">. Solo aplica a genomas (ids "g:...").
export function use3dRender (idGetter, view = 'beauty') {
  const src = ref('');
  const ready = ref(false);
  let curId = '';

  watch(idGetter, async (id) => {
    ready.value = false; src.value = ''; curId = id || '';
    if (!id || !String(id).startsWith('g:')) return;   // wild/no-genoma: sin render 3D
    src.value = `${IMG_BASE}/${await keyOf(id)}/${view}.webp`;
  }, { immediate: true });

  function onError () {
    ready.value = false;
    if (curId) requestRender(curId, [view]);   // miss → pedir el render
  }
  return { src, ready, onError };
}
