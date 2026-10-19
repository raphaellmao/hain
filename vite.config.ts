/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import pkg from './package.json' with { type: 'json' }

// Unterpfad, unter dem die App ausgeliefert wird.
// Vercel / eigene Domain: "/" (Standard). GitHub Pages: "/<repo-name>/" –
// der Deploy-Workflow setzt das über die Umgebungsvariable BASE_PATH.
const base = process.env.BASE_PATH ?? '/'

export default defineConfig({
  base,
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // Neue Versionen nicht ungefragt aktivieren: Die App zeigt einen
      // Hinweis „Neue Version – neu laden“ (siehe UpdateToast.tsx).
      registerType: 'prompt',
      includeAssets: ['favicon.ico', 'apple-touch-icon-180x180.png', 'icon.svg'],
      manifest: {
        name: 'Hain – Gewohnheiten',
        short_name: 'Hain',
        description: 'Gewohnheiten abhaken und jeder einen eigenen Baum wachsen lassen.',
        lang: 'de',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#f4f2ec',
        theme_color: '#f4f2ec',
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Alles, was der Build erzeugt, wird vorab gecacht → App läuft komplett offline.
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest}'],
      },
    }),
  ],
  server: { port: 5173 },
  // Ein Bundle von ~170 kB (gzip) ist für eine App, die einmal geladen und
  // dann offline aus dem Cache läuft, unkritisch – Warnung erst ab 700 kB.
  build: { chunkSizeWarningLimit: 700 },
  test: {
    include: ['src/**/*.test.ts'],
  },
})
