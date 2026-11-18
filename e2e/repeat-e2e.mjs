// Wiederkehrende To-dos und Wochenrückblick über die echte Oberfläche, frisches Profil
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

const browser = await puppeteer.launch({ executablePath: EDGE, headless: 'new', userDataDir: mkdtempSync(join(tmpdir(), 'hain-rep-')), args: ['--no-first-run'] })
const page = await browser.newPage()
await page.emulate({
  viewport: { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36',
})
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
  await sleep(120)
}
const db = (fn, ...args) =>
  page.evaluate(
    async (src, args) => {
      const { db } = await import('/src/db/schema.ts')
      return new Function('db', 'args', `return (${src})(db, ...args)`)(db, args)
    },
    fn.toString(),
    args,
  )
const series = (title) => db((db, title) => db.todos.filter((t) => t.title === title).toArray(), title)
const body = () => page.evaluate(() => document.body.innerText)
const pad = (n) => String(n).padStart(2, '0')
const dateStr = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const today = dateStr(new Date())
const inDays = (n) => dateStr(new Date(Date.now() + n * 86_400_000))

await page.goto(`${BASE}/#/todos`, { waitUntil: 'networkidle0' })
await sleep(500)

// ── Wiederkehrend anlegen ────────────────────────────────────────────────────
await page.click('button[aria-label="Neues To-do"]')
await sleep(350)
check('Wiederholen ist zu Beginn zugeklappt', !(await page.evaluate(() => !!document.querySelector('[aria-label="Wie oft wiederholen"]'))))
await page.type('form input[aria-label^="Was darfst"]', 'Müll raus')
await tap('form button', 'Wiederholen')
const chips = await page.evaluate(() => [...document.querySelectorAll('[aria-label="Wie oft wiederholen"] button')].map((b) => b.textContent))
check('Rhythmen zur Wahl', chips.length === 6 && chips[0] === 'Nie' && chips[1] === 'Täglich' && chips[2].startsWith('Jeden ') && /im Monat/.test(chips[4]) && /Jedes Jahr/.test(chips[5]), chips.join(' | '))
await shot('rep1-blatt')
await page.evaluate(() => document.querySelectorAll('[aria-label="Wie oft wiederholen"] button')[2].click())
await sleep(80)
await page.evaluate(() => {
  const i = document.querySelector('input[aria-label="Eigene Uhrzeit"]')
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(i, '23:50')
  i.dispatchEvent(new Event('input', { bubbles: true }))
})
await sleep(60)
await tap('form button', '+ Dazu')
await tap('form button[type=submit]', 'Hinzufügen')
await sleep(400)
let rows = await series('Müll raus')
check('Gespeichert mit Rhythmus und Erinnerung', rows.length === 1 && rows[0].repeat?.rule === 'woechentlich' && rows[0].repeat.from === today && rows[0].repeat.reminders[0]?.time === '23:50', JSON.stringify(rows[0]?.repeat))
check('Zeile zeigt den Rhythmus', (await body()).includes('🔁 Jeden'))

// ── Abhaken erzeugt den nächsten Termin ──────────────────────────────────────
await page.evaluate(() => document.querySelector('button[aria-label="Müll raus erledigt"]').click())
await sleep(800)
rows = await series('Müll raus')
const done = rows.find((t) => t.done)
const next = rows.find((t) => !t.done && !t.deleted)
check('Abhaken: erster erledigt, nächster offen', rows.length === 2 && !!done && !!next)
check('Nächster liegt eine Woche später', next?.date === inDays(7), next?.date)
check('Reihe bleibt erkennbar', next?.seriesId === done?.id)
check('Erinnerung kommt mit', next?.reminders[0] === `${inDays(7)}T23:50`, JSON.stringify(next?.reminders))
check('Hinweis sagt, wann', (await body()).includes('Kommt wieder'), '')
await shot('rep2-liste')

// Doppeltippen erzeugt nichts doppelt
await page.evaluate(() => {
  const b = document.querySelector('button[aria-label="Müll raus erledigt"]')
  b.click()
  b.click()
  b.click()
})
await sleep(900)
rows = await series('Müll raus')
check('Mehrfaches Tippen erzeugt nur einen Termin', rows.filter((t) => !t.done && !t.deleted).length === 1 && rows.length === 3, `${rows.length} Einträge`)

// ── Zurücknehmen ─────────────────────────────────────────────────────────────
await tap('button', 'Erledigt (')
await sleep(200)
await page.evaluate(() => {
  const list = [...document.querySelectorAll('button[aria-label="Müll raus erledigt"]')].filter((b) => b.getAttribute('aria-checked') === 'true')
  list[0].click()
})
await sleep(600)
rows = await series('Müll raus')
check('Zurücknehmen: wieder genau ein offener Termin', rows.filter((t) => !t.done && !t.deleted).length === 1, JSON.stringify(rows.map((t) => [t.date, t.done, t.deleted])))
const reopened = rows.find((t) => !t.done && !t.deleted)
check('… und zwar der zurückgenommene', reopened?.date === inDays(7), reopened?.date)

// ── Überspringen ─────────────────────────────────────────────────────────────
await tap('main button', 'Müll raus')
await sleep(350)
await tap('form button', 'Diesen Termin überspringen')
await sleep(500)
rows = await series('Müll raus')
const skipped = rows.find((t) => !t.done && !t.deleted)
check('Überspringen springt eine Woche weiter', skipped?.date === inDays(14), skipped?.date)
check('… und zählt nicht als erledigt', rows.filter((t) => t.done).length === 1, `${rows.filter((t) => t.done).length} erledigt`)
check('… Erinnerung wandert mit', skipped?.reminders[0] === `${inDays(14)}T23:50`, JSON.stringify(skipped?.reminders))

// ── Weggeklickte Erinnerung kommt beim nächsten Termin wieder ────────────────
await page.evaluate(async (t) => {
  const { db } = await import('/src/db/schema.ts')
  await db.todos.put({ id: 'rung', title: 'Tabletten', scope: 'tag', date: t, reminders: [`${t}T00:01`, `${t}T23:59`], repeat: { rule: 'taeglich', from: t, reminders: [{ days: 0, time: '00:01' }, { days: 0, time: '23:59' }] }, done: false, deleted: false, createdAt: 1, updatedAt: 1 })
  document.dispatchEvent(new Event('visibilitychange'))
}, today)
await sleep(500)
check('Banner meldet sich', (await page.evaluate(() => document.querySelector('[role=alert]')?.innerText ?? '')).includes('Tabletten'))
await tap('[role=alert] button', 'OK')
await sleep(400)
let pills = await series('Tabletten')
check('OK räumt nur die fällige ab', JSON.stringify(pills[0].reminders) === JSON.stringify([`${today}T23:59`]), JSON.stringify(pills[0].reminders))
await tap('main button', 'Tabletten')
await sleep(350)
check('Blatt zeigt sie für das nächste Mal', (await page.evaluate(() => document.querySelector('[aria-label="Erinnerungen ab dem nächsten Termin"]')?.innerText ?? '')).includes('00:01'))
await tap('form button[type=submit]', 'Speichern')
await sleep(300)
pills = await series('Tabletten')
check('Speichern behält beide in der Reihe', pills[0].repeat.reminders.length === 2, JSON.stringify(pills[0].repeat.reminders))
await page.evaluate(() => document.querySelector('button[aria-label="Tabletten erledigt"]').click())
await sleep(800)
pills = await series('Tabletten')
const tomorrowPill = pills.find((t) => !t.done)
check('Morgen klingeln wieder beide', JSON.stringify(tomorrowPill?.reminders) === JSON.stringify([`${inDays(1)}T00:01`, `${inDays(1)}T23:59`]), JSON.stringify(tomorrowPill?.reminders))

// ── Wiederholung beenden ─────────────────────────────────────────────────────
await tap('main button', 'Tabletten')
await sleep(350)
await tap('form button', 'Wiederholung beenden und löschen')
await sleep(400)
check('Löschen beendet die Reihe', (await series('Tabletten')).filter((t) => !t.deleted && !t.done).length === 0)

// Rhythmus abwählen
await tap('main button', 'Müll raus')
await sleep(350)
await page.evaluate(() => document.querySelectorAll('[aria-label="Wie oft wiederholen"] button')[0].click())
await sleep(80)
await tap('form button[type=submit]', 'Speichern')
await sleep(300)
rows = await series('Müll raus')
const loose = rows.find((t) => !t.done && !t.deleted)
check('„Nie“ beendet die Wiederholung', !loose?.repeat && !loose?.seriesId)
await page.evaluate(() => {
  const list = [...document.querySelectorAll('button[aria-label="Müll raus erledigt"]')].filter((b) => b.getAttribute('aria-checked') === 'true')
  list[0]?.click()
})
await sleep(600)
const afterUndo = await db((db, id) => db.todos.get(id), loose?.id)
check('Zurücknehmen des Vorgängers lässt das gelöste To-do in Ruhe', afterUndo?.deleted === false, JSON.stringify(afterUndo?.deleted))

// Wochenaufgabe: nur Wochenrhythmen
await page.evaluate(() => document.querySelector('button[aria-label="To-do für diese Woche"]').click())
await sleep(350)
await page.type('form input[aria-label^="Was darfst"]', 'Wochenplan')
await tap('form button', 'Wiederholen')
const weekChips = await page.evaluate(() => [...document.querySelectorAll('[aria-label="Wie oft wiederholen"] button')].map((b) => b.textContent))
check('Wochenaufgabe: nur Wochenrhythmen', JSON.stringify(weekChips) === JSON.stringify(['Nie', 'Jede Woche', 'Alle 2 Wochen']), weekChips.join(' | '))
await page.evaluate(() => document.querySelectorAll('[aria-label="Wie oft wiederholen"] button')[1].click())
await sleep(80)
await tap('form button[type=submit]', 'Hinzufügen')
await sleep(300)
await page.evaluate(() => document.querySelector('button[aria-label="Wochenplan erledigt"]').click())
await sleep(800)
const plans = await series('Wochenplan')
const planNext = plans.find((t) => !t.done)
const monday = plans.find((t) => t.done).date
check('Wochenaufgabe kommt nächste Woche wieder', planNext?.scope === 'woche' && planNext.date > monday, planNext?.date)

// ── Backup behält die Reihe ──────────────────────────────────────────────────
const backup = await page.evaluate(async () => {
  const { createBackup, parseBackup, restoreBackup } = await import('/src/db/backup.ts')
  const { db } = await import('/src/db/schema.ts')
  const made = await createBackup()
  const parsed = parseBackup(JSON.stringify(made))
  await restoreBackup(parsed)
  const again = await db.todos.filter((t) => t.title === 'Wochenplan' && !t.done).first()
  return { version: made.version, repeat: again?.repeat?.rule, series: !!again?.seriesId }
})
check('Backup behält Rhythmus und Reihe', backup.version >= 5 && backup.repeat === 'woechentlich' && backup.series, JSON.stringify(backup))

// ── Wochenrückblick ──────────────────────────────────────────────────────────
await page.evaluate(async () => {
  const { hainDemo } = await import('/src/dev/demo.ts')
  await hainDemo()
  const { db } = await import('/src/db/schema.ts')
  await db.todos.toCollection().modify((t) => { t.reminders = [] })
})
await page.goto(`${BASE}/#/erfolge`, { waitUntil: 'networkidle0' })
await sleep(600)
await tap('button', 'Wochenrückblick')
await sleep(500)
check('Aus den Erfolgen erreichbar', (await page.evaluate(() => location.hash)).startsWith('#/rueckblick'))
const text = await body()
check('Zeigt Quote und Urteil', /\d+ %/.test(text) && /Woche/.test(text))
await shot('rev1')
const firstRange = await page.evaluate(() => document.querySelector('header p').textContent)
await page.evaluate(() => document.querySelector('button[aria-label="Woche davor"]').click())
await sleep(400)
const prevRange = await page.evaluate(() => document.querySelector('header p').textContent)
check('Woche davor', firstRange !== prevRange, `${firstRange} → ${prevRange}`)
await page.evaluate(() => document.querySelector('button[aria-label="Woche danach"]').click())
await sleep(300)
for (let i = 0; i < 3; i++) {
  const disabled = await page.evaluate(() => document.querySelector('button[aria-label="Woche danach"]').disabled)
  if (disabled) break
  await page.evaluate(() => document.querySelector('button[aria-label="Woche danach"]').click())
  await sleep(250)
}
check('In die Zukunft geht es nicht', await page.evaluate(() => document.querySelector('button[aria-label="Woche danach"]').disabled))
await page.evaluate(() => { location.hash = '#/rueckblick/kaputt' })
await sleep(300)
check('Kaputte Adresse stürzt nicht ab', (await body()).includes('Wochenrückblick'))
await page.evaluate(() => { location.hash = '#/rueckblick/2099-01-05' })
await sleep(300)
check('Zukunftsadresse zeigt die laufende Woche', await page.evaluate(() => document.querySelector('button[aria-label="Woche danach"]').disabled))

// Tage antippen
await page.evaluate(() => { location.hash = '#/rueckblick' })
await sleep(400)
const before = await page.evaluate(() => document.querySelector('[aria-live=polite]').textContent)
await page.evaluate(() => document.querySelectorAll('[role=img] button')[0].click())
await sleep(150)
const after = await page.evaluate(() => document.querySelector('[aria-live=polite]').textContent)
check('Tippen auf einen Tag zeigt dessen Werte', before !== after && after.includes('Montag'), after)

// Offenes verschieben
const open = await db((db) => db.todos.filter((t) => !t.done && !t.deleted).toArray())
{
  const x = new Date(`${today}T12:00:00Z`)
  const m = dateStr(new Date(x.getTime() - ((x.getUTCDay() + 6) % 7) * 86_400_000))
  await page.evaluate((m) => { location.hash = `#/rueckblick/${m}` }, m)
  await sleep(400)
}
await shot('rev2')
await tap('button', 'Alle in')
await sleep(500)
const moved = await db((db) => db.todos.filter((t) => !t.done && !t.deleted).toArray())
const wk = (d) => { const x = new Date(`${d}T12:00:00Z`); return dateStr(new Date(x.getTime() - ((x.getUTCDay() + 6) % 7) * 86_400_000)) }
const thisMonday = wk(today)
const overdueLeft = moved.filter((t) => (t.scope === 'tag' ? t.date < today : t.date < thisMonday))
check('Überfälliges liegt danach nicht mehr in der Vergangenheit', overdueLeft.length === 0, JSON.stringify(overdueLeft.map((t) => [t.title, t.date])))
check('Nichts ging verloren', moved.length === open.length, `${open.length} → ${moved.length}`)

console.log(errors.length ? `\nFehler im Browser:\n${errors.join('\n')}` : '\nKeine Browser-Fehler')
console.log(fails ? `\n${fails} FEHLGESCHLAGEN` : '\nALLES OK')
await browser.close()
process.exit(fails || errors.length ? 1 : 0)
