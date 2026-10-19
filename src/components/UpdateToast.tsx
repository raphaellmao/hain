import { useEffect } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { showToast } from '../lib/toast'

/**
 * Service Worker registrieren (macht die App offline-fähig) und Bescheid
 * geben, wenn eine neue Version bereitliegt. Neu geladen wird erst auf
 * Knopfdruck – so reißt kein Update mitten im Abhaken die Seite weg.
 */
export function UpdateToast() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      // Bleibt die App lange offen, stündlich nach Updates schauen
      if (registration) window.setInterval(() => registration.update(), 60 * 60 * 1000)
    },
  })

  useEffect(() => {
    if (!offlineReady) return
    showToast('Hain funktioniert jetzt auch offline', '✓')
    setOfflineReady(false)
  }, [offlineReady, setOfflineReady])

  return (
    <AnimatePresence>
      {needRefresh && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 16 }}
          className="fixed inset-x-0 bottom-nav z-30 mx-auto mb-3 flex max-w-sm items-center gap-2 rounded-2xl bg-ink py-2 pr-2 pl-4 text-bg shadow-lg"
          role="status"
        >
          <span className="flex-1 text-[15px] font-medium">Neue Version verfügbar</span>
          <button type="button" onClick={() => setNeedRefresh(false)} className="h-11 rounded-xl px-3 text-[15px] opacity-70">
            Später
          </button>
          <button
            type="button"
            onClick={() => updateServiceWorker(true)}
            className="h-11 rounded-xl bg-accent px-4 text-[15px] font-semibold text-accent-ink"
          >
            Neu laden
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
