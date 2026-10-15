import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'path'

export default defineConfig({
  main: {
    // nanoid v5 is ESM-only; bundle it instead of require()-ing it from node_modules.
    plugins: [externalizeDepsPlugin({ exclude: ['nanoid'] })],
    resolve: { alias: { '@shared': resolve('src/shared') } }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    resolve: { alias: { '@shared': resolve('src/shared') } }
  },
  renderer: {
    plugins: [react(), tailwindcss()],
    resolve: { alias: { '@': resolve('src/renderer/src'), '@shared': resolve('src/shared') } },
    optimizeDeps: { exclude: ['@huggingface/transformers'] },
    worker: { format: 'es' },
    build: { target: 'chrome128' }
  }
})
