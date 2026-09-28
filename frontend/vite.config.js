import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico'],
      manifest: {
        name: 'KHATRA — AI Safety Training Simulator',
        short_name: 'KHATRA',
        description: 'AR-style vocational safety training for mining, steel, and mica sector workers in Jharkhand',
        theme_color: '#1C1F22',
        background_color: '#1C1F22',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Cache the app shell so scenario training, dashboard, certificates,
        // and verification all work fully offline. AI-dependent features
        // (Hazard Scan, AI coaching, chatbox) still need connectivity to
        // reach Gemini/OpenAI, since that inference can't run on-device.
        globPatterns: ['**/*.{js,css,html,ico,png,svg,glb}'],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => !url.href.includes('generativelanguage.googleapis.com') && !url.href.includes('api.openai.com'),
            handler: 'CacheFirst',
            options: { cacheName: 'khatra-shell' },
          },
        ],
      },
    }),
  ],
  server: {
    host: true,
    port: 5173
  }
})
