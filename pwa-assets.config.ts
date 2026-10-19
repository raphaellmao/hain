/**
 * Erzeugt aus public/icon.svg alle PNG-Icons und das favicon.ico.
 * Neu erzeugen nach Änderungen am Icon: npm run icons
 */
import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config'

export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset: {
    ...minimal2023Preset,
    // Das Icon ist schon vollflächig – kein zusätzlicher Rand/Hintergrund
    maskable: { ...minimal2023Preset.maskable, padding: 0 },
    apple: { ...minimal2023Preset.apple, padding: 0 },
  },
  images: ['public/icon.svg'],
})
