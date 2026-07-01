import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), basicSsl()],
  // Non-default (randomized) ports to avoid collisions with other local apps.
  // HTTPS is required in dev so the API's Secure + SameSite=Strict session
  // cookie round-trips: the SPA must be a same-origin https page, and /api
  // calls are proxied to the API so they share that origin.
  server: {
    port: 46258,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://localhost:29739',
        changeOrigin: true,
        secure: false,
      },
    },
  },
  preview: {
    port: 46258,
    strictPort: true,
  },
})
