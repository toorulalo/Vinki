import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // 'prompt' en vez de 'autoUpdate': el SW nuevo se instala pero no
      // reemplaza el activo hasta que el usuario cierra TODAS las pestañas
      // de la app o recarga. Con 'autoUpdate' el SW viejo puede servir el
      // bundle anterior por un segundo antes de que el nuevo tome control,
      // causando el flash de onboarding que se veía al recargar.
      registerType: 'prompt',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'VINKI',
        short_name: 'VINKI',
        description: 'Tu lienzo de ideas, links y notas',
        theme_color: '#F4ECCB',
        background_color: '#F4ECCB',
        display: 'standalone',
        start_url: '/',
        icons: [
          {
            src: '/icon-192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/icon-512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    })
  ]
})
