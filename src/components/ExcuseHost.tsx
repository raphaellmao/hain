import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { EXCUSE_REASONS, reasonInfo } from '../domain/excuse'
import { formatLong } from '../domain/dates'
import { clearExcuse, excuseDay } from '../app/actions'
import { navigate, paths } from '../app/router'
import { closeExcuseSheet, useExcuseRequest } from '../lib/excuseSheet'
import { IconChevronRight } from './icons'

/**
 * Blatt „Heute nicht möglich?“: Grund antippen, fertig. Der Tag zählt dann
 * nicht als verpasst. Unten steht ehrlich, wie oft das in letzter Zeit war.
 */
export function ExcuseHost() {
  const req = useExcuseRequest()
  const [note, setNote] = useState('')

  // Beim Öffnen die vorhandene Notiz übernehmen
  useEffect(() => setNote(req?.current?.note ?? ''), [req])

  return (
    <AnimatePresence>
      {req && (
        <motion.div
          key="excuse"
          className="fixed inset-0 z-40 flex items-end justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <button type="button" aria-label="Schließen" className="absolute inset-0 bg-black/40" onClick={closeExcuseSheet} />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="excuse-title"
            className="relative w-full max-w-md rounded-t-3xl bg-surface px-5 pt-3 pb-safe"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 420, damping: 38 }}
          >
            <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-line" aria-hidden />
            <p className="flex items-center gap-1.5 text-[15px] font-semibold text-muted">
              <span aria-hidden>{req.habit.emoji}</span>
              <span className="truncate">{req.habit.name}</span>
            </p>
            <h2 id="excuse-title" className="mt-0.5 text-[22px] font-bold leading-tight">
              {req.date === req.today ? 'Heute nicht möglich?' : `${formatLong(req.date)} nicht möglich?`}
            </h2>
            <p className="mt-1 text-[14px] leading-snug text-muted">
              Wähle einen Grund – der Tag zählt dann nicht als verpasst
              {req.habit.metaphor === 'schatten' ? ': dein Schatten wird nicht stärker.' : ': nichts welkt, die Serie bleibt.'}
            </p>

            {req.current && !req.done && (
              <div className="mt-3 flex items-center justify-between gap-3 rounded-2xl bg-surface-2 p-3">
                <span className="text-[15px]">
                  Ausgesetzt: {reasonInfo(req.current.reason).emoji} {reasonInfo(req.current.reason).label}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    clearExcuse(req.habit, req.date)
                    closeExcuseSheet()
                  }}
                  className="h-11 shrink-0 rounded-xl px-3 text-[15px] font-semibold text-accent"
                >
                  Aufheben
                </button>
              </div>
            )}
            {req.done && (
              <p className="mt-3 rounded-2xl bg-surface-2 p-3 text-[14px]">Schon erledigt – ein Grund ersetzt den Haken.</p>
            )}

            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={140}
              placeholder="Notiz (optional), z. B. Übung bis Freitag"
              enterKeyHint="done"
              className="mt-4 h-12 w-full rounded-2xl bg-surface-2 px-4 text-[16px] outline-none placeholder:text-muted focus:ring-2 focus:ring-accent"
            />

            <div className="mt-3 grid grid-cols-3 gap-2">
              {EXCUSE_REASONS.map((r) => {
                const active = req.current?.reason === r.key && !req.done
                return (
                  <button
                    key={r.key}
                    type="button"
                    onClick={() => {
                      excuseDay(req.habit, req.date, req.today, r.key, note)
                      closeExcuseSheet()
                    }}
                    aria-pressed={active}
                    className={`flex h-[68px] flex-col items-center justify-center gap-0.5 rounded-2xl text-[13px] font-medium transition-colors ${
                      active ? 'bg-ink text-bg' : 'bg-surface-2'
                    }`}
                  >
                    <span className="text-[24px] leading-none" aria-hidden>
                      {r.emoji}
                    </span>
                    {r.label}
                  </button>
                )
              })}
            </div>

            <p className={`mt-3 text-center text-[13px] ${req.recent >= 8 ? 'text-warn' : 'text-muted'}`}>
              Ausnahmen in den letzten 30 Tagen: {req.recent}
            </p>

            <div className="mt-2 mb-3 flex flex-col gap-1">
              {req.showDetails && (
                <button
                  type="button"
                  onClick={() => {
                    closeExcuseSheet()
                    navigate(paths.habit(req.habit.id))
                  }}
                  className="flex h-12 items-center justify-between rounded-2xl px-1 text-[16px] font-medium"
                >
                  Details & Statistik
                  <IconChevronRight width={20} height={20} className="text-muted" />
                </button>
              )}
              <button type="button" onClick={closeExcuseSheet} className="h-12 rounded-2xl bg-surface-2 text-[16px] font-medium">
                Abbrechen
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
