// Gartendeko, Anzeigegröße im Garten/Erfolge und Reaktionen des Schatten-Ichs
import puppeteer from 'puppeteer-core'
import { mkdtempSync } from 'node:fs'
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
const browser = await puppeteer.launch({ executablePath: EDGE, headless: 'new', userDataDir: mkdtempSync(join(tmpdir(), 'hain-deko-')), args: ['--no-first-run'] })
const page = await browser.newPage()
await page.emulate({ viewport: { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36' })
const errors = []
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
page.on('console', (m) => {
  if (m.type() === 'error' && !/favicon|404/.test(m.text())) errors.push(`console: ${m.text()}`)
})
const shot = (name) => page.screenshot({ path: join(OUT, `${name}.png`) })
const mod = (path, fn, ...args) =>
  page.evaluate(
    async (path, src, args) => {
      const m = await import(path)
      return new Function('m', 'args', `return (${src})(m, ...args)`)(m, args)
    },
    path,
    fn.toString(),
    args,
  )

// Demo-Daten (viele erfüllte Erfolge) – dazu Monate perfekt für alle Deko
await page.goto(`${BASE}/`, { waitUntil: 'networkidle0' })
await sleep(500)
await mod('/src/dev/demo.ts', (m) => m.hainDemo())
await sleep(800)
await page.goto(`${BASE}/?zeit=abend#/garten`, { waitUntil: 'networkidle0' })
await sleep(1500)
const decor = await page.evaluate(() => [...document.querySelectorAll('[data-decor]')].map((d) => d.getAttribute('data-decor')))
check('Gartendeko erscheint (aus erreichten Erfolgen)', decor.length >= 3, decor.join(', '))
const cols = await page.evaluate(() => document.querySelector('main ul')?.getAttribute('data-cols'))
check('Normal: 3 Spalten', cols === '3', cols)
await page.evaluate(() => document.querySelector('[data-decor]')?.scrollIntoView({ block: 'center' }))
await sleep(600)
await shot('dk1-deko-abend')
await page.evaluate(() => document.querySelector('[data-decor] button')?.click())
await sleep(400)
check('Tippen erklärt die Herkunft', (await page.evaluate(() => document.body.innerText)).includes('freigeschaltet durch'))

// Kompakt: 4 Spalten im Garten, 3 bei den Erfolgen
await mod('/src/db/repo.ts', (m) => m.saveSettings({ density: 'kompakt' }))
await sleep(500)
check('Kompakt: 4 Spalten im Garten', (await page.evaluate(() => document.querySelector('main ul')?.getAttribute('data-cols'))) === '4')
await page.evaluate(() => window.scrollTo(0, 0))
await sleep(400)
await shot('dk2-garten-kompakt')
await page.goto(`${BASE}/#/erfolge`, { waitUntil: 'networkidle0' })
await sleep(900)
const achCols = await page.evaluate(() => getComputedStyle(document.querySelector('.ach-grid')).gridTemplateColumns.split(' ').length)
check('Kompakt: Erfolge in 3 Spalten', achCols === 3, String(achCols))
await page.evaluate(() => document.querySelector('.ach-grid')?.scrollIntoView())
await sleep(300)
await shot('dk3-erfolge-kompakt')
await mod('/src/db/repo.ts', (m) => m.saveSettings({ density: 'normal' }))

// Schatten-Ich: Siegerpose bei „Dein Land“ (Demo: „Sport“ = demo-11 hat gewonnen)
await page.goto(`${BASE}/#/habit/demo-11`, { waitUntil: 'networkidle0' })
await sleep(1200)
const pose = await page.evaluate(() => [...document.querySelectorAll('svg g[transform*="rotate(-80"]')].length)
check('Siegerpose: Schwert nach oben', pose >= 1, String(pose))
await shot('dk4-sieg')

// Er rückt vor: „Kein Social Media“ (demo-13) – heute verpasst nachtragen geht nicht, also gestern abhaken/zurücknehmen
const before = await page.evaluate(() => 0)
await page.goto(`${BASE}/#/habit/demo-13`, { waitUntil: 'networkidle0' })
await sleep(1200)
// Zustand ändern: einen erledigten Tag zurücknehmen → Schatten rückt vor
await mod('/src/db/schema.ts', async (m) => {
  const c = (await m.db.checkins.where('habitId').equals('demo-13').toArray()).filter((x) => x.done).sort((a, b) => b.date.localeCompare(a.date))[0]
  if (c) await m.db.checkins.update(c.id, { done: false, updatedAt: Date.now() })
})
await sleep(380)
const swing = await page.evaluate(() => {
  const g = [...document.querySelectorAll('svg g[transform*="27 -59"]')][0]
  return g?.getAttribute('transform') ?? null
})
check('Er rückt vor: Sense holt aus (mitten in der Bewegung)', !!swing && !/rotate\(0 /.test(swing), String(swing))
await shot('dk5-sense')
await sleep(1500)
const after = await page.evaluate(() => [...document.querySelectorAll('svg g[transform*="27 -59"]')][0]?.getAttribute('transform'))
check('… und kehrt zurück', !after || /rotate\(0 27 -59\)/.test(after), String(after))
void before

check('Keine Fehler in der Konsole', errors.length === 0, errors.join(' / '))
await browser.close()
console.log(fails ? `${fails} FEHLER` : 'ALLES OK')
process.exit(fails ? 1 : 0)
