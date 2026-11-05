import { AnimatePresence } from 'motion/react'
import { answerConfirm, usePendingConfirm } from '../lib/confirm'
import { BottomSheet } from './BottomSheet'

/** Zeigt Bestätigungsdialoge als Blatt von unten – Knöpfe im Daumenbereich. */
export function ConfirmHost() {
  const pending = usePendingConfirm()

  return (
    <AnimatePresence>
      {pending && (
        <BottomSheet
          key="confirm"
          role="alertdialog"
          labelledBy="confirm-title"
          // Nach dem Bestätigen geht es oft sofort auf eine andere Seite
          backToClose={false}
          onClose={() => answerConfirm(false)}
          footer={
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => answerConfirm(true)}
                className={`h-13 rounded-2xl text-[17px] font-semibold ${pending.danger ? 'bg-danger text-white' : 'bg-accent text-accent-ink'}`}
              >
                {pending.confirm}
              </button>
              <button type="button" onClick={() => answerConfirm(false)} className="h-13 rounded-2xl bg-surface-2 text-[17px] font-medium">
                {pending.cancel ?? 'Abbrechen'}
              </button>
            </div>
          }
        >
          <h2 id="confirm-title" className="text-lg font-semibold">
            {pending.title}
          </h2>
          {pending.message && <p className="mt-1.5 text-[15px] text-muted">{pending.message}</p>}
        </BottomSheet>
      )}
    </AnimatePresence>
  )
}
