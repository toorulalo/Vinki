import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Vinki',
        short_name: 'Vinki',
        description: 'Tu sala de estudio compartida',
        theme_color: '#2E7D52',
        background_color: '#F5F1EB',
        display: 'standalone',
        start_url: '/',
        // GET share: params land as query strings on the SPA root, handled by
        // src/components/ShareCapture.jsx (a POST target would need a server route).
        share_target: {
          action: '/',
          method: 'GET',
          params: { title: 'title', text: 'text', url: 'url' }
        },
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' }
        ]
      }
    })
  ]
})
