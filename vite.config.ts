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
  test: {
    environment: 'jsdom',
  },
})
