import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const clientDir = path.dirname(fileURLToPath(import.meta.url))

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@shared': path.resolve(clientDir, '../shared/src'),
    },
  },
  server: {
    proxy: {
      '/activity': 'http://127.0.0.1:3000',
      '/encounter': 'http://127.0.0.1:3000',
      '/session': 'http://127.0.0.1:3000',
      '/player': 'http://127.0.0.1:3000',
      '/avatar': 'http://127.0.0.1:3000',
      '/avatars': 'http://127.0.0.1:3000',
      '/game-data': 'http://127.0.0.1:3000',
      '/health': 'http://127.0.0.1:3000',
    },
  },
})
