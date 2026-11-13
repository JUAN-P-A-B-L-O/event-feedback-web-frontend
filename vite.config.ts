import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api/auth': 'http://127.0.0.1:8080',
      '/api/events': 'http://127.0.0.1:8087',
      '/api/public': 'http://127.0.0.1:8087',
    },
  },
})
