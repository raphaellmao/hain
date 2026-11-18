import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { AnimatePresence } from 'motion/react'
import { doneFor, useDoneMap } from '../db/hooks'
import { useGardenItems } from '../garden/useGardenItems'
import { appUrl, appUrlShort, closeShareSheet, sharedAchievementId, useShareSheet } from '../lib/shareSheet'
import { useAchievements } from '../app/achievements'
import { CATEGORIES } from '../domain/achievements'
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
      {kind === 'erfolg' && <AchievementSheet key="erfolg" />}
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

  const subtitle = useMemo(() => {
    if (!items || !doneMap) return null
    const n = items.length
    const done = items.reduce((sum, { habit }) => sum + doneFor(doneMap, habit.id).size, 0)
    return `${n} ${n === 1 ? 'Gewohnheit' : 'Gewohnheiten'} · ${done} ${done === 1 ? 'erledigter Tag' : 'erledigte Tage'}`
  }, [items, doneMap])

  const render = useMemo(
    () =>
      items && subtitle && items.length > 0
        ? () => import('../lib/gardenImage').then((m) => m.renderGardenImage(items, { season, names, title: 'Mein Hain', subtitle, footer: `🌱 ${appUrlShort()}` }))
        : null,
    [items, subtitle, season, names],
  )

  return (
    <ImageSheet
      id="share-garden-title"
      title="Dein Garten als Bild"
      alt="Vorschau: dein Garten als Bild"
      filename="mein-hain.png"
      shareTitle="Mein Hain"
      render={render}
      empty={items?.length === 0 ? 'Noch wächst hier nichts. Leg zuerst eine Gewohnheit an.' : undefined}
    >
      <label className="mt-3 flex min-h-12 items-center justify-between gap-3 rounded-2xl bg-surface-2 px-4">
        <span className="text-[16px]">Namen der Gewohnheiten zeigen</span>
        <input type="checkbox" checked={names} onChange={(e) => setNames(e.target.checked)} className="size-5 accent-[var(--accent)]" />
      </label>
    </ImageSheet>
  )
}

function AchievementSheet() {
  const list = useAchievements()
  const id = sharedAchievementId()
  const a = list?.find((x) => x.id === id && x.achieved)
  const render = useMemo(
    () =>
      a
        ? () => import('../lib/achievementImage').then((m) => m.renderAchievementImage(a, { footer: `🌱 Hain · ${appUrlShort()}`, category: CATEGORIES[a.category] }))
        : null,
    [a?.id],
  )
  return (
    <ImageSheet
      id="share-achievement-title"
      title={a ? `„${a.title}“ teilen` : 'Erfolg teilen'}
      alt={a ? `Erfolg ${a.title} als Bild` : 'Erfolg als Bild'}
      filename={`hain-erfolg-${id ?? 'x'}.png`}
      shareTitle={a ? `Erfolg: ${a.title}` : 'Hain'}
      render={render}
      empty={list && !a ? 'Diesen Erfolg hast du noch nicht.' : undefined}
    />
  )
}

/**
 * Blatt mit einem erzeugten Bild: Vorschau, „Bild teilen“ (Teilen-Menü mit Datei)
 * und „Bild sichern“ (Download; auf dem iPhone nicht nötig, das Teilen-Menü kann es).
 */
function ImageSheet({
  id,
  title,
  alt,
  filename,
  shareTitle,
  render,
  empty,
  children,
}: {
  id: string
  title: string
  alt: string
  filename: string
  shareTitle: string
  /** null = noch nichts zu malen (Daten laden) */
  render: (() => Promise<Blob>) | null
  empty?: string
  children?: React.ReactNode
}) {
  const [image, setImage] = useState<{ blob: Blob; url: string } | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!render) return
    let cancelled = false
    let url: string | null = null
    setImage(null)
    setFailed(false)
    render()
      .then((blob) => {
        if (cancelled) return
        url = URL.createObjectURL(blob)
        setImage({ blob, url })
      })
      .catch((e: unknown) => {
        console.warn('Bild', e)
        if (!cancelled) setFailed(true)
      })
    return () => {
      cancelled = true
      if (url) URL.revokeObjectURL(url)
    }
  }, [render])

  const file = useMemo(() => (image ? new File([image.blob], filename, { type: 'image/png' }) : null), [image, filename])
  const shareable = !!file && typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })
  const offerSave = !shareable || !isIos()

  async function share() {
    if (!file) return
    try {
      await navigator.share({ files: [file], title: shareTitle })
    } catch (e) {
      if ((e as Error).name !== 'AbortError') showToast('Teilen ging nicht – sichere das Bild stattdessen', '⚠️')
    }
  }

  return (
    <BottomSheet
      labelledBy={id}
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
                  download={filename}
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
      <h2 id={id} className="text-lg font-semibold">
        {title}
      </h2>
      {empty ? (
        <p className="mt-1.5 text-[15px] text-muted">{empty}</p>
      ) : (
        <>
          <div className="mt-3 flex justify-center">
            {image ? (
              <img src={image.url} alt={alt} className="max-h-[48dvh] w-auto max-w-full rounded-2xl shadow-sm" />
            ) : (
              <div
                className="flex aspect-[4/5] max-h-[48dvh] w-full max-w-72 items-center justify-center rounded-2xl bg-surface-2 text-[15px] text-muted"
                aria-live="polite"
              >
                {failed ? 'Das Bild ließ sich nicht malen.' : 'Wird gemalt …'}
              </div>
            )}
          </div>
          {children}
          <p className="mt-2 px-1 text-[13px] text-muted">
            {isIos() ? 'Tipp: Im Teilen-Menü „Bild sichern“ wählen – oder das Bild lange drücken.' : 'Tipp: Bild lange drücken, um es direkt zu sichern.'}
          </p>
        </>
      )}
    </BottomSheet>
  )
}
