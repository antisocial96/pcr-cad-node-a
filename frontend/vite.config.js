import { defineConfig } from 'vite'

export default defineConfig({
  root: 'frontend',
  build: {
    outDir: '../dist'
  },
  server: {
    port: 5173,
    strictPort: true
  }
})