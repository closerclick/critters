import { createApp } from 'vue';
import './style.css';
import App from './App.vue';

// Botón "Instalar App" (PWA) unificado y navegación "volver" del ecosistema.
import '@closerclick/closer-click-install';
import './nav.js';   // registra <closer-click-back> (instancia compartida)

createApp(App).mount('#app');

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(() => {}); });
}
