import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react(), {
    name: 'api-not-found',
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const path = (request.url ?? '').split('?')[0]
        if (/^\/api(?:\/|$)/.test(path) && !/^\/api\/(?:auth|events|public)(?:\/|$)/.test(path)) {
          response.writeHead(404, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' })
          response.end('{"error":"API route not found"}')
          return
        }
        next()
      })
    },
  }],
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '^/api/auth(?:/|\\?|$)': { target: 'http://127.0.0.1:8080', autoRewrite: true },
      '^/api/events(?:/|\\?|$)': { target: 'http://127.0.0.1:8087', autoRewrite: true },
      '^/api/public(?:/|\\?|$)': { target: 'http://127.0.0.1:8087', autoRewrite: true },
    },
  },
})
