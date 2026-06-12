// Render 3D del critter servido BAJO DEMANDA desde su genoma-id, para usarlo COMO ICONO.
// - GET a S3 (Cloudflare): https://s3.closer.click/critters/<sha256(id)[:32]>/<view>.webp
// - si falta (403/404), encola el render en https://render.closer.click/ (API Gateway →
//   SQS → Lambda → Blender) y REINTENTA cada ~1 min hasta que exista. Mientras tanto el
//   icono muestra el SVG y la circunferencia gira como spinner (estado `pending`).
// Pipeline e infra: tools/lambda/README.md. La key es DETERMINISTA por genoma.
import { ref, watch, onUnmounted } from 'vue';

const IMG_BASE = 'https://s3.closer.click/critters';
const INTAKE = 'https://render.closer.click/';
const RETRY_MS = 60000;   // reintenta recargar el icono ~cada minuto

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
  }).catch(() => {});   // fire-and-forget: el SVG ya está a la vista
}

// Composable para un <img> que reemplaza al icono cuando el render existe.
// Devuelve { src, ready, pending, onLoad, onError }:
//   <img v-show="ready" :src="src" @load="onLoad" @error="onError">
//   girá la circunferencia mientras `pending && !ready`.
// `view` por defecto "top" (vista cenital, fondo transparente — ideal como icono).
export function use3dRender (idGetter, { view = 'top', retryMs = RETRY_MS } = {}) {
  const src = ref('');
  const ready = ref(false);
  const pending = ref(false);   // esperando a que el render exista (spinner)
  let curId = '', baseUrl = '', timer = null, attempt = 0;

  const clear = () => { if (timer) { clearTimeout(timer); timer = null; } };

  async function begin (id) {
    clear(); ready.value = false; pending.value = false; src.value = ''; baseUrl = ''; attempt = 0;
    curId = id || '';
    if (!id || !String(id).startsWith('g:')) return;   // sin genoma válido: solo SVG
    const url = `${IMG_BASE}/${await keyOf(id)}/${view}.webp`;
    if (curId !== id) return;                            // cambió mientras hasheaba
    baseUrl = url; pending.value = true; src.value = url;   // 1er intento
  }

  function onLoad () { ready.value = true; pending.value = false; clear(); }

  function onError () {
    if (!curId || !baseUrl) return;
    ready.value = false; pending.value = true;
    requestRender(curId, [view]);   // encola (idempotente; solo 1 POST por id/sesión)
    clear();
    timer = setTimeout(() => {       // reintenta ~cada minuto (cache-buster por las dudas)
      attempt++;
      src.value = `${baseUrl}?r=${attempt}`;
    }, retryMs);
  }

  watch(idGetter, begin, { immediate: true });
  onUnmounted(clear);
  return { src, ready, pending, onLoad, onError };
}
