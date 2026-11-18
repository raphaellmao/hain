// Abwesenheiten über die echte Oberfläche, frisches Profil
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

const browser = await puppeteer.launch({ executablePath: EDGE, headless: 'new', userDataDir: mkdtempSync(join(tmpdir(), 'hain-abs-')), args: ['--no-first-run'] })
const page = await browser.newPage()
await page.emulate({ viewport: { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36' })
const errors = []
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
page.on('console', (m) => {
  if (m.type() === 'error' && !/favicon|404/.test(m.text())) errors.push(`console: ${m.text()}`)
})
const shot = (name) => page.screenshot({ path: join(OUT, `${name}.png`) })
const tap = async (selector, text) => {
  const ok = await page.evaluate((selector, text) => {
    const el = [...document.querySelectorAll(selector)].find((e) => e.textContent.trim().includes(text))
    if (!el) return false
    el.click()
    return true
  }, selector, text)
  if (!ok) throw new Error(`nicht gefunden: ${selector} „${text}“`)
  await sleep(200)
}
const setDate = (label, value) =>
  page.evaluate((label, value) => {
    const input = [...document.querySelectorAll('[role=dialog] label')].find((l) => l.textContent.includes(label)).querySelector('input')
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  }, label, value)
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
const today = ds(0)
const body = () => page.evaluate(() => document.body.innerText)
const sheetOpen = () => page.evaluate(() => !!document.querySelector('[role=dialog]'))
const rowText = (name) => page.evaluate((name) => [...document.querySelectorAll('main li')].find((li) => li.innerText.includes(name))?.innerText ?? '', name)

await page.goto(`${BASE}/`, { waitUntil: 'networkidle0' })
await sleep(500)
// Zwei Gewohnheiten: „Laufen“ seit 10 Tagen, die letzten 5 verpasst (welkt); „Lesen“ jeden Tag erledigt
await page.evaluate(async (days) => {
  const { db } = await import('/src/db/schema.ts')
  const all = [0, 1, 2, 3, 4, 5, 6]
  const habit = (id, name, emoji, order) => ({ id, name, emoji, color: 'blau', seed: 5 + order, order, startDate: days[0], schedule: [{ from: days[0], days: all }], deleted: false, createdAt: 1, updatedAt: 1 })
  await db.habits.bulkPut([habit('lauf', 'Laufen', '🏃', 1), habit('lies', 'Lesen', '📖', 2)])
  const checkins = []
  for (const [i, d] of days.entries()) {
    if (i < 5) checkins.push({ id: `lauf_${d}`, habitId: 'lauf', date: d, done: true, updatedAt: 1 })
    if (i < days.length - 1) checkins.push({ id: `lies_${d}`, habitId: 'lies', date: d, done: true, updatedAt: 1 })
  }
  await db.checkins.bulkPut(checkins)
}, Array.from({ length: 11 }, (_, i) => ds(i - 10)))
await page.reload({ waitUntil: 'networkidle0' })
await sleep(600)
check('Ausgangslage: Laufen welkt', (await rowText('Laufen')).includes('welkt'), await rowText('Laufen'))

// ── Rückwirkend für Laufen eintragen ─────────────────────────────────────────
await page.goto(`${BASE}/#/einstellungen`, { waitUntil: 'networkidle0' })
await sleep(500)
check('Einstellungen: Bereich Abwesenheit', (await body()).includes('Abwesenheit planen'))
await tap('button', '+ Abwesenheit planen')
await sleep(400)
check('Blatt öffnet', await sheetOpen())
await shot('abw1-blatt')
await setDate('Von', ds(-5))
await sleep(100)
await setDate('Bis', ds(-1))
await sleep(100)
await tap('[role=dialog] button', 'Krank')
await tap('[role=dialog] button', 'Laufen')
await sleep(150)
const btn = await page.evaluate(() => document.querySelector('[role=dialog] button[type=submit]').textContent)
check('Knopf nennt die Länge', btn.includes('5 Tage'), btn)
await tap('[role=dialog] button[type=submit]', 'eintragen')
await sleep(500)
let abs = await db((db) => db.absences.toArray())
check('Gespeichert: nur Laufen, krank, 5 Tage', abs.length === 1 && JSON.stringify(abs[0].habitIds) === '["lauf"]' && abs[0].reason === 'krank' && abs[0].from === ds(-5) && abs[0].to === ds(-1), JSON.stringify(abs[0]))
check('Liste in den Einstellungen', (await body()).includes('vorbei'))
await page.goto(`${BASE}/`, { waitUntil: 'networkidle0' })
await sleep(600)
check('Laufen welkt nicht mehr', !(await rowText('Laufen')).includes('welkt'), await rowText('Laufen'))
check('… Serie läuft weiter', (await rowText('Laufen')).includes('5 Tage in Folge'), await rowText('Laufen'))
check('Lesen ist nicht betroffen', !(await rowText('Lesen')).includes('Ausgesetzt'))
check('Kein Hinweis auf „Heute“, sie ist vorbei', !(await body()).includes('Früher zurück'))

// Ausnahme-Blatt für gestern: Abwesenheit erkannt, Zähler zählt sie nicht
await page.evaluate(() => [...document.querySelectorAll('header button')][5].click())
await sleep(400)
await page.evaluate(() => [...document.querySelectorAll('main li')].find((li) => li.innerText.includes('Laufen')).querySelector('button[aria-label*="Details"]').click())
await sleep(450)
const sheet = await page.evaluate(() => document.querySelector('[role=dialog]').innerText)
check('Blatt erkennt den Abwesenheitstag', sheet.includes('Abwesend') && sheet.includes('Krank'), sheet.slice(0, 120).replace(/\n/g, ' | '))
check('Zähler zählt Abwesenheit nicht als Ausnahme', sheet.includes('Ausnahmen in den letzten 30 Tagen: 0'))
await tap('[role=dialog] button', 'Bearbeiten')
await sleep(900)
const swapped = await page.evaluate(() => document.querySelector('[role=dialog]')?.innerText ?? '')
check('„Bearbeiten“ wechselt ins Abwesenheits-Blatt und bleibt offen', swapped.includes('Abwesenheit bearbeiten'), swapped.slice(0, 60))
check('… ohne Rest im Verlauf', await page.evaluate(() => history.state?.sheet !== undefined))
await page.evaluate(() => history.back())
await sleep(600)
check('Zurück schließt nur das Blatt', !(await sheetOpen()) && (await page.evaluate(() => location.hash === '' || location.hash === '#/')))

// ── Ab heute für alle ────────────────────────────────────────────────────────
await page.evaluate(() => [...document.querySelectorAll('header button')][6].click())
await sleep(400)
await page.evaluate(() => [...document.querySelectorAll('main li')].find((li) => li.innerText.includes('Lesen')).querySelector('button[aria-label*="Details"]').click())
await sleep(450)
await tap('[role=dialog] button', 'Abwesenheit planen')
await sleep(900)
check('„Länger weg?“ öffnet das Abwesenheits-Blatt', (await page.evaluate(() => document.querySelector('[role=dialog]')?.innerText ?? '')).includes('Abwesenheit planen'))
await tap('[role=dialog] button', '2 Wochen')
await page.type('[role=dialog] input[aria-label="Notiz zur Abwesenheit"]', 'Ostsee')
// falsch herum: Ende vor Anfang
await setDate('Bis', ds(-3))
await sleep(150)
check('Ende vor Anfang wird abgelehnt', await page.evaluate(() => document.querySelector('[role=dialog] button[type=submit]').disabled && document.querySelector('[role=dialog]').innerText.includes('vor dem Anfang')))
await tap('[role=dialog] button', '2 Wochen')
await shot('abw2-blatt-urlaub')
await tap('[role=dialog] button[type=submit]', 'eintragen')
await sleep(600)
abs = await db((db) => db.absences.filter((a) => a.note === 'Ostsee').first())
check('Urlaub für alle, 14 Tage ab heute', abs && !abs.habitIds && abs.reason === 'urlaub' && abs.from === today && abs.to === ds(13), JSON.stringify(abs))
const t = await body()
check('„Heute“ zeigt den Hinweis', t.includes('Urlaub · Ostsee') && t.includes('Alle Gewohnheiten pausieren') && t.includes('Früher zurück'))
check('Gewohnheiten stehen als ausgesetzt da', (await rowText('Lesen')).includes('Ausgesetzt · Urlaub'), await rowText('Lesen'))
await shot('abw3-heute')

// Neue Gewohnheit wird von „alle“ erfasst
await db((db, d) => db.habits.put({ id: 'neu', name: 'Neu', emoji: '🌱', color: 'gold', seed: 9, order: 3, startDate: d, schedule: [{ from: d, days: [0, 1, 2, 3, 4, 5, 6] }], deleted: false, createdAt: 1, updatedAt: 1 }), today)
await sleep(600)
check('Auch später angelegte pausieren', (await rowText('Neu')).includes('Ausgesetzt'), await rowText('Neu'))

// Abhaken trotz Urlaub geht
await page.evaluate(() => [...document.querySelectorAll('main li')].find((li) => li.innerText.includes('Lesen')).querySelector('button').click())
await sleep(500)
check('Abhaken schlägt Abwesenheit', (await db((db, id) => db.checkins.get(id), `lies_${today}`))?.done === true)

// Früher zurück
await tap('button', 'Früher zurück')
await sleep(600)
check('Früher zurück: heute begonnen → gelöscht', (await db((db, id) => db.absences.get(id), abs.id))?.deleted === true)
check('… Hinweis weg, Gewohnheiten wieder offen', !(await body()).includes('Früher zurück') && !(await rowText('Neu')).includes('Ausgesetzt'))

// Backup
const backup = await page.evaluate(async () => {
  const { createBackup, parseBackup, restoreBackup } = await import('/src/db/backup.ts')
  const { db } = await import('/src/db/schema.ts')
  const made = await createBackup()
  await restoreBackup(parseBackup(JSON.stringify(made)))
  return { version: made.version, n: made.absences.length, after: (await db.absences.toArray()).length }
})
check('Backup enthält Abwesenheiten', backup.version >= 7 && backup.n === 1 && backup.after === 1, JSON.stringify(backup))

await page.goto(`${BASE}/#/einstellungen`, { waitUntil: 'networkidle0' })
await sleep(500)
await page.evaluate(() => [...document.querySelectorAll('h2')].find((h) => h.textContent === 'Abwesenheit').scrollIntoView({ block: 'center' }))
await sleep(200)
await shot('abw4-einstellungen')

console.log(errors.length ? `\nFehler im Browser:\n${errors.join('\n')}` : '\nKeine Browser-Fehler')
console.log(fails ? `\n${fails} FEHLGESCHLAGEN` : '\nALLES OK')
await browser.close()
process.exit(fails || errors.length ? 1 : 0)
