import { defineConfig } from 'vite'

export default defineConfig({
  root: '.',
  publicDir: 'frontend',
  build: {
    outDir: 'dist'
  },
  server: {
    port: 5173,
    strictPort: true
  }
})