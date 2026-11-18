// „Nie zweimal aussetzen“ über die echte Oberfläche, frisches Profil
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

const browser = await puppeteer.launch({ executablePath: EDGE, headless: 'new', userDataDir: mkdtempSync(join(tmpdir(), 'hain-miss-')), args: ['--no-first-run'] })
const page = await browser.newPage()
await page.emulate({ viewport: { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36' })
const errors = []
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
page.on('console', (m) => {
  if (m.type() === 'error' && !/favicon|404/.test(m.text())) errors.push(`console: ${m.text()}`)
})
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
/** Hinweis je Zeile: Name → Text oder null */
const hints = () =>
  page.evaluate(() =>
    Object.fromEntries(
      [...document.querySelectorAll('main button[aria-pressed]')].map((b) => [b.getAttribute('aria-label').split(' ')[0], b.querySelector('[data-missed]')?.textContent.replace('⚠️ ', '') ?? null]),
    ),
  )

await page.goto(`${BASE}/`, { waitUntil: 'networkidle0' })
await sleep(500)
// Lesen: vorgestern erledigt, gestern nicht · Sport: nie · Wasser: gestern erledigt · Dehnen: gestern ausgesetzt
const specs = [
  ['Lesen', -4, [-2], []],
  ['Sport', -5, [], []],
  ['Wasser', -3, [-1], []],
  ['Dehnen', -3, [-2], [-1]],
]
const ids = {}
for (const [name, start, done, excused] of specs) {
  ids[name] = await mod('/src/db/repo.ts', (m, name, start) => m.createHabit({ name, emoji: '•', color: 'koralle', days: [0, 1, 2, 3, 4, 5, 6], startDate: start, seed: 5, species: 'laubbaum', metaphor: 'pflanze' }), name, ds(start))
  await mod(
    '/src/db/schema.ts',
    (m, id, done, excused) =>
      Promise.all([
        ...done.map((d) => m.db.checkins.put({ id: `${id}_${d}`, habitId: id, date: d, done: true, updatedAt: Date.now() })),
        ...excused.map((d) => m.db.checkins.put({ id: `${id}_${d}`, habitId: id, date: d, done: false, excused: true, reason: 'sonst', updatedAt: Date.now() })),
      ]),
    ids[name],
    done.map(ds),
    excused.map(ds),
  )
}
await page.goto(`${BASE}/`, { waitUntil: 'networkidle0' })
await sleep(800)
let h = await hints()
check('Gestern verpasst', h.Lesen === 'Gestern hast du’s schon verpasst', JSON.stringify(h))
check('Mehrmals verpasst', h.Sport === 'Schon 5× in Folge verpasst', h.Sport)
check('Gestern erledigt: kein Hinweis', h.Wasser === null)
check('Gestern ausgesetzt: kein Hinweis', h.Dehnen === null)
const label = await page.evaluate(() => [...document.querySelectorAll('main button[aria-pressed]')].find((b) => b.getAttribute('aria-label').startsWith('Lesen'))?.getAttribute('aria-label'))
check('Auch für Screenreader', label === 'Lesen abhaken. Gestern hast du’s schon verpasst', label)
await page.screenshot({ path: join(OUT, 'nz1-heute.png') })

await page.evaluate(() => [...document.querySelectorAll('main button[aria-pressed]')].find((b) => b.getAttribute('aria-label').startsWith('Lesen'))?.click())
await sleep(600)
h = await hints()
check('Heute abgehakt: Hinweis weg', h.Lesen === null, JSON.stringify(h))

// Gestern in der Wochenleiste: dort keine Hinweise
await page.evaluate((d) => [...document.querySelectorAll('button')].find((b) => b.getAttribute('aria-label')?.includes(String(+d.slice(8))) && !b.closest('main'))?.click(), ds(-1))
await sleep(500)
const past = await page.evaluate(() => document.querySelectorAll('main [data-missed]').length)
const title = await page.evaluate(() => document.querySelector('h1')?.textContent)
check('Vergangener Tag: keine Hinweise', past === 0 && title !== 'Heute', `${title}, ${past}`)

check('Keine Fehler in der Konsole', errors.length === 0, errors.join(' / '))
await browser.close()
console.log(fails ? `${fails} FEHLER` : 'ALLES OK')
process.exit(fails ? 1 : 0)
