import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // @react-pdf/renderer is only reached via dynamic import (lazy PDF export), so
  // Vite discovers it late; pre-bundle it at startup to avoid a broken on-demand
  // optimize (the "disallowed MIME type" dev error).
  optimizeDeps: {
    include: ['@react-pdf/renderer'],
  },
  // Proxy the backends in dev so browser requests stay same-origin (cookies
  // included). Local port convention: keysmith (auth) on 8080, forged on 8081.
  // Production builds skip the proxy and set VITE_API_BASE_URL /
  // VITE_AUTH_BASE_URL instead (both services serve CORS allow-lists).
  server: {
    proxy: {
      '/v1': { target: 'http://localhost:8081', changeOrigin: true },
      '/auth': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        // /auth/complete is an SPA route (OAuth landing), not a keysmith
        // endpoint — serve the app shell for it.
        bypass: (req) => (req.url?.startsWith('/auth/complete') ? '/index.html' : undefined),
      },
    },
  },
  test: {
    environment: 'jsdom',
  },
})
