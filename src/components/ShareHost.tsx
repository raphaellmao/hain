import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { AnimatePresence } from 'motion/react'
import { doneFor, useDoneMap } from '../db/hooks'
import { useGardenItems } from '../garden/useGardenItems'
import { appUrl, appUrlShort, closeShareSheet, useShareSheet } from '../lib/shareSheet'
import { useSky } from '../lib/sky'
import { showToast } from '../lib/toast'
import { isIos } from '../lib/install'
import { BottomSheet } from './BottomSheet'

// Erst laden, wenn jemand teilen will – das braucht kaum jemand täglich
const QrCode = lazy(() => import('./QrCode'))

/** Blätter zum Weitergeben: die App (QR-Code, Link) und der Garten als Bild */
export function ShareHost() {
  const kind = useShareSheet()
  return (
    <AnimatePresence>
      {kind === 'app' && <AppSheet key="app" />}
      {kind === 'garten' && <GardenSheet key="garten" />}
    </AnimatePresence>
  )
}

const canShare = () => typeof navigator.share === 'function'

async function copyLink(url: string) {
  try {
    await navigator.clipboard.writeText(url)
    showToast('Link kopiert', '🔗')
  } catch {
    showToast('Kopieren ging nicht – den Link bitte markieren', '⚠️')
  }
}

function AppSheet() {
  const url = appUrl()

  async function share() {
    try {
      await navigator.share({
        title: 'Hain',
        text: 'Gewohnheiten, die wachsen – Hain zum Ausprobieren:',
        url,
      })
    } catch {
      // abgebrochen – nichts zu tun
    }
  }

  return (
    <BottomSheet
      labelledBy="share-app-title"
      onClose={closeShareSheet}
      footer={
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => void (canShare() ? share() : copyLink(url))}
            className="h-13 rounded-2xl bg-accent text-[17px] font-semibold text-accent-ink"
          >
            {canShare() ? 'Link teilen' : 'Link kopieren'}
          </button>
          {canShare() && (
            <button type="button" onClick={() => void copyLink(url)} className="h-13 rounded-2xl bg-surface-2 text-[17px] font-medium">
              Link kopieren
            </button>
          )}
        </div>
      }
    >
      <h2 id="share-app-title" className="text-lg font-semibold">
        Hain weitergeben
      </h2>
      <p className="mt-1.5 text-[15px] leading-snug text-muted">
        Mit der Handykamera scannen: Hain öffnet sich im Browser und lässt sich dort als App installieren. Deine Daten bleiben bei dir – jeder startet mit einem
        eigenen, leeren Garten.
      </p>
      <div className="mx-auto mt-4 w-56 rounded-2xl bg-white p-2 shadow-sm">
        <Suspense fallback={<div className="aspect-square" />}>
          <QrCode text={url} className="block w-full" />
        </Suspense>
      </div>
      <p className="mt-3 text-center text-[15px] font-medium break-all select-all">{appUrlShort()}</p>
    </BottomSheet>
  )
}

function GardenSheet() {
  const items = useGardenItems()
  const doneMap = useDoneMap()
  const { season } = useSky()
  const [names, setNames] = useState(true)
  const [image, setImage] = useState<{ blob: Blob; url: string } | null>(null)
  const [failed, setFailed] = useState(false)

  const subtitle = useMemo(() => {
    if (!items || !doneMap) return null
    const n = items.length
    const done = items.reduce((sum, { habit }) => sum + doneFor(doneMap, habit.id).size, 0)
    return `${n} ${n === 1 ? 'Gewohnheit' : 'Gewohnheiten'} · ${done} ${done === 1 ? 'erledigter Tag' : 'erledigte Tage'}`
  }, [items, doneMap])

  useEffect(() => {
    if (!items || !subtitle || items.length === 0) return
    let cancelled = false
    let url: string | null = null
    setImage(null)
    setFailed(false)
    import('../lib/gardenImage')
      .then((m) =>
        m.renderGardenImage(items, {
          season,
          names,
          title: 'Mein Hain',
          subtitle,
          footer: `🌱 ${appUrlShort()}`,
        }),
      )
      .then((blob) => {
        if (cancelled) return
        url = URL.createObjectURL(blob)
        setImage({ blob, url })
      })
      .catch((e: unknown) => {
        console.warn('Gartenbild', e)
        if (!cancelled) setFailed(true)
      })
    return () => {
      cancelled = true
      if (url) URL.revokeObjectURL(url)
    }
  }, [items, subtitle, season, names])

  const file = useMemo(() => (image ? new File([image.blob], 'mein-hain.png', { type: 'image/png' }) : null), [image])
  const shareable = !!file && typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })

  async function share() {
    if (!file) return
    try {
      await navigator.share({ files: [file], title: 'Mein Hain' })
    } catch (e) {
      if ((e as Error).name !== 'AbortError') showToast('Teilen ging nicht – sichere das Bild stattdessen', '⚠️')
    }
  }

  const empty = items?.length === 0
  // Auf dem iPhone hat das Teilen-Menü „Bild sichern“ schon; ein Download-Link öffnete
  // in der installierten App nur eine Vollbildansicht
  const offerSave = !shareable || !isIos()

  return (
    <BottomSheet
      labelledBy="share-garden-title"
      onClose={closeShareSheet}
      footer={
        empty ? undefined : (
          <div className="flex flex-col gap-2">
            {shareable && (
              <button type="button" onClick={() => void share()} className="h-13 rounded-2xl bg-accent text-[17px] font-semibold text-accent-ink">
                Bild teilen
              </button>
            )}
            {image ? (
              offerSave && (
                <a
                  href={image.url}
                  download="mein-hain.png"
                  className={`flex h-13 items-center justify-center rounded-2xl text-[17px] ${shareable ? 'bg-surface-2 font-medium' : 'bg-accent font-semibold text-accent-ink'}`}
                >
                  Bild sichern
                </a>
              )
            ) : (
              <button type="button" disabled className="h-13 rounded-2xl bg-surface-2 text-[17px] font-medium text-muted">
                {failed ? 'Bild nicht verfügbar' : 'Wird gemalt …'}
              </button>
            )}
          </div>
        )
      }
    >
      <h2 id="share-garden-title" className="text-lg font-semibold">
        Dein Garten als Bild
      </h2>
      {empty ? (
        <p className="mt-1.5 text-[15px] text-muted">Noch wächst hier nichts. Leg zuerst eine Gewohnheit an.</p>
      ) : (
        <>
          <div className="mt-3 flex justify-center">
            {image ? (
              <img src={image.url} alt="Vorschau: dein Garten als Bild" className="max-h-[48dvh] w-auto max-w-full rounded-2xl shadow-sm" />
            ) : (
              <div
                className="flex aspect-[4/5] max-h-[48dvh] w-full max-w-72 items-center justify-center rounded-2xl bg-surface-2 text-[15px] text-muted"
                aria-live="polite"
              >
                {failed ? 'Das Bild ließ sich nicht malen.' : 'Wird gemalt …'}
              </div>
            )}
          </div>
          <label className="mt-3 flex min-h-12 items-center justify-between gap-3 rounded-2xl bg-surface-2 px-4">
            <span className="text-[16px]">Namen der Gewohnheiten zeigen</span>
            <input type="checkbox" checked={names} onChange={(e) => setNames(e.target.checked)} className="size-5 accent-[var(--accent)]" />
          </label>
          <p className="mt-2 px-1 text-[13px] text-muted">
            {isIos() ? 'Tipp: Im Teilen-Menü „Bild sichern“ wählen – oder das Bild lange drücken.' : 'Tipp: Bild lange drücken, um es direkt zu sichern.'}
          </p>
        </>
      )}
    </BottomSheet>
  )
}
