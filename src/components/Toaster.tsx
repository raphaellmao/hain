import { AnimatePresence, motion } from 'motion/react'
import { useToasts } from '../lib/toast'

/** Hinweise unten über der Navigation. */
export function Toaster() {
  const toasts = useToasts()
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-nav z-30 flex flex-col items-center gap-2 px-4 pb-3" aria-live="polite">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            layout
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="flex max-w-sm items-center gap-2 rounded-2xl bg-ink px-4 py-3 text-[15px] font-medium text-bg shadow-lg"
          >
            {t.icon && <span aria-hidden>{t.icon}</span>}
            {t.text}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
