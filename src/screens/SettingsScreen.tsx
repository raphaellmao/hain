import { useEffect, useRef, useState, type ReactNode } from 'react'
import { saveSettings } from '../db/repo'
import { useMeta, useSettings } from '../db/hooks'
import { BackupError, exportBackup, parseBackup, restoreBackup } from '../db/backup'
import { confirmDialog } from '../lib/confirm'
import { showToast } from '../lib/toast'
import { isIos, isStandalone, promptInstall, useCanInstall } from '../lib/install'

export function SettingsScreen() {
  const settings = useSettings()
  const lastBackupAt = useMeta<number>('lastBackupAt')
  const canInstall = useCanInstall()
  const fileInput = useRef<HTMLInputElement>(null)
  const [persisted, setPersisted] = useState<boolean | null>(null)

  useEffect(() => {
    navigator.storage?.persisted?.().then(setPersisted).catch(() => setPersisted(null))
  }, [])

  async function onExport() {
    try {
      await exportBackup()
    } catch {
      showToast('Export fehlgeschlagen', '⚠️')
    }
  }

  async function onImportFile(file: File) {
    try {
      const backup = parseBackup(await file.text())
      const ok = await confirmDialog({
        title: 'Backup einspielen?',
        message: `Alle aktuellen Daten werden ersetzt durch ${plural(backup.habits.length, 'Gewohnheit', 'Gewohnheiten')} mit ${plural(
          backup.checkins.length,
          'abgehaktem Tag',
          'abgehakten Tagen',
        )}${backup.dayEntries.length ? ` und ${plural(backup.dayEntries.length, 'Notiz', 'Notizen')}` : ''}${
          backup.exportedAt ? ` (Stand ${new Date(backup.exportedAt).toLocaleDateString('de-DE')})` : ''
        }.`,
        confirm: 'Ersetzen',
        danger: true,
      })
      if (!ok) return
      await restoreBackup(backup)
      showToast('Backup eingespielt', '✓')
    } catch (e) {
      showToast(e instanceof BackupError ? e.message : 'Die Datei konnte nicht gelesen werden.', '⚠️', 4500)
    }
  }

  const backupAge = lastBackupAt ? Math.floor((Date.now() - lastBackupAt) / 86_400_000) : null
  const backupText =
    backupAge === null ? 'Noch kein Backup' : backupAge === 0 ? 'Letztes Backup: heute' : `Letztes Backup: vor ${backupAge} ${backupAge === 1 ? 'Tag' : 'Tagen'}`
  const standalone = isStandalone()

  return (
    <div className="pb-nav">
      <header className="px-safe pt-safe">
        <h1 className="pt-2 pb-4 text-[32px] font-bold leading-tight">Einstellungen</h1>
      </header>

      <main className="px-safe flex flex-col gap-6">
        {!standalone && (
          <Section title="Als App installieren">
            <div className="rounded-2xl bg-surface p-4 text-[15px] leading-snug">
              {canInstall ? (
                <>
                  <p>Installiert startet Hain wie eine App vom Startbildschirm – ohne Browserleiste und auch offline.</p>
                  <button
                    type="button"
                    onClick={promptInstall}
                    className="mt-3 h-12 w-full rounded-2xl bg-accent text-[16px] font-semibold text-accent-ink"
                  >
                    Zum Startbildschirm hinzufügen
                  </button>
                </>
              ) : isIos() ? (
                <p>
                  In Safari unten auf <b>Teilen</b> <ShareIcon /> tippen, dann <b>„Zum Home-Bildschirm“</b>. Erst dann bleiben
                  deine Daten dauerhaft gespeichert.
                </p>
              ) : (
                <p>Im Browsermenü „App installieren“ bzw. „Zum Startbildschirm hinzufügen“ wählen.</p>
              )}
            </div>
          </Section>
        )}

        <Section
          title="Datensicherung"
          hint="Alle Daten liegen nur auf diesem Gerät. Ein Backup schützt vor Handyverlust – und bringt die Daten auf ein neues Gerät."
        >
          <div className="rounded-2xl bg-surface">
            <p className={`px-4 pt-3 text-[14px] ${backupAge === null || backupAge > 30 ? 'text-warn' : 'text-muted'}`}>{backupText}</p>
            <div className="grid grid-cols-2 gap-2 p-3">
              <button type="button" onClick={onExport} className="h-12 rounded-xl bg-accent text-[16px] font-semibold text-accent-ink">
                Exportieren
              </button>
              <button
                type="button"
                onClick={() => fileInput.current?.click()}
                className="h-12 rounded-xl bg-surface-2 text-[16px] font-semibold"
              >
                Importieren
              </button>
            </div>
            <input
              ref={fileInput}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                e.target.value = '' // dieselbe Datei erneut wählbar
                if (f) onImportFile(f)
              }}
            />
          </div>
          {persisted !== null && (
            <p className="mt-1.5 px-1 text-[13px] text-muted">
              Speicher: {persisted ? 'dauerhaft – der Browser löscht die Daten nicht von selbst.' : 'nicht dauerhaft geschützt. Als App installieren hilft.'}
            </p>
          )}
        </Section>

        <Section
          title="Tageswechsel"
          hint="Bis zu dieser Uhrzeit zählt ein Haken noch für den Vortag – praktisch bei Spät- und Nachtdienst."
        >
          <div className="grid grid-cols-5 gap-1 rounded-2xl bg-surface p-1">
            {[0, 1, 2, 3, 4].map((h) => (
              <button
                key={h}
                type="button"
                onClick={() => saveSettings({ dayStartHour: h })}
                aria-pressed={settings.dayStartHour === h}
                className={`h-11 rounded-xl text-[15px] font-medium tabular-nums transition-colors ${
                  settings.dayStartHour === h ? 'bg-ink text-bg' : 'text-muted'
                }`}
              >
                {h}:00
              </button>
            ))}
          </div>
        </Section>

        <section className="px-1 text-[13px] text-muted">
          <p>Hain · Version {__APP_VERSION__}</p>
          <p className="mt-1">Kein Konto, kein Server – alles bleibt auf diesem Gerät.</p>
        </section>
      </main>
    </div>
  )
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="mb-1.5 px-1 text-[13px] font-semibold tracking-wide text-muted uppercase">{title}</h2>
      {children}
      {hint && <p className="mt-1.5 px-1 text-[13px] text-muted">{hint}</p>}
    </section>
  )
}

/** iOS-Teilen-Symbol (Quadrat mit Pfeil nach oben) */
function ShareIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" className="inline -mt-1" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-label="Teilen-Symbol">
      <path d="M12 3v12M8 7l4-4 4 4M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1" />
    </svg>
  )
}
