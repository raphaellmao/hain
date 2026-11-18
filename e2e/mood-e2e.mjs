// Stimmung über die echte Oberfläche, frisches Profil
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

const browser = await puppeteer.launch({ executablePath: EDGE, headless: 'new', userDataDir: mkdtempSync(join(tmpdir(), 'hain-mood-')), args: ['--no-first-run'] })
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
const db = (fn, ...args) =>
  page.evaluate(
    async (src, args) => {
      const { db } = await import('/src/db/schema.ts')
      return new Function('db', 'args', `return (${src})(db, ...args)`)(db, args)
    },
    fn.toString(),
    args,
  )
const pad = (n) => String(n).padStart(2, '0')
const ds = (offset) => {
  const d = new Date(Date.now() + offset * 86_400_000)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
const tapMood = async (label) => {
  const ok = await page.evaluate((label) => {
    const b = document.querySelector(`[role=radiogroup][aria-label=Stimmung] button[aria-label="${label}"]`)
    b?.click()
    return !!b
  }, label)
  if (!ok) throw new Error(`Gesicht ${label} nicht gefunden`)
  await sleep(350)
}
const checked = () => page.evaluate(() => [...document.querySelectorAll('[role=radiogroup] [aria-checked=true]')].map((b) => b.getAttribute('aria-label')))
const entry = (date) => db((db, d) => db.dayEntries.get(d), date)

// ── Heute: ohne Daten ───────────────────────────────────────────────────────
await page.goto(`${BASE}/`, { waitUntil: 'networkidle0' })
await sleep(800)
// Ohne Gewohnheit zeigt „Heute“ den Einstieg – also eine anlegen
await mod('/src/db/repo.ts', (m, start) => m.createHabit({ name: 'Liegestütze', emoji: '💪', color: 'koralle', days: [0, 1, 2, 3, 4, 5, 6], startDate: start, seed: 7, species: 'laubbaum', metaphor: 'pflanze' }), ds(-3))
await sleep(600)
const heading = await page.evaluate(() => document.querySelector('[role=radiogroup]')?.closest('section')?.querySelector('h2')?.textContent)
check('Auswahl erscheint auf „Heute“', heading === 'Wie geht es dir heute?', heading)
check('Nichts gewählt', (await checked()).length === 0)

await tapMood('Gut')
check('Tippen speichert 4', (await entry(ds(0)))?.mood === 4, JSON.stringify(await entry(ds(0))))
check('… und markiert genau ein Gesicht', JSON.stringify(await checked()) === '["Gut"]')
await shot('mood1-heute')

await tapMood('Gut')
let e = await entry(ds(0))
check('Nochmal tippen nimmt sie zurück', e && e.mood === undefined && e.note === '', JSON.stringify(e))
check('… keins mehr markiert', (await checked()).length === 0)

await tapMood('Super')
// Notiz schreiben darf die Stimmung nicht löschen – und umgekehrt
await mod('/src/db/repo.ts', (m, d) => m.setDayNote(d, 'Langer Marsch'), ds(0))
e = await entry(ds(0))
check('Notiz behält die Stimmung', e.mood === 5 && e.note === 'Langer Marsch', JSON.stringify(e))
await tapMood('Geht so')
e = await entry(ds(0))
check('Stimmung behält die Notiz', e.mood === 3 && e.note === 'Langer Marsch', JSON.stringify(e))

// Gestern über den Wochenstreifen
const yesterdayBtn = await page.evaluate((d) => {
  const b = [...document.querySelectorAll('button[aria-pressed], button[aria-current], button')].find((x) => x.getAttribute('aria-label')?.includes(String(+d.slice(8))) && x.closest('[class*=grid], nav, header'))
  if (!b) return null
  b.click()
  return b.getAttribute('aria-label')
}, ds(-1))
await sleep(500)
const heading2 = await page.evaluate(() => document.querySelector('[role=radiogroup]')?.closest('section')?.querySelector('h2')?.textContent)
check('Anderer Tag: Frage in Vergangenheit', heading2 === 'Wie ging es dir?', `${yesterdayBtn} → ${heading2}`)
check('… eigener Tag, eigene Auswahl', (await checked()).length === 0)
await tapMood('Schlecht')
check('Gestern gespeichert, heute unverändert', (await entry(ds(-1)))?.mood === 1 && (await entry(ds(0))).mood === 3)

// ── Erfolge: wenig Daten ───────────────────────────────────────────────────
await page.goto(`${BASE}/#/erfolge`, { waitUntil: 'networkidle0' })
await sleep(700)
let card = await page.evaluate(() => [...document.querySelectorAll('section')].find((s) => s.textContent.includes('Stimmung · letzte 30 Tage'))?.innerText ?? '')
check('Erfolge: Schnitt aus zwei Tagen', card.includes('Ø 2,0') && card.includes('2 Tage bewertet'), card.replace(/\n/g, ' | '))
check('… noch zu wenig für Zusammenhänge', card.includes('Bewerte noch ein paar Tage mehr'))

// ── Backup ─────────────────────────────────────────────────────────────────
const backup = await mod('/src/db/backup.ts', async (m) => {
  const b = await m.createBackup()
  const back = m.parseBackup(JSON.stringify(b))
  return { version: b.version, entries: back.dayEntries.map((e) => [e.date, e.mood ?? null, e.note]) }
})
check('Backup Format 9 mit Stimmung, auch ohne Notiz', backup.version >= 9 && JSON.stringify(backup.entries) === JSON.stringify([[ds(-1), 1, ''], [ds(0), 3, 'Langer Marsch']].sort()), JSON.stringify(backup))

// ── Demo: genug Daten für Zusammenhänge ──────────────────────────────────────
// ?demo greift nur bei leerer Datenbank – hier also direkt aufrufen
await mod('/src/dev/demo.ts', (m) => m.hainDemo())
await sleep(800)
check('Demo überschreibt eigene Stimmung nicht', (await entry(ds(0)))?.mood === 3 && (await entry(ds(-1)))?.mood === 1)
await page.goto(`${BASE}/#/erfolge`, { waitUntil: 'networkidle0' })
await sleep(800)
card = await page.evaluate(() => [...document.querySelectorAll('section')].find((s) => s.textContent.includes('Stimmung · letzte 30 Tage'))?.innerText ?? '')
check('Demo: Zusammenhang gefunden', card.includes('Was deinen Tagen guttut') && card.includes('Früh aufstehen') && card.includes('kein Beweis'), card.replace(/\n/g, ' | '))
const bars = await page.evaluate(() => document.querySelector('[role=img][aria-label^="Schlecht:"]')?.getAttribute('aria-label'))
check('Verteilung für Screenreader beschriftet', /Super: \d+/.test(bars ?? ''), bars)
await page.evaluate(() => [...document.querySelectorAll('section')].find((s) => s.textContent.includes('Stimmung · letzte 30 Tage'))?.scrollIntoView({ block: 'start' }))
await sleep(300)
await shot('mood2-erfolge')
const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)
check('Kein seitliches Scrollen', !overflow)

// ── Wochenrückblick ────────────────────────────────────────────────────────
await page.goto(`${BASE}/#/rueckblick`, { waitUntil: 'networkidle0' })
await sleep(700)
const hero = await page.evaluate(() => document.querySelector('main section p')?.innerText ?? '')
check('Rückblick zeigt Stimmung der Woche', /Stimmung Ø \d,\d/.test(hero), hero.replace(/\n/g, ' | '))
await shot('mood3-rueckblick')

// ── Handybreite 320 und dunkel ──────────────────────────────────────────────
await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'dark' }])
await page.setViewport({ width: 320, height: 640, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
await page.goto(`${BASE}/`, { waitUntil: 'networkidle0' })
await sleep(800)
await page.evaluate(() => document.querySelector('[role=radiogroup]')?.scrollIntoView({ block: 'center' }))
await sleep(300)
await shot('mood4-heute-320-dunkel')
check('320 px: kein seitliches Scrollen', !(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)))
const sizes = await page.evaluate(() => [...document.querySelectorAll('[role=radiogroup] button')].map((b) => Math.round(b.getBoundingClientRect().width)))
check('320 px: Gesichter groß genug zum Tippen (≥ 44 px)', sizes.every((w) => w >= 44), sizes.join(','))

check('Keine Fehler in der Konsole', errors.length === 0, errors.join(' / '))
await browser.close()
console.log(fails ? `${fails} FEHLER` : 'ALLES OK')
process.exit(fails ? 1 : 0)
