/**
 * Ein Erfolg als Bild zum Teilen (PNG, 1080 × 1350): Medaille in der Farbe seiner
 * Seltenheit mit Strahlenkranz, darunter Titel und Beschreibung. Direkt auf die
 * Leinwand gezeichnet – keine SVG-Bilder, damit Safari das Bild speichern lässt.
 */
import { TIERS, type Achievement, type Tier } from '../domain/achievements'

const W = 1080
const H = 1350
const FONT = 'ui-rounded, "SF Pro Rounded", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'

export const TIER_COLORS: Record<Tier, { main: string; light: string; dark: string }> = {
  bronze: { main: '#c4874d', light: '#f0c08e', dark: '#7a4a1f' },
  silber: { main: '#a9b5c2', light: '#eef3f8', dark: '#5f6b78' },
  gold: { main: '#e2b33a', light: '#fff0b0', dark: '#8a6110' },
  legendaer: { main: '#b06bff', light: '#e6d0ff', dark: '#4b1f8a' },
}

export async function renderAchievementImage(a: Achievement, opts: { footer: string; category: string }): Promise<Blob> {
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const ctx = c.getContext('2d')
  if (!ctx) throw new Error('Leinwand nicht verfügbar')
  const t = TIER_COLORS[a.tier]
  const cx = W / 2
  const cy = 560

  // Hintergrund: dunkel mit Schein in der Farbe der Seltenheit
  const bg = ctx.createLinearGradient(0, 0, 0, H)
  bg.addColorStop(0, '#11151a')
  bg.addColorStop(1, '#050608')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, W, H)
  const glow = ctx.createRadialGradient(cx, cy, 40, cx, cy, 620)
  glow.addColorStop(0, hexA(t.main, 0.45))
  glow.addColorStop(1, hexA(t.main, 0))
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, W, H)

  // Strahlenkranz
  ctx.save()
  ctx.translate(cx, cy)
  for (let i = 0; i < 24; i++) {
    ctx.rotate((Math.PI * 2) / 24)
    const g = ctx.createLinearGradient(0, 0, 0, -560)
    g.addColorStop(0, hexA(t.light, 0.22))
    g.addColorStop(1, hexA(t.light, 0))
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.moveTo(-14, 0)
    ctx.lineTo(-46, -560)
    ctx.lineTo(46, -560)
    ctx.lineTo(14, 0)
    ctx.closePath()
    ctx.fill()
  }
  ctx.restore()

  // Funken
  for (let i = 0; i < 40; i++) {
    const a1 = i * 2.399
    const r = 260 + ((i * 53) % 280)
    const x = cx + Math.cos(a1) * r
    const y = cy + Math.sin(a1) * r * 0.9
    ctx.fillStyle = hexA(i % 3 ? t.light : '#ffffff', 0.35 + ((i * 7) % 10) / 20)
    ctx.beginPath()
    ctx.arc(x, y, 2 + (i % 4), 0, Math.PI * 2)
    ctx.fill()
  }

  // Medaille: Rand, Körper mit Verlauf, innerer Ring, Glanz
  const R = 230
  ctx.fillStyle = t.dark
  ctx.beginPath()
  ctx.arc(cx, cy + 10, R + 6, 0, Math.PI * 2)
  ctx.fill()
  const body = ctx.createLinearGradient(cx - R, cy - R, cx + R, cy + R)
  body.addColorStop(0, t.light)
  body.addColorStop(0.5, t.main)
  body.addColorStop(1, t.dark)
  ctx.fillStyle = body
  ctx.beginPath()
  ctx.arc(cx, cy, R, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = hexA('#ffffff', 0.55)
  ctx.lineWidth = 6
  ctx.beginPath()
  ctx.arc(cx, cy, R - 30, 0, Math.PI * 2)
  ctx.stroke()
  const inner = ctx.createRadialGradient(cx - 60, cy - 70, 20, cx, cy, R - 34)
  inner.addColorStop(0, hexA('#ffffff', 0.35))
  inner.addColorStop(1, hexA(t.dark, 0.25))
  ctx.fillStyle = inner
  ctx.beginPath()
  ctx.arc(cx, cy, R - 33, 0, Math.PI * 2)
  ctx.fill()
  ctx.font = `230px ${FONT}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(a.emoji, cx, cy + 12)

  // Seltenheit als Schild
  const tierText = `${TIERS[a.tier].emoji} ${TIERS[a.tier].label}-Erfolg`
  ctx.font = `700 34px ${FONT}`
  const tw = ctx.measureText(tierText).width + 56
  ctx.fillStyle = t.main
  roundRect(ctx, cx - tw / 2, cy + R + 36, tw, 62, 31)
  ctx.fill()
  ctx.fillStyle = a.tier === 'silber' || a.tier === 'gold' ? '#1a1407' : '#ffffff'
  ctx.fillText(tierText, cx, cy + R + 68)

  // Titel und Beschreibung
  ctx.fillStyle = '#ffffff'
  ctx.font = `800 76px ${FONT}`
  const titleY = cy + R + 190
  wrap(ctx, a.title, cx, titleY, W - 140, 84).forEach((l, i) => ctx.fillText(l, cx, titleY + i * 84))
  ctx.fillStyle = 'rgba(255,255,255,0.72)'
  ctx.font = `500 38px ${FONT}`
  const lines = wrap(ctx, a.description, cx, 0, W - 200, 50)
  const descY = titleY + (wrap(ctx, a.title, cx, 0, W - 140, 84).length - 1) * 84 + 86
  ctx.font = `500 38px ${FONT}`
  lines.forEach((l, i) => ctx.fillText(l, cx, descY + i * 50))
  ctx.fillStyle = hexA(t.light, 0.85)
  ctx.font = `600 28px ${FONT}`
  ctx.fillText(opts.category.toUpperCase(), cx, 110)

  // Fußzeile
  ctx.font = `600 28px ${FONT}`
  const fw = ctx.measureText(opts.footer).width + 48
  ctx.fillStyle = 'rgba(255,255,255,0.12)'
  roundRect(ctx, cx - fw / 2, H - 100, fw, 54, 27)
  ctx.fill()
  ctx.fillStyle = 'rgba(255,255,255,0.85)'
  ctx.fillText(opts.footer, cx, H - 73)

  return new Promise((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error('Bild konnte nicht erzeugt werden'))), 'image/png'))
}

function hexA(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`
}

/** Text in Zeilen umbrechen (Wort für Wort) */
function wrap(ctx: CanvasRenderingContext2D, text: string, _x: number, _y: number, max: number, _lh: number): string[] {
  const words = text.split(' ')
  const lines: string[] = []
  let line = ''
  for (const w of words) {
    const test = line ? `${line} ${w}` : w
    if (ctx.measureText(test).width > max && line) {
      lines.push(line)
      line = w
    } else line = test
  }
  if (line) lines.push(line)
  return lines
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
