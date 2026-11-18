// Blätter, Banner und Hinweise: echte Touch-Gesten, frisches Profil
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

const browser = await puppeteer.launch({ executablePath: EDGE, headless: 'new', userDataDir: mkdtempSync(join(tmpdir(), 'hain-ov-')), args: ['--no-first-run'] })
const page = await browser.newPage()
const phone = { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true }
await page.emulate({ viewport: phone, userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36' })
const errors = []
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
page.on('console', (m) => {
  if (m.type() === 'error' && !/favicon|404/.test(m.text())) errors.push(`console: ${m.text()}`)
})
const cdp = await page.createCDPSession()
const shot = (name) => page.screenshot({ path: join(OUT, `${name}.png`) })
const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] })
async function swipe(x0, y0, x1, y1, { steps = 12, stepMs = 16 } = {}) {
  await touch('touchStart', x0, y0)
  for (let i = 1; i <= steps; i++) {
    await touch('touchMove', x0 + ((x1 - x0) * i) / steps, y0 + ((y1 - y0) * i) / steps)
    await sleep(stepMs)
  }
  await touch('touchEnd')
}
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
const sheetOpen = () => page.evaluate(() => !!document.querySelector('[role=dialog],[role=alertdialog]'))
const openTodo = async () => {
  await page.evaluate(() => document.querySelector('button[aria-label="Neues To-do"]').click())
  await sleep(450)
}
const state = () => page.evaluate(() => ({ hash: location.hash, sheet: history.state?.sheet ?? null, len: history.length, depth: history.state?.depth ?? 0 }))

await page.goto(`${BASE}/?demo`, { waitUntil: 'networkidle0' })
await sleep(900)
await page.evaluate(async () => {
  const { db } = await import('/src/db/schema.ts')
  await db.todos.toCollection().modify((t) => { t.reminders = [] })
})
await page.goto(`${BASE}/#/todos`, { waitUntil: 'networkidle0' })
await page.reload({ waitUntil: 'networkidle0' })
await sleep(4500) // Erfolge-Hinweise abwarten

// ── Grundverhalten eines Blatts ──────────────────────────────────────────────
const lenBefore = (await state()).len
await openTodo()
check('Blatt offen', await sheetOpen())
check('Seite dahinter ist festgehalten', (await page.evaluate(() => document.documentElement.style.overflow)) === 'hidden')
const scrollBefore = await page.evaluate(() => scrollY)
await swipe(195, 120, 195, 40)
await sleep(200)
check('Wischen auf dem Hintergrund scrollt die Seite nicht', (await page.evaluate(() => scrollY)) === scrollBefore)
check('Fokus liegt im Blatt', await page.evaluate(() => document.querySelector('[role=dialog]').contains(document.activeElement)))
await shot('o1-blatt')

await page.keyboard.press('Escape')
await sleep(500)
check('Esc schließt', !(await sheetOpen()))
check('Seite ist wieder frei', (await page.evaluate(() => document.documentElement.style.overflow)) === '')
let s = await state()
check('Kein Rest im Verlauf', s.sheet === null, JSON.stringify(s))

// Hintergrund
await openTodo()
await page.evaluate(() => document.querySelector('button[aria-label="Schließen"]').click())
await sleep(500)
check('Tippen auf den Hintergrund schließt', !(await sheetOpen()))
s = await state()
check('… ohne Rest im Verlauf', s.sheet === null, JSON.stringify(s))

// Zurück-Geste
await openTodo()
const beforeBack = await state()
await page.evaluate(() => history.back())
await sleep(500)
s = await state()
check('Zurück schließt das Blatt', !(await sheetOpen()))
check('… und bleibt auf der Seite', s.hash === '#/todos' && s.hash === beforeBack.hash, s.hash)
check('… Verlauf steht wieder auf der Seite', s.sheet === null)

// Griff
await openTodo()
const handle = await page.evaluate(() => {
  const r = document.querySelector('[role=dialog] .cursor-grab').getBoundingClientRect()
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
})
await swipe(handle.x, handle.y, handle.x, handle.y + 40, { steps: 8, stepMs: 30 })
await sleep(500)
check('Kurz am Griff ziehen: bleibt offen', await sheetOpen())
await swipe(handle.x, handle.y, handle.x, handle.y + 220, { steps: 10, stepMs: 20 })
await sleep(600)
check('Weit am Griff ziehen: schließt', !(await sheetOpen()))
s = await state()
check('… ohne Rest im Verlauf', s.sheet === null, JSON.stringify(s))
check('Blatt ist nach dem Schließen wirklich weg (Seite bedienbar)', await page.evaluate(() => !document.querySelector('[aria-modal]')))

// Tastatur: sichtbarer Ausschnitt schrumpft
await openTodo()
await page.setViewport({ ...phone, height: 430 })
await sleep(400)
const kb = await page.evaluate(() => {
  const btn = document.querySelector('[role=dialog] button[type=submit]').getBoundingClientRect()
  const input = document.querySelector('[role=dialog] input').getBoundingClientRect()
  const dialog = document.querySelector('[role=dialog]').getBoundingClientRect()
  return { btnBottom: btn.bottom, inputTop: input.top, top: dialog.top, vh: window.visualViewport.height }
})
check('Mit Tastatur: Knopf bleibt im sichtbaren Teil', kb.btnBottom <= kb.vh, JSON.stringify(kb))
check('… und das Eingabefeld auch', kb.inputTop >= 0 && kb.top >= 0, JSON.stringify(kb))
await shot('o2-tastatur')
await page.setViewport(phone)
await sleep(300)
await page.keyboard.press('Escape')
await sleep(500)

// Lange Blätter: Knopf immer sichtbar
await page.evaluate(() => [...document.querySelectorAll('main button')].find((b) => b.textContent.includes('Paket')).click())
await sleep(450)
await page.setViewport({ ...phone, height: 560 })
await sleep(300)
const long = await page.evaluate(() => {
  const btn = document.querySelector('[role=dialog] button[type=submit]').getBoundingClientRect()
  const scroller = document.querySelector('[role=dialog] form > div')
  return { btnBottom: btn.bottom, vh: innerHeight, scrolls: scroller.scrollHeight > scroller.clientHeight }
})
check('Kleines Handy: Speichern immer erreichbar, Inhalt scrollt', long.btnBottom <= long.vh && long.scrolls, JSON.stringify(long))
await page.setViewport(phone)
await page.keyboard.press('Escape')
await sleep(500)

// Tab bleibt im Blatt
await page.evaluate(() => document.querySelector('button[aria-label="Neues To-do"]').focus())
await openTodo()
for (let i = 0; i < 40; i++) await page.keyboard.press('Tab')
check('Tab verlässt das Blatt nicht', await page.evaluate(() => document.querySelector('[role=dialog]').contains(document.activeElement)))
await page.keyboard.press('Escape')
await sleep(500)
// Doppeltipp auf „Hinzufügen“ legt nur ein To-do an
await page.evaluate(() => document.querySelector('button[aria-label="Neues To-do"]').click())
await sleep(450)
await page.type('[role=dialog] input', 'Doppeltipp')
await page.evaluate(async () => {
  const b = document.querySelector('[role=dialog] button[type=submit]')
  b.click()
  await new Promise((r) => setTimeout(r, 60))
  b.click()
  await new Promise((r) => setTimeout(r, 60))
  b.click()
})
await sleep(700)
const doubles = await page.evaluate(async () => {
  const { db } = await import('/src/db/schema.ts')
  return db.todos.filter((t) => t.title === 'Doppeltipp').count()
})
check('Doppeltipp auf „Hinzufügen“ legt nur ein To-do an', doubles === 1, `${doubles} angelegt`)
check('Fokus kehrt zum Auslöser zurück', await page.evaluate(() => document.activeElement?.getAttribute('aria-label') === 'Neues To-do'), await page.evaluate(() => document.activeElement?.tagName + ' ' + document.activeElement?.getAttribute('aria-label')))

// ── Ausnahme-Blatt ───────────────────────────────────────────────────────────
await page.evaluate(() => { location.hash = '#/' })
await sleep(500)
await page.evaluate(() => document.querySelector('main button[aria-label*="Optionen"], main button[aria-label*="nicht möglich"], main button[aria-label*="Mehr"]')?.click())
await sleep(450)
if (!(await sheetOpen())) {
  const more = await page.$$('main li button')
  console.log('     (Knopf über Text gesucht)', more.length)
}
check('Ausnahme-Blatt öffnet', await sheetOpen())
await shot('o3-ausnahme')
await tap('[role=dialog] button', 'Details')
await sleep(700)
s = await state()
check('„Details“ führt zur Detailseite', s.hash.startsWith('#/habit/'), s.hash)
check('… Blatt zu, Seite frei', !(await sheetOpen()) && (await page.evaluate(() => document.documentElement.style.overflow)) === '')
await tap('button', 'Zurück')
await sleep(700)
s = await state()
check('Zurück von dort landet auf „Heute“', s.hash === '#/' || s.hash === '', s.hash)
check('… ohne geschlossenes Blatt im Weg', !(await sheetOpen()) && s.sheet === null, JSON.stringify(s))

// ── Bestätigung ──────────────────────────────────────────────────────────────
await page.evaluate(() => { location.hash = '#/habit/demo-1/bearbeiten' })
await sleep(600)
await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => /löschen/i.test(b.textContent) || /löschen/i.test(b.getAttribute('aria-label') ?? '')).click())
await sleep(450)
check('Bestätigung öffnet', await page.evaluate(() => !!document.querySelector('[role=alertdialog]')))
await shot('o4-bestaetigung')
await page.keyboard.press('Escape')
await sleep(500)
check('Esc heißt Abbrechen', await page.evaluate(() => !document.querySelector('[role=alertdialog]')))
check('Gewohnheit ist noch da', await page.evaluate(async () => {
  const { db } = await import('/src/db/schema.ts')
  return !(await db.habits.get('demo-1')).deleted
}))
await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => /löschen/i.test(b.textContent) || /löschen/i.test(b.getAttribute('aria-label') ?? '')).click())
await sleep(450)
await tap('[role=alertdialog] button', 'Löschen')
await sleep(700)
s = await state()
check('Löschen führt in den Garten', s.hash === '#/garten' && !(await page.evaluate(() => !!document.querySelector('[role=alertdialog]'))), s.hash)

// ── Erinnerungsbanner ────────────────────────────────────────────────────────
await page.evaluate(() => { location.hash = '#/todos' })
await sleep(400)
const addRing = (id, title) =>
  page.evaluate(async (id, title) => {
    const { db } = await import('/src/db/schema.ts')
    const pad = (n) => String(n).padStart(2, '0')
    const d = new Date(Date.now() - 60_000)
    const at = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
    await db.todos.put({ id, title, scope: 'tag', date: at.slice(0, 10), reminders: [at], done: false, deleted: false, createdAt: 1, updatedAt: 1 })
    document.dispatchEvent(new Event('visibilitychange'))
  }, id, title)
const alertShown = () => page.evaluate(() => !!document.querySelector('[role=alert]'))
const bell = () => page.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.getAttribute('aria-label')?.startsWith('Erinnerung:'))?.getAttribute('aria-label') ?? null)

await addRing('r1', 'Erste Erinnerung mit einem ziemlich langen Titel, der auch umbrechen muss')
await sleep(500)
check('Banner erscheint', await alertShown())
const size = await page.evaluate(() => document.querySelector('[role=alert] > div').getBoundingClientRect().height)
check('Banner ist kompakter', size < 130, `${Math.round(size)} px hoch`)
await shot('o5-banner')

// Wischen nach oben
const card = await page.evaluate(() => {
  const r = document.querySelector('[role=alert] > div').getBoundingClientRect()
  return { x: r.left + r.width / 2, y: r.top + 24 }
})
await swipe(card.x, card.y, card.x, card.y - 70, { steps: 8, stepMs: 16 })
await sleep(500)
check('Wischen nach oben klappt es ein', !(await alertShown()) && !!(await bell()), String(await bell()))
await shot('o6-glocke')
const pos = await page.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find((x) => x.getAttribute('aria-label')?.startsWith('Erinnerung:')).getBoundingClientRect()
  return { left: b.left, top: b.top, bottom: innerHeight - b.bottom, w: b.width }
})
check('Glocke liegt im Daumenbereich und passt neben den Plus-Knopf', pos.left < 20 && pos.left + pos.w < 390 - 16 - 56 - 4, JSON.stringify(pos))

// Tippen klappt wieder auf
await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.getAttribute('aria-label')?.startsWith('Erinnerung:')).click())
await sleep(450)
check('Antippen klappt wieder auf', await alertShown())

// Knopf klappt ein
await page.evaluate(() => document.querySelector('button[aria-label="Einklappen"]').click())
await sleep(800)
check('Einklappen-Knopf', !(await alertShown()) && !!(await bell()))

// Eine neue Erinnerung geht nicht hinter der eingeklappten unter
await addRing('r2', 'Zweite Erinnerung')
await sleep(600)
check('Neue Erinnerung klappt von selbst auf', await alertShown())
check('… und zählt die andere mit', (await page.evaluate(() => document.querySelector('[role=alert]').innerText)).includes('1 weitere'))

// Von selbst einklappen
await sleep(12_400)
check('Klappt nach ein paar Sekunden von selbst ein', !(await alertShown()) && !!(await bell()))

// Abarbeiten
await page.evaluate(() => [...document.querySelectorAll('button')].find((x) => x.getAttribute('aria-label')?.startsWith('Erinnerung:')).click())
await sleep(400)
await tap('[role=alert] button', 'OK')
await sleep(600)
check('Nächste rückt nach und ist offen', /Erinnerung/.test(await page.evaluate(() => document.querySelector('[role=alert]')?.innerText ?? '')))
await tap('[role=alert] button', 'Erledigt')
await sleep(600)
check('Danach ist alles weg', !(await alertShown()) && !(await bell()))

console.log(errors.length ? `\nFehler im Browser:\n${errors.join('\n')}` : '\nKeine Browser-Fehler')
console.log(fails ? `\n${fails} FEHLGESCHLAGEN` : '\nALLES OK')
await browser.close()
process.exit(fails || errors.length ? 1 : 0)
