import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  // 1. A BASE CORRETA PARA NATIVO E WEB (Caminho Relativo)
  base: './', 
  
  // 2. O BUILD AGORA ESTÁ NO LUGAR CERTO (Fora do PWA)
  build: {
    outDir: 'movimex-dist',
    emptyOutDir: true, // Garante que a pasta será limpa antes de gerar novos arquivos
  },
  
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'script',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'], 
        cleanupOutdatedCaches: true,
        skipWaiting: true,
        clientsClaim: true
      },
      manifest: {
        name: 'MoviMeX - Sistema de Armazém',
        short_name: 'MoviMeX',
        description: 'Impressão e Movimentação de Estoque',
        theme_color: '#020617', 
        background_color: '#020617',
        display: 'standalone', 
        orientation: 'portrait', 
        scope: '/', // Atualizado para a raiz no nativo      
        start_url: '/', // Atualizado para a raiz no nativo
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      }
    })
  ]
})