import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      workbox: {
        cleanupOutdatedCaches: true,
        skipWaiting: true,
        clientsClaim: true,
      },
      manifest: {
        name: 'MoviMeX - Sistema de Armazém',
        short_name: 'MoviMeX',
        description: 'Impressão e Movimentação de Estoque',
        theme_color: '#111827', // Cor do fundo (bg-gray-900)
        background_color: '#111827',
        display: 'standalone', // Chave para parecer um App nativo (remove a barra do Chrome)
        orientation: 'portrait', // Trava em pé no coletor
        scope: '/Movimex/',      // MUITO IMPORTANTE: Define que o PWA mora na subpasta
        start_url: '/Movimex/',  // Página inicial do app
        icons: [
          {
            src: 'pwa-192x192.png', // Você precisa colocar uma logo 192x192 na pasta 'public' do Movimex
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png', // E uma 512x512
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      }
    })
  ],
  base: '/Movimex/',
})