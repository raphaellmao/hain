import { useEffect, useState } from 'react'
import { AnimatePresence } from 'motion/react'
import { EXCUSE_REASONS, reasonInfo } from '../domain/excuse'
import { formatLong } from '../domain/dates'
import { clearExcuse, excuseDay } from '../app/actions'
import { navigate, paths } from '../app/router'
import { closeExcuseSheet, useExcuseRequest } from '../lib/excuseSheet'
import { BottomSheet } from './BottomSheet'
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
        <BottomSheet
          key="excuse"
          labelledBy="excuse-title"
          onClose={closeExcuseSheet}
          footer={
            <button type="button" onClick={closeExcuseSheet} className="h-12 w-full rounded-2xl bg-surface-2 text-[16px] font-medium">
              Abbrechen
            </button>
          }
        >
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
          {req.done && <p className="mt-3 rounded-2xl bg-surface-2 p-3 text-[14px]">Schon erledigt – ein Grund ersetzt den Haken.</p>}

          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={140}
            placeholder="Notiz (optional), z. B. Übung bis Freitag"
            aria-label="Notiz zur Ausnahme"
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

          <p className={`mt-3 text-center text-[13px] ${req.recent >= 8 ? 'text-warn' : 'text-muted'}`}>Ausnahmen in den letzten 30 Tagen: {req.recent}</p>

          {req.showDetails && (
            <button
              type="button"
              onClick={() => {
                closeExcuseSheet()
                navigate(paths.habit(req.habit.id))
              }}
              className="mt-1 flex h-12 w-full items-center justify-between rounded-2xl px-1 text-[16px] font-medium"
            >
              Details & Statistik
              <IconChevronRight width={20} height={20} className="text-muted" />
            </button>
          )}
        </BottomSheet>
      )}
    </AnimatePresence>
  )
}
