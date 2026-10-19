import { AnimatePresence, motion } from 'motion/react'
import { answerConfirm, usePendingConfirm } from '../lib/confirm'

/** Zeigt Bestätigungsdialoge als Blatt von unten – Knöpfe im Daumenbereich. */
export function ConfirmHost() {
  const pending = usePendingConfirm()

  return (
    <AnimatePresence>
      {pending && (
        <motion.div
          key="confirm"
          className="fixed inset-0 z-40 flex items-end justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <button
            type="button"
            aria-label="Abbrechen"
            className="absolute inset-0 bg-black/40"
            onClick={() => answerConfirm(false)}
          />
          <motion.div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-title"
            className="relative w-full max-w-md rounded-t-3xl bg-surface px-5 pt-5 pb-safe"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 420, damping: 38 }}
          >
            <h2 id="confirm-title" className="text-lg font-semibold">
              {pending.title}
            </h2>
            {pending.message && <p className="mt-1.5 text-[15px] text-muted">{pending.message}</p>}
            <div className="mt-5 mb-4 flex flex-col gap-2">
              <button
                type="button"
                onClick={() => answerConfirm(true)}
                className={`h-13 rounded-2xl text-[17px] font-semibold ${
                  pending.danger ? 'bg-danger text-white' : 'bg-accent text-accent-ink'
                }`}
              >
                {pending.confirm}
              </button>
              <button type="button" onClick={() => answerConfirm(false)} className="h-13 rounded-2xl bg-surface-2 text-[17px] font-medium">
                {pending.cancel ?? 'Abbrechen'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
