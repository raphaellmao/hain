// Gewohnheiten mit Menge oder Dauer über die echte Oberfläche, frisches Profil
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

const browser = await puppeteer.launch({ executablePath: EDGE, headless: 'new', userDataDir: mkdtempSync(join(tmpdir(), 'hain-goal-')), args: ['--no-first-run'] })
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
  await sleep(150)
}
const setInput = (selector, value) =>
  page.evaluate((selector, value) => {
    const i = document.querySelector(selector)
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(i, value)
    i.dispatchEvent(new Event('input', { bubbles: true }))
  }, selector, value)
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
const dateStr = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const today = dateStr(new Date())
const yesterday = dateStr(new Date(Date.now() - 86_400_000))
const habitByName = (name) => db((db, name) => db.habits.filter((h) => h.name === name && !h.deleted).first(), name)
const day = (id, d) => db((db, id) => db.checkins.get(id), `${id}_${d}`)
const rowButton = (name) => `main li button[aria-label^="${name}:"]`
const rowLabel = (name) => page.evaluate((s) => document.querySelector(s)?.getAttribute('aria-label') ?? '', rowButton(name))

async function createHabit(name, setup) {
  await page.goto(`${BASE}/#/neu`, { waitUntil: 'networkidle0' })
  await sleep(500)
  await page.type('input[placeholder^="z. B."]', name)
  await setup()
  await tap('button', 'Pflanzen')
  await sleep(600)
}

await page.goto(`${BASE}/`, { waitUntil: 'networkidle0' })
await sleep(500)

// ── Menge ────────────────────────────────────────────────────────────────────
await createHabit('Wasser', async () => {
  await tap('button', 'Menge')
  await shot('ziel1-formular')
  const fields = await page.evaluate(() => [...document.querySelectorAll('input')].map((i) => i.value))
  check('Formular schlägt 8 Gläser und 1 pro Tipp vor', fields.includes('8') && fields.includes('Gläser') && fields.includes('1'), fields.join(' | '))
  await setInput('input[inputmode=decimal]', '0')
  await sleep(100)
  check('Ziel 0 wird abgelehnt', await page.evaluate(() => document.body.innerText.includes('Ziel größer als 0') && [...document.querySelectorAll('button')].find((b) => b.textContent.includes('Pflanzen')).disabled))
  await setInput('input[inputmode=decimal]', '2')
  await tap('button', 'Liter')
  await setInput('input[aria-label="So viel zählt ein Tipp"]', '0,25')
  await sleep(100)
})
let wasser = await habitByName('Wasser')
check('Ziel gespeichert', JSON.stringify(wasser?.goal) === JSON.stringify({ kind: 'menge', target: 2, unit: 'Liter', step: 0.25 }), JSON.stringify(wasser?.goal))
check('Zeile zeigt den Fortschritt', (await rowLabel('Wasser')).includes('0 / 2 Liter'), await rowLabel('Wasser'))
await shot('ziel2-heute-leer')

for (let i = 0; i < 7; i++) {
  await page.click(rowButton('Wasser'))
  await sleep(160)
}
await sleep(400)
let c = await day(wasser.id, today)
check('Sieben Tipps: 1,75 l, noch nicht erledigt', c?.amount === 1.75 && c.done === false, JSON.stringify(c))
check('… Zeile zählt mit', (await rowLabel('Wasser')).includes('1,75 / 2 Liter'), await rowLabel('Wasser'))
await page.click(rowButton('Wasser'))
await sleep(500)
c = await day(wasser.id, today)
check('Achter Tipp erreicht das Ziel', c?.amount === 2 && c.done === true, JSON.stringify(c))
check('… mit Hinweis', await page.evaluate(() => document.body.innerText.includes('Ziel erreicht') || document.body.innerText.includes('jetzt')))
await shot('ziel3-heute-erreicht')
await page.click(rowButton('Wasser'))
await sleep(400)
c = await day(wasser.id, today)
check('Mehr als das Ziel geht, bleibt erledigt', c?.amount === 2.25 && c.done === true, JSON.stringify(c))

// Blatt: genauer eintragen
await page.evaluate(() => document.querySelector('main li button[aria-label*="Details"]').click())
await sleep(450)
check('Blatt zeigt den Eintrag', await page.evaluate(() => !!document.querySelector('[role=dialog] input[inputmode=decimal]')))
await shot('ziel4-blatt')
await page.evaluate(() => document.querySelector('[role=dialog] button[aria-label$="weniger"]').click())
await sleep(400)
await page.evaluate(() => document.querySelector('[role=dialog] button[aria-label$="weniger"]').click())
await sleep(400)
c = await day(wasser.id, today)
check('− zieht ab und nimmt den Haken weg', c?.amount === 1.75 && c.done === false, JSON.stringify(c))
await page.focus('[role=dialog] input[inputmode=decimal]')
await setInput('[role=dialog] input[inputmode=decimal]', '1,5')
await page.keyboard.press('Enter')
await sleep(500)
c = await day(wasser.id, today)
check('Zahl direkt eintippen (mit Komma)', c?.amount === 1.5 && c.done === false, JSON.stringify(c))

// Ausnahme bei Teilfortschritt
await tap('[role=dialog] button', 'Krank')
await sleep(500)
c = await day(wasser.id, today)
check('Ausnahme behält die Menge', c?.excused === true && c.amount === 1.5 && c.done === false, JSON.stringify(c))
await page.evaluate(() => document.querySelector('main li button[aria-label*="Details"]').click())
await sleep(450)
await tap('[role=dialog] button', 'Aufheben')
await sleep(500)
c = await day(wasser.id, today)
check('Ausnahme aufheben behält die Menge', !c?.excused && c.amount === 1.5, JSON.stringify(c))
await page.evaluate(() => document.querySelector('main li button[aria-label*="Details"]').click())
await sleep(450)
await tap('[role=dialog] button', 'Krank')
await sleep(400)
await page.evaluate(() => document.querySelector('main li button[aria-label*="Details"]').click())
await sleep(450)
await page.evaluate(() => document.querySelector('[role=dialog] button[aria-label$="mehr"]').click())
await sleep(300)
await page.evaluate(() => document.querySelector('[role=dialog] button[aria-label$="mehr"]').click())
await sleep(500)
c = await day(wasser.id, today)
check('Ziel erreicht schlägt Ausnahme', c?.done === true && !c.excused && c.amount === 2, JSON.stringify(c))
await page.keyboard.press('Escape')
await sleep(400)

// ── Dauer ────────────────────────────────────────────────────────────────────
await createHabit('Lesen', async () => {
  await tap('button', 'Dauer')
  await tap('button', '20 min')
})
const lesen = await habitByName('Lesen')
check('Dauer gespeichert', lesen?.goal?.kind === 'dauer' && lesen.goal.target === 20, JSON.stringify(lesen?.goal))
check('Zeile bietet den Timer an', (await rowLabel('Lesen')).includes('Timer starten'), await rowLabel('Lesen'))
await page.click(rowButton('Lesen'))
await sleep(500)
const started = await db((db, k) => db.meta.get(k), `timer.${lesen.id}`)
check('Tippen startet den Timer', typeof started?.value === 'number')
check('… Zeile zeigt ihn', (await rowLabel('Lesen')).includes('Timer stoppen') && (await page.evaluate(() => document.body.innerText.includes('⏱'))))
await shot('ziel5-timer')
// 21,5 Minuten vergehen lassen
await db((db, k) => db.meta.put({ key: k, value: Date.now() - 21.5 * 60_000 }), `timer.${lesen.id}`)
await sleep(1200)
check('Laufende Anzeige rechnet die Zeit mit', (await rowLabel('Lesen')).includes('21 / 20 min'), await rowLabel('Lesen'))
await page.click(rowButton('Lesen'))
await sleep(600)
c = await day(lesen.id, today)
check('Stoppen trägt 21 Minuten ein, Ziel erreicht', c?.amount === 21 && c.done === true, JSON.stringify(c))
check('Timer ist weg', !(await db((db, k) => db.meta.get(k), `timer.${lesen.id}`)))

// Vergessener Timer: über Nacht gelaufen, begonnen gestern
await db((db, k) => db.meta.put({ key: k, value: Date.now() - 3 * 24 * 3_600_000 }), `timer.${lesen.id}`)
await page.reload({ waitUntil: 'networkidle0' })
await sleep(600)
await page.click(rowButton('Lesen'))
await sleep(700)
const capped = await db((db) => db.checkins.filter((x) => x.amount === 720).count())
check('Vergessener Timer: höchstens 12 h, mit Hinweis', capped === 1 && (await page.evaluate(() => document.body.innerText.includes('über 12 Stunden'))))

// Unter einer Minute
await page.click(rowButton('Lesen'))
await sleep(300)
await page.click(rowButton('Lesen'))
await sleep(500)
check('Unter einer Minute: nichts eingetragen', await page.evaluate(() => document.body.innerText.includes('Unter einer Minute')))

// Vergangener Tag: kein Timer, sondern das Blatt (dafür beginnen beide schon gestern)
await page.evaluate(async (y) => {
  const { db } = await import('/src/db/schema.ts')
  await db.habits.toCollection().modify((h) => {
    h.startDate = y
    h.schedule = [{ from: y, days: [0, 1, 2, 3, 4, 5, 6] }]
  })
}, yesterday)
await sleep(400)
await page.evaluate(() => [...document.querySelectorAll('header button')][5].click())
await sleep(400)
await page.click(rowButton('Lesen'))
await sleep(500)
const pastSheet = await page.evaluate(() => ({ open: !!document.querySelector('[role=dialog]'), timer: [...document.querySelectorAll('[role=dialog] button')].some((b) => b.textContent.includes('Timer')) }))
check('Gestern: Blatt statt Timer', pastSheet.open && !pastSheet.timer, JSON.stringify(pastSheet))
await tap('[role=dialog] button', '+15 min')
await sleep(500)
c = await day(lesen.id, yesterday)
check('… Minuten für gestern', c?.amount >= 15, JSON.stringify(c))
await page.keyboard.press('Escape')
await sleep(400)

// ── Detailseite ──────────────────────────────────────────────────────────────
await page.goto(`${BASE}/#/habit/${wasser.id}`, { waitUntil: 'networkidle0' })
await sleep(600)
const detail = await page.evaluate(() => document.body.innerText)
check('Detail: Ziel unter dem Namen', detail.includes('2 Liter am Tag'))
check('Detail: Eingabe für heute', await page.evaluate(() => !!document.querySelector('main input[inputmode=decimal], input[inputmode=decimal]')))
check('Detail: Durchschnitt und Gesamt', detail.includes('Ø pro Tag') && detail.includes('Gesamt'))
check('Detail: kein „Heute abhaken“-Knopf', !detail.includes('Heute abhaken'))
await shot('ziel6-detail')
// Kalender: gestern antippen = Ziel ganz erreicht
const calBtn = await page.evaluate((y) => {
  const b = [...document.querySelectorAll('button')].find((x) => (x.getAttribute('aria-label') ?? '').includes(String(Number(y.slice(8)))) && x.closest('section')?.textContent.includes('Nachtragen'))
  if (!b) return null
  b.click()
  return b.getAttribute('aria-label')
}, yesterday)
await sleep(600)
c = await day(wasser.id, yesterday)
check('Kalender: Tag antippen setzt das ganze Ziel', c?.amount === 2 && c.done === true, `${calBtn} → ${JSON.stringify(c)}`)

// ── Backup ───────────────────────────────────────────────────────────────────
const backup = await page.evaluate(async (id) => {
  const { createBackup, parseBackup, restoreBackup } = await import('/src/db/backup.ts')
  const { db } = await import('/src/db/schema.ts')
  await db.checkins.put({ id: `${id}_2026-01-01`, habitId: id, date: '2026-01-01', done: false, amount: 0.5, updatedAt: 1 })
  const made = await createBackup()
  await restoreBackup(parseBackup(JSON.stringify(made)))
  return { version: made.version, goal: (await db.habits.get(id)).goal, partial: (await db.checkins.get(`${id}_2026-01-01`))?.amount }
}, wasser.id)
check('Backup behält Ziel und Teilmengen', backup.version >= 6 && backup.goal?.unit === 'Liter' && backup.partial === 0.5, JSON.stringify(backup))

// ── Ziel wieder abschalten ───────────────────────────────────────────────────
await page.goto(`${BASE}/#/habit/${wasser.id}/bearbeiten`, { waitUntil: 'networkidle0' })
await sleep(500)
await tap('button', 'Abhaken')
await tap('button', 'Speichern')
await sleep(600)
wasser = await habitByName('Wasser')
check('Abhaken entfernt das Ziel', !wasser.goal)
await page.goto(`${BASE}/`, { waitUntil: 'networkidle0' })
await sleep(500)
check('… Zeile ist wieder zum Abhaken', await page.evaluate(() => !!document.querySelector('main li button[aria-label^="Wasser erledigt"], main li button[aria-label^="Wasser abhaken"]')))

// Demo: Bilder
await page.evaluate(async () => {
  const { hainDemo } = await import('/src/dev/demo.ts')
  await hainDemo()
})
await page.goto(`${BASE}/`, { waitUntil: 'networkidle0' })
await sleep(800)
await shot('ziel7-demo-heute')

console.log(errors.length ? `\nFehler im Browser:\n${errors.join('\n')}` : '\nKeine Browser-Fehler')
console.log(fails ? `\n${fails} FEHLGESCHLAGEN` : '\nALLES OK')
await browser.close()
process.exit(fails || errors.length ? 1 : 0)
