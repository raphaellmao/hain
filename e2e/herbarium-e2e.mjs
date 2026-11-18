// Seltene Mutationen und Herbarium über die echte Oberfläche, frisches Profil
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
const browser = await puppeteer.launch({ executablePath: EDGE, headless: 'new', userDataDir: mkdtempSync(join(tmpdir(), 'hain-herb-')), args: ['--no-first-run'] })
const page = await browser.newPage()
await page.emulate({ viewport: { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36' })
await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'dark' }])
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
const pad = (n) => String(n).padStart(2, '0')
const ds = (offset) => {
  const d = new Date(Date.now() + offset * 86_400_000)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

await page.goto(`${BASE}/`, { waitUntil: 'networkidle0' })
await sleep(500)
await mod('/src/dev/demo.ts', (m) => m.hainDemo())
// Eine Pflanze mit Goldlaub, 40 Tage gepflegt
const seed = await mod('/src/domain/mutation.ts', (m) => m.seedWith('goldlaub', 5000))
const id = await mod('/src/db/repo.ts', (m, seed, start) => m.createHabit({ name: 'Goldbaum', emoji: '🪙', color: 'gold', days: [0, 1, 2, 3, 4, 5, 6], startDate: start, seed, species: 'apfel', metaphor: 'pflanze' }), seed, ds(-41))
await mod('/src/db/schema.ts', (m, id, days) => m.db.checkins.bulkPut(days.map((d) => ({ id: `${id}_${d}`, habitId: id, date: d, done: true, updatedAt: Date.now() }))), id, Array.from({ length: 40 }, (_, i) => ds(-1 - i)))
await sleep(500)

// Garten: ✨ im Status
await page.goto(`${BASE}/#/garten`, { waitUntil: 'networkidle0' })
await sleep(1000)
const status = await page.evaluate(() => [...document.querySelectorAll('main li')].find((li) => li.textContent.includes('Goldbaum'))?.innerText ?? '')
check('Garten zeigt ✨ bei der Mutation', status.includes('✨'), status.replace(/\n/g, ' | '))

// Detail
await page.goto(`${BASE}/#/habit/${id}`, { waitUntil: 'networkidle0' })
await sleep(1000)
const detail = await page.evaluate(() => document.body.innerText)
check('Detail nennt die Mutation', detail.includes('Seltene Mutation: Goldlaub'))
await shot('hb1-detail-goldlaub')

// Herbarium
await page.goto(`${BASE}/#/erfolge`, { waitUntil: 'networkidle0' })
await sleep(900)
const link = await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.textContent.includes('Herbarium'))?.innerText ?? '')
check('Erfolge: Link zum Herbarium mit Zähler', /Herbarium\s*\d+\/20/.test(link.replace(/\n/g, ' ')), link.replace(/\n/g, ' '))
const secret = await page.evaluate(() => document.body.innerText.includes('Seltene Mutation'))
check('Geheimer Erfolg „Seltene Mutation“ freigeschaltet', secret)
await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.textContent.includes('Herbarium'))?.click())
await sleep(1200)
check('Herbarium öffnet', (await page.evaluate(() => location.hash)) === '#/herbarium')
const info = await page.evaluate(() => ({
  head: document.querySelector('header p')?.textContent ?? '',
  found: document.querySelectorAll('[data-found=true]').length,
  missing: document.querySelectorAll('[data-found=false]').length,
  gold: [...document.querySelectorAll('[data-found=true]')].some((b) => b.textContent.includes('Goldlaub')),
}))
check('Zählt Arten und Mutationen', /\d+ von 20 Arten/.test(info.head) && /1 von 5 Mutationen/.test(info.head), info.head)
check('Gefundene farbig, fehlende als Umriss', info.found >= 2 && info.missing >= 10 && info.found + info.missing === 25, `${info.found} + ${info.missing}`)
check('Goldlaub entdeckt', info.gold)
check('Nicht zu breit', !(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)))
await shot('hb2-herbarium')
await page.evaluate(() => [...document.querySelectorAll('h2')].find((h) => h.textContent.includes('Mutationen'))?.scrollIntoView())
await sleep(400)
await shot('hb3-mutationen')

check('Keine Fehler in der Konsole', errors.length === 0, errors.join(' / '))
await browser.close()
console.log(fails ? `${fails} FEHLER` : 'ALLES OK')
process.exit(fails ? 1 : 0)
