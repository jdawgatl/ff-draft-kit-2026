import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Separate build target for the Chrome Extension's side panel / popup.
// Uses relative asset paths (base: './') so the compiled bundle works when
// loaded from chrome-extension://<id>/dist/index.html, and outputs into
// extension/dist so `extension/` is a fully self-contained unpacked
// extension folder (manifest.json + background.js + content.js + dist/).
export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    outDir: 'extension/dist',
    emptyOutDir: true,
  },
})
