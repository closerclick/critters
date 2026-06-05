import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// base './' → rutas relativas para servir bajo critters.closer.click (y el mirror
// de Pages). Los Web Components del ecosistema (<closer-click-*>) se declaran como
// custom elements para que Vue no intente resolverlos como componentes.
export default defineConfig({
  base: './',
  plugins: [vue({ template: { compilerOptions: { isCustomElement: (tag) => tag.startsWith('closer-click-') } } })],
  server: { port: 3400, host: true },
})
