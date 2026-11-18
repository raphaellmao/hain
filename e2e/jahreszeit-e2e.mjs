// Jahreszeiten an den Pflanzen und Erfolge als Bild – über die echte Oberfläche
import puppeteer from 'puppeteer-core'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const BASE = process.env.BASE ?? 'http://localhost:5173'
const OUT = new URL('./bilder/', import.meta.url).pathname.replace(/^\/(\w:)/, '$1')
;(await import('node:fs')).mkdirSync(OUT, { recursive: true })
const EDGE = process.env.EDGE ?? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let fails = 0
const check = (name, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${name}${extra ? ` – ${extra}` : ''}`)
}
const browser = await puppeteer.launch({ executablePath: EDGE, headless: 'new', userDataDir: mkdtempSync(join(tmpdir(), 'hain-jz-')), args: ['--no-first-run'] })
const page = await browser.newPage()
await page.emulate({ viewport: { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36' })
const errors = []
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
page.on('console', (m) => {
  if (m.type() === 'error' && !/favicon|404/.test(m.text())) errors.push(`console: ${m.text()}`)
})
const shot = (name) => page.screenshot({ path: join(OUT, `${name}.png`) })

await page.goto(`${BASE}/`, { waitUntil: 'networkidle0' })
await sleep(400)
await page.evaluate(async () => (await import('/src/dev/demo.ts')).hainDemo())
// Ein gesunder Ahorn (die Demo-Laubbäume welken teils – welk bleibt bewusst welk)
await page.evaluate(async () => {
  const id = await (await import('/src/db/repo.ts')).createHabit({ name: 'Herbstbaum', emoji: '🍁', color: 'gold', days: [0, 1, 2, 3, 4, 5, 6], startDate: '2026-01-01', seed: 21, species: 'ahorn', metaphor: 'pflanze' })
  const pad = (n) => String(n).padStart(2, '0')
  const rows = Array.from({ length: 60 }, (_, i) => {
    const d = new Date(Date.now() - (i + 1) * 86_400_000)
    const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
    return { id: `${id}_${date}`, habitId: id, date, done: true, updatedAt: Date.now() }
  })
  await (await import('/src/db/schema.ts')).db.checkins.bulkPut(rows)
  await (await import('/src/db/schema.ts')).db.habits.update(id, { startDate: rows.at(-1).date, schedule: [{ from: rows.at(-1).date, days: [0, 1, 2, 3, 4, 5, 6] }] })
})
await sleep(700)

/** Farbtöne der Blätter des gesunden Ahorns im Garten */
const leafHues = () =>
  page.evaluate(() => {
    const li = [...document.querySelectorAll('main li')].find((x) => x.textContent.includes('Herbstbaum'))
    return [...(li?.querySelectorAll('.sway path') ?? [])]
      .map((p) => p.getAttribute('fill') ?? '')
      .map((f) => /^hsl\(([\d.]+) ([\d.]+)%/.exec(f))
      .filter(Boolean)
      .map((m) => [Number(m[1]), Number(m[2])])
  })
for (const saison of ['sommer', 'herbst', 'winter']) {
  await page.goto(`${BASE}/?saison=${saison}&zeit=tag&wetter=klar#/garten`, { waitUntil: 'networkidle0' })
  await sleep(1200)
  const hues = await leafHues()
  const snow = await page.evaluate(() => document.querySelectorAll('[data-snow]').length)
  const autumn = hues.filter(([h, s]) => h < 60 && s >= 70).length
  if (saison === 'herbst') check('Herbst: gesunder Ahorn färbt sich rot bis gold', autumn > hues.length * 0.5, `${autumn} von ${hues.length}`)
  if (saison === 'sommer') check('Sommer: grün, kein Schnee', autumn < hues.length * 0.2 && snow === 0, `${autumn}/${hues.length}, Schnee ${snow}`)
  if (saison === 'winter') check('Winter: Schnee auf Ästen und Tannen', snow > 10, String(snow))
  await shot(`jz-garten-${saison}`)
}
// Erfundene Arten bleiben unberührt
await page.evaluate(async () => {
  const m = await import('/src/db/repo.ts')
  await m.createHabit({ name: 'Qualle', emoji: '🪼', color: 'blau', days: [0, 1, 2, 3, 4, 5, 6], startDate: '2026-01-01', seed: 9, species: 'qualle', metaphor: 'pflanze' })
})
await page.goto(`${BASE}/?saison=winter#/garten`, { waitUntil: 'networkidle0' })
await sleep(1000)
const jellySnow = await page.evaluate(() => [...document.querySelectorAll('main li')].find((x) => x.textContent.includes('Qualle'))?.querySelectorAll('[data-snow]').length ?? -1)
check('Erfundene Art bekommt keinen Schnee', jellySnow === 0, String(jellySnow))

// ── Erfolg als Bild ─────────────────────────────────────────────────────────
await page.goto(`${BASE}/#/erfolge`, { waitUntil: 'networkidle0' })
await sleep(1000)
const btn = await page.$('button[aria-label$="als Bild teilen"]')
check('Freigeschaltete Erfolge sind antippbar', !!btn)
const label = await page.evaluate((b) => b?.getAttribute('aria-label'), btn)
await btn?.click()
let info = null
for (let i = 0; i < 40 && !info; i++) {
  await sleep(250)
  info = await page.evaluate(async () => {
    const img = document.querySelector('[role=dialog] img')
    if (!img?.complete || !img.naturalWidth) return null
    const blob = await (await fetch(img.src)).blob()
    const buf = new Uint8Array(await blob.arrayBuffer())
    let bin = ''
    for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000))
    return { w: img.naturalWidth, h: img.naturalHeight, title: document.querySelector('[role=dialog] h2')?.textContent, b64: btoa(bin), save: document.querySelector('[role=dialog] a[download]')?.getAttribute('download') }
  })
}
check('Erfolgsbild 1080 × 1350', info?.w === 1080 && info?.h === 1350, info && `${info.w}×${info.h}`)
check('Titel nennt den Erfolg', !!info?.title && label?.startsWith(info.title.replace(/^„|“ teilen$/g, '')), `${info?.title} / ${label}`)
check('Speichern als hain-erfolg-….png', /^hain-erfolg-.+\.png$/.test(info?.save ?? ''), info?.save)
if (info) writeFileSync(join(OUT, 'jz-erfolgsbild.png'), Buffer.from(info.b64, 'base64'))
await shot('jz-erfolg-blatt')
// Nicht freigeschaltete sind nicht antippbar
const locked = await page.evaluate(() => [...document.querySelectorAll('.badge:not(.badge-earned)')].some((li) => li.querySelector('button')))
check('Gesperrte Erfolge sind nicht antippbar', !locked)

check('Keine Fehler in der Konsole', errors.length === 0, errors.join(' / '))
await browser.close()
console.log(fails ? `${fails} FEHLER` : 'ALLES OK')
process.exit(fails ? 1 : 0)
