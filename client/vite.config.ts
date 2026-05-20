import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
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
