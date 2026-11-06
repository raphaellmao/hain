/**
 * Der Garten als Bild zum Teilen (PNG, 1080 px breit): Himmel und Wiese der
 * aktuellen Jahreszeit bei Tageslicht, davor die echten Pflanzen in Reihen mit
 * leichter Tiefe – hinten kleiner, vorn größer.
 *
 * Die Pflanzen werden einmal unsichtbar mit React gezeichnet und als SVG-Text
 * gelesen; jede kommt als eigenes Bild auf die Leinwand, Reihe für Reihe von
 * hinten nach vorn. Schrift (Titel, Namen) zeichnet die Leinwand selbst – so
 * passen Breiten genau und Emojis erscheinen überall.
 */
import { flushSync } from 'react-dom'
import { createRoot } from 'react-dom/client'
import { HabitVisual } from '../components/HabitVisual'
import { meadowTiles } from '../garden/meadow'
import { mix, rnd, scenePalette, type ScenePalette } from '../garden/palette'
import { HORIZON, plantLayout, W } from '../garden/shareLayout'
import type { HabitSummary } from '../domain/summary'
import type { Habit } from '../domain/types'
import type { Season } from './sky'

export interface GardenImageItem {
  habit: Habit
  summary: HabitSummary
}

export interface GardenImageOptions {
  season: Season
  /** Namen unter den Pflanzen zeigen */
  names: boolean
  title: string
  subtitle: string
  /** klein unten, z. B. die Adresse der App */
  footer: string
}

const MAX_PLANTS = 24
const FONT = 'ui-rounded, "SF Pro Rounded", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'
/** Der Fuß der Pflanze liegt in ihrer Grafik bei 89–90 % der Höhe (Tree.tsx, ShadowDuel.tsx) */
const BASE_AT = 0.9

export async function renderGardenImage(all: GardenImageItem[], o: GardenImageOptions): Promise<Blob> {
  const items = all.slice(0, MAX_PLANTS)
  const p = scenePalette('tag', o.season, 'klar', false)
  const layout = plantLayout(items.length)
  const H = layout.height

  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Leinwand nicht verfügbar')

  // Landschaft
  const meadowPath = `M0 ${HORIZON}Q270 ${HORIZON - 40} 540 ${HORIZON - 8}T1080 ${HORIZON - 14}V${H}H0Z`
  ctx.drawImage(await svgImage(landscape(p, H, meadowPath), W, H), 0, 0)
  // Wiese mit denselben Kacheln wie im Garten der App (doppelt so groß, das Bild ist ja breiter)
  ctx.save()
  ctx.clip(new Path2D(meadowPath))
  for (const tile of meadowTiles(p)) {
    const img = await svgImage(`<svg xmlns="http://www.w3.org/2000/svg" width="${tile.size * 2.2}" height="${tile.size * 2.2}" viewBox="0 0 ${tile.size} ${tile.size}">${tile.body}</svg>`, tile.size * 2.2, tile.size * 2.2)
    const pattern = ctx.createPattern(img, 'repeat')
    if (!pattern) continue
    ctx.fillStyle = pattern
    ctx.fillRect(0, HORIZON - 60, W, H)
  }
  ctx.restore()

  // Pflanzen, Reihe für Reihe von hinten nach vorn
  const svgs = plantSvgs(items)
  for (const spot of layout.spots) {
    groundShadow(ctx, spot.x, spot.base, spot.size, p)
    const img = await svgImage(sized(svgs[spot.index], spot.size), spot.size, spot.size)
    ctx.drawImage(img, spot.x - spot.size / 2, spot.base - spot.size * BASE_AT, spot.size, spot.size)
  }
  // Namen zuletzt, damit keiner hinter einer vorderen Pflanze verschwindet
  if (o.names) {
    for (const spot of layout.spots) {
      const { habit } = items[spot.index]
      label(ctx, `${habit.emoji} ${habit.name}`, spot.x, spot.base + 6 * spot.scale, 24 + 6 * spot.scale, layout.cell * 0.94, p)
    }
  }

  // Titel über dem Himmel
  ctx.save()
  ctx.fillStyle = '#ffffff'
  ctx.shadowColor = 'rgba(10, 30, 60, 0.35)'
  ctx.shadowBlur = 18
  ctx.textBaseline = 'alphabetic'
  ctx.font = `700 84px ${FONT}`
  ctx.fillText(o.title, 64, 150)
  ctx.font = `600 36px ${FONT}`
  ctx.fillText(o.subtitle, 66, 206)
  ctx.restore()

  // Fußzeile
  ctx.save()
  ctx.font = `600 26px ${FONT}`
  const fw = ctx.measureText(o.footer).width + 44
  ctx.fillStyle = 'rgba(255, 255, 255, 0.8)'
  roundRect(ctx, (W - fw) / 2, H - 82, fw, 48, 24)
  ctx.fill()
  ctx.fillStyle = '#16261a'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(o.footer, W / 2, H - 57)
  ctx.restore()

  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Bild konnte nicht erzeugt werden'))), 'image/png'))
}

// ── Pflanzen als SVG-Text ───────────────────────────────────────────────────

function plantSvgs(items: GardenImageItem[]): string[] {
  const host = document.createElement('div')
  host.setAttribute('aria-hidden', 'true')
  host.style.cssText = 'position:fixed;left:-9999px;top:0;width:200px;height:200px;overflow:hidden;pointer-events:none;'
  document.body.append(host)
  const root = createRoot(host)
  try {
    flushSync(() =>
      root.render(
        <>
          {items.map(({ habit, summary }) => (
            <div key={habit.id}>
              <HabitVisual habit={habit} summary={summary} ground={false} />
            </div>
          ))}
        </>,
      ),
    )
    const serializer = new XMLSerializer()
    return [...host.children].map((div) => {
      const svg = div.querySelector('svg')
      return svg ? serializer.serializeToString(svg) : '<svg xmlns="http://www.w3.org/2000/svg"/>'
    })
  } finally {
    root.unmount()
    host.remove()
  }
}

/** Feste Pixelgröße setzen, damit der Browser das SVG scharf in dieser Größe rastert */
function sized(svg: string, size: number): string {
  return svg.replace(/^<svg\b([^>]*)>/, (_, attrs: string) => {
    const clean = attrs.replace(/\s(width|height|class|style)="[^"]*"/g, '')
    return `<svg${clean} width="${size}" height="${size}">`
  })
}

function svgImage(markup: string, w: number, h: number): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(new Blob([markup], { type: 'image/svg+xml;charset=utf-8' }))
  const img = new Image(w, h)
  return new Promise((resolve, reject) => {
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Grafik konnte nicht geladen werden'))
    }
    img.src = url
  })
}

// ── Landschaft ──────────────────────────────────────────────────────────────

function landscape(p: ScenePalette, H: number, meadowPath: string): string {
  const stops = p.sky.map((c, i) => `<stop offset="${i / (p.sky.length - 1)}" stop-color="${c}"/>`).join('')
  const cloud = (x: number, y: number, s: number) =>
    `<g transform="translate(${x} ${y}) scale(${s})" opacity="${p.cloudOpacity}">` +
    `<ellipse cx="0" cy="8" rx="120" ry="30" fill="${p.cloud[1]}" opacity="0.35"/>` +
    `<ellipse cx="-60" cy="0" rx="62" ry="34" fill="${p.cloud[0]}"/><ellipse cx="10" cy="-18" rx="70" ry="48" fill="${p.cloud[0]}"/>` +
    `<ellipse cx="74" cy="2" rx="56" ry="30" fill="${p.cloud[0]}"/><ellipse cx="0" cy="10" rx="118" ry="24" fill="${p.cloud[0]}"/></g>`
  // Waldsaum: runde Kronen verschiedener Größe entlang einer welligen Linie, hinten heller
  const hill = (x: number) => HORIZON - 30 + Math.sin(x / 150 + 1) * 11 + Math.sin(x / 57) * 4
  let back = ''
  let front = ''
  for (let i = 0; i < 64; i++) {
    const x = i * 17.5 + rnd(i, 31) * 12
    const r = 8 + rnd(i, 32) * 15
    const crown = `<circle cx="${x.toFixed(1)}" cy="${(hill(x) + 8 - r * 0.5 - (i % 2 ? 8 : 0)).toFixed(1)}" r="${r.toFixed(1)}"/>`
    if (i % 2) back += crown
    else front += crown
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<defs>
<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">${stops}</linearGradient>
<radialGradient id="sun"><stop offset="0" stop-color="#fffbe6" stop-opacity="0.95"/><stop offset="0.3" stop-color="#fff1b8" stop-opacity="0.55"/><stop offset="1" stop-color="#fff1b8" stop-opacity="0"/></radialGradient>
<linearGradient id="meadow" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${p.meadow[0]}"/><stop offset="1" stop-color="${p.meadow[1]}"/></linearGradient>
<radialGradient id="pool" cx="0.5" cy="0" r="0.8"><stop offset="0" stop-color="${p.pool}"/><stop offset="1" stop-color="${p.pool}" stop-opacity="0"/></radialGradient>
</defs>
<rect width="${W}" height="${HORIZON + 40}" fill="url(#sky)"/>
<circle cx="860" cy="250" r="230" fill="url(#sun)"/>
<circle cx="860" cy="250" r="58" fill="#fffaf0"/>
${cloud(250, 300, 1)}${cloud(700, 420, 0.7)}${cloud(1010, 150, 0.55)}
<path d="M0 ${HORIZON - 70}L130 ${HORIZON - 168}L230 ${HORIZON - 112}L350 ${HORIZON - 206}L470 ${HORIZON - 120}L590 ${HORIZON - 178}L720 ${HORIZON - 104}L850 ${HORIZON - 196}L980 ${HORIZON - 118}L1080 ${HORIZON - 160}V${HORIZON + 20}H0Z" fill="${p.mountain[1]}"/>
<path d="M0 ${HORIZON - 40}Q180 ${HORIZON - 96} 360 ${HORIZON - 52}T720 ${HORIZON - 56}T1080 ${HORIZON - 70}V${HORIZON + 20}H0Z" fill="${p.far}"/>
<g fill="${mix(p.forest, p.far, 0.45)}">${back}</g>
<g fill="${p.forest}">${front}</g>
<path d="${meadowPath}" fill="url(#meadow)"/>
<rect y="${HORIZON - 40}" width="${W}" height="${H - HORIZON + 40}" fill="url(#pool)"/>
</svg>`
}

function groundShadow(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, p: ScenePalette) {
  const rx = size * 0.34
  const ry = size * 0.07
  ctx.save()
  ctx.translate(x, y)
  ctx.scale(1, ry / rx)
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx)
  const c = p.season === 'winter' ? '60, 80, 110' : '40, 60, 20'
  g.addColorStop(0, `rgba(${c}, 0.3)`)
  g.addColorStop(1, `rgba(${c}, 0)`)
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.arc(0, 0, rx, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

function label(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, fontSize: number, maxWidth: number, p: ScenePalette) {
  ctx.save()
  ctx.font = `600 ${Math.round(fontSize)}px ${FONT}`
  const pad = fontSize * 0.6
  // zeichenweise kürzen, ohne ein Emoji zu zerteilen
  const chars = Array.from(text)
  let t = text
  while (chars.length > 2 && ctx.measureText(t).width + pad * 2 > maxWidth) {
    chars.pop()
    t = `${chars.join('').trimEnd()}…`
  }
  const w = ctx.measureText(t).width + pad * 2
  const h = fontSize * 1.55
  ctx.fillStyle = p.labelBg
  roundRect(ctx, x - w / 2, y, w, h, h / 2)
  ctx.fill()
  ctx.fillStyle = p.labelInk
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(t, x, y + h / 2 + 1)
  ctx.restore()
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}
