import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// In dev, proxy /api to the Express backend so the frontend can use relative
// URLs (same as in production behind nginx). The target is configurable via
// VITE_API_PROXY_TARGET (see .env.sample); defaults to the local backend.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiTarget = env.VITE_API_PROXY_TARGET || 'http://localhost:8000'

  return {
    plugins: [react()],
    server: {
      proxy: {
        '/api': apiTarget,
      },
    },
  }
})
