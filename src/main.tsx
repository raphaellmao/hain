import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'

// Den Browser bitten, unsere Daten nicht bei Speicherknappheit zu löschen.
// Installierte PWAs bekommen das meist automatisch; schadet aber nie.
navigator.storage?.persist?.().catch(() => {})

// Nur in der Entwicklung: Demo-Daten per Konsole (await hainDemo()) oder
// per URL-Parameter ?demo (legt sie an, falls die Datenbank leer ist).
if (import.meta.env.DEV) {
  import('./dev/demo').then(async (m) => {
    Object.assign(window, { hainDemo: m.hainDemo })
    if (new URLSearchParams(location.search).has('demo')) await m.hainDemoIfEmpty()
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
