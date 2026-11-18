// Neue Pflanzenarten und Anzeigegröße über die echte Oberfläche, frisches Profil
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
const browser = await puppeteer.launch({ executablePath: EDGE, headless: 'new', userDataDir: mkdtempSync(join(tmpdir(), 'hain-pl-')), args: ['--no-first-run'] })
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
const tap = async (selector, text) => {
  const ok = await page.evaluate((s, t) => {
    const el = [...document.querySelectorAll(s)].find((e) => e.textContent.trim().includes(t))
    el?.click()
    return !!el
  }, selector, text)
  if (!ok) throw new Error(`nicht gefunden: ${text}`)
  await sleep(350)
}
const pad = (n) => String(n).padStart(2, '0')
const ds = (offset) => {
  const d = new Date(Date.now() + offset * 86_400_000)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

// ── Auswahl im Formular ────────────────────────────────────────────────────
await page.goto(`${BASE}/#/neu`, { waitUntil: 'networkidle0' })
await sleep(800)
const groups = await page.evaluate(() => {
  const field = [...document.querySelectorAll('section')].find((s) => s.querySelector('h2')?.textContent === 'Pflanze')
  const rows = [...field.querySelectorAll('.overflow-x-auto')].map((r) => [...r.querySelectorAll('button')].map((b) => b.textContent.trim()))
  return { label: field.textContent.includes('Futuristisch · erfunden'), rows }
})
check('Natürliche Arten inkl. Olivenbaum, Ahorn, Palme', groups.rows[0]?.length === 11 && ['Olivenbaum', 'Ahorn', 'Palme'].every((n) => groups.rows[0].includes(n)), JSON.stringify(groups.rows[0]))
check('Eigene Reihe „Futuristisch“ mit neun Arten', groups.label && JSON.stringify(groups.rows[1]) === JSON.stringify(['Kristallbaum', 'Lumenpilz', 'Orbitalblume', 'Neonfarn', 'Luftqualle', 'Helixranke', 'Solarbaum', 'Glutkoralle', 'Mondlilie']), JSON.stringify(groups.rows[1]))
await page.type('input[placeholder="z. B. 10 Minuten lesen"]', 'Lesen')
await tap('button[aria-pressed]', 'Lumenpilz')
await page.evaluate(() => [...document.querySelectorAll('section')].find((s) => s.querySelector('h2')?.textContent === 'Pflanze')?.scrollIntoView({ block: 'start' }))
await sleep(300)
await shot('pl1-formular')
await tap('button', 'Pflanzen')
await sleep(600)
const saved = await mod('/src/db/schema.ts', (m) => m.db.habits.toArray())
check('Gespeichert als Lumenpilz', saved[0]?.species === 'lumenpilz', saved[0]?.species)

// ── Alle 15 Arten im Garten, ausgewachsen ──────────────────────────────────
const keys = await mod('/src/domain/species.ts', (m) => [...m.SPECIES_KEYS])
await mod(
  '/src/db/repo.ts',
  async (m, keys, start) => {
    for (const [i, species] of keys.entries()) {
      if (species === 'lumenpilz') continue
      await m.createHabit({ name: species, emoji: '•', color: ['koralle', 'flieder', 'blau', 'tuerkis', 'gold', 'rosa'][i % 6], days: [0, 1, 2, 3, 4, 5, 6], startDate: start, seed: 100 + i * 31, species, metaphor: 'pflanze' })
    }
  },
  keys,
  ds(-90),
)
await mod(
  '/src/db/schema.ts',
  async (m, days) => {
    const habits = await m.db.habits.toArray()
    const rows = []
    for (const h of habits) for (const d of days) rows.push({ id: `${h.id}_${d}`, habitId: h.id, date: d, done: true, updatedAt: Date.now() })
    await m.db.checkins.bulkPut(rows)
    await m.db.habits.update(habits.find((h) => h.name === 'Lesen').id, { startDate: days.at(-1), schedule: [{ from: days.at(-1), days: [0, 1, 2, 3, 4, 5, 6] }] })
  },
  Array.from({ length: 90 }, (_, i) => ds(-1 - i)),
)
await page.goto(`${BASE}/?zeit=nacht#/garten`, { waitUntil: 'networkidle0' })
await sleep(1500)
const garden = await page.evaluate(() => document.querySelectorAll('main li:not([data-decor])').length)
check('Garten zeigt alle 20 Pflanzen', garden === 20, String(garden))
await shot('pl2-garten-nacht')
await page.evaluate(() => window.scrollTo(0, 99999))
await sleep(500)
await shot('pl3-garten-nacht-unten')

// Erfolge
await page.goto(`${BASE}/#/erfolge`, { waitUntil: 'networkidle0' })
await sleep(800)
const ach = await page.evaluate(() => document.body.innerText)
check('Erfolg „Zukunftsgärtner“ vorhanden', ach.includes('Zukunftsgärtner'))
check('Neue Erfolge da (Kettenreaktion, Nie zweimal, Futurist …)', ['Kettenreaktion', 'Eiserne Kette', 'Nie zweimal', 'Sieben auf einen Streich', 'Stimmungsbarometer', 'Mit Plan', 'Futurist'].every((t) => ach.includes(t)))
const futurist = await page.evaluate(() => [...document.querySelectorAll('li')].find((li) => li.textContent.includes('Futurist'))?.className.includes('badge-earned'))
check('„Futurist“ freigeschaltet (alle neun erfundenen Arten im Garten)', futurist === true)
await page.evaluate(() => [...document.querySelectorAll('h2')].find((h) => h.textContent.includes('Serien'))?.scrollIntoView())
await sleep(400)
await shot('pl7-erfolge')

// ── Anzeigegröße ───────────────────────────────────────────────────────────
const rowHeight = () => page.evaluate(() => Math.round(document.querySelector('.hrow-btn')?.getBoundingClientRect().height ?? 0))
await page.goto(`${BASE}/`, { waitUntil: 'networkidle0' })
await sleep(800)
const normal = await rowHeight()
check('Normal: Wurzel hat data-density=normal', (await page.evaluate(() => document.documentElement.dataset.density)) === 'normal')
await page.goto(`${BASE}/#/einstellungen`, { waitUntil: 'networkidle0' })
await sleep(500)
await tap('[role=radiogroup][aria-label=Anzeigegröße] button', 'Kompakt')
await page.goto(`${BASE}/`, { waitUntil: 'networkidle0' })
await sleep(800)
const kompakt = await rowHeight()
const visibleK = await page.evaluate(() => [...document.querySelectorAll('.hrow')].filter((r) => r.getBoundingClientRect().bottom < innerHeight).length)
await shot('pl4-heute-kompakt')
await page.goto(`${BASE}/#/einstellungen`, { waitUntil: 'networkidle0' })
await sleep(500)
await tap('[role=radiogroup][aria-label=Anzeigegröße] button', 'Groß')
await page.goto(`${BASE}/`, { waitUntil: 'networkidle0' })
await sleep(800)
const gross = await rowHeight()
const visibleG = await page.evaluate(() => [...document.querySelectorAll('.hrow')].filter((r) => r.getBoundingClientRect().bottom < innerHeight).length)
await shot('pl5-heute-gross')
check('Kompakt < Normal < Groß', kompakt < normal && normal < gross, `${kompakt} / ${normal} / ${gross}`)
check('Kompakt zeigt mehr Zeilen auf einmal', visibleK > visibleG, `${visibleK} vs. ${visibleG}`)
check('Seite nie zu breit', !(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)))

// To-dos: Schnellumschalter
await mod('/src/db/repo.ts', async (m, d) => {
  for (const t of ['Wäsche', 'Zahnarzt anrufen', 'Uniform reinigen', 'Bericht schreiben', 'Einkaufen', 'Geburtstag Papa']) await m.createTodo(crypto.randomUUID(), { title: t, scope: 'tag', date: d, reminders: [] })
}, ds(0)).catch((e) => errors.push(`createTodo: ${e.message}`))
await page.goto(`${BASE}/#/todos`, { waitUntil: 'networkidle0' })
await sleep(700)
const plusDisabled = await page.evaluate(() => document.querySelector('button[aria-label="Größer anzeigen"]')?.disabled)
check('Bei „Groß“ geht es nicht größer', plusDisabled === true)
await page.click('button[aria-label^="Kleiner anzeigen"]')
await sleep(300)
await page.click('button[aria-label^="Kleiner anzeigen"]')
await sleep(500)
const d2 = await page.evaluate(() => ({ d: document.documentElement.dataset.density, check: Math.round(document.querySelector('.todo-check')?.getBoundingClientRect().width ?? 0), minus: document.querySelector('button[aria-label^="Kleiner anzeigen"]')?.disabled }))
check('Zweimal „kleiner“: kompakt, Haken 44 px, weiter geht nicht', d2.d === 'kompakt' && d2.check === 44 && d2.minus === true, JSON.stringify(d2))
await shot('pl6-todos-kompakt')
const backup = await mod('/src/db/backup.ts', async (m) => m.parseBackup(JSON.stringify(await m.createBackup())).settings)
check('Backup behält die Anzeigegröße', backup.density === 'kompakt', JSON.stringify(backup))

check('Keine Fehler in der Konsole', errors.length === 0, errors.join(' / '))
await browser.close()
console.log(fails ? `${fails} FEHLER` : 'ALLES OK')
process.exit(fails ? 1 : 0)
