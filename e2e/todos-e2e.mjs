// Praxistest der To-dos mit echten Touch-Ereignissen, frisches Browserprofil
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

const browser = await puppeteer.launch({
  executablePath: EDGE,
  headless: 'new',
  userDataDir: mkdtempSync(join(tmpdir(), 'hain-e2e-')),
  args: ['--no-first-run', '--disable-features=Translate'],
})
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
const cdp = await page.createCDPSession()
const shot = (name) => page.screenshot({ path: join(OUT, `${name}.png`) })
const hash = () => page.evaluate(() => location.hash || '#/')

async function touch(type, x, y) {
  await cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] })
}
/** Wischen in Schritten. hold = Finger unten lassen (für Bilder mitten in der Geste) */
async function swipe(x0, y0, x1, y1, { steps = 12, stepMs = 16, hold = false } = {}) {
  await touch('touchStart', x0, y0)
  for (let i = 1; i <= steps; i++) {
    await touch('touchMove', x0 + ((x1 - x0) * i) / steps, y0 + ((y1 - y0) * i) / steps)
    await sleep(stepMs)
  }
  if (!hold) await touch('touchEnd')
}
const tapText = async (selector, text) => {
  const ok = await page.evaluate((selector, text) => {
    const el = [...document.querySelectorAll(selector)].find((e) => e.textContent.trim().includes(text))
    if (!el) return false
    el.click()
    return true
  }, selector, text)
  if (!ok) throw new Error(`nicht gefunden: ${selector} „${text}“`)
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

// ── Migration: Datenbank der Vorgängerversion (Dexie-Version 3 = IndexedDB 30) ──
await page.goto(`${BASE}/manifest.webmanifest`).catch(() => {})
await page.evaluate(
  () =>
    new Promise((resolve, reject) => {
      const open = indexedDB.open('hain', 30)
      open.onupgradeneeded = () => {
        const d = open.result
        const habits = d.createObjectStore('habits', { keyPath: 'id' })
        habits.createIndex('order', 'order')
        habits.createIndex('updatedAt', 'updatedAt')
        const checkins = d.createObjectStore('checkins', { keyPath: 'id' })
        checkins.createIndex('habitId', 'habitId')
        checkins.createIndex('date', 'date')
        checkins.createIndex('updatedAt', 'updatedAt')
        d.createObjectStore('meta', { keyPath: 'key' })
        const days = d.createObjectStore('dayEntries', { keyPath: 'id' })
        days.createIndex('date', 'date')
        days.createIndex('updatedAt', 'updatedAt')
        const todos = d.createObjectStore('todos', { keyPath: 'id' })
        todos.createIndex('date', 'date')
        todos.createIndex('updatedAt', 'updatedAt')
      }
      open.onerror = () => reject(open.error)
      open.onsuccess = () => {
        const d = open.result
        const tx = d.transaction(['habits', 'dayEntries', 'todos'], 'readwrite')
        const alt = { scope: 'tag', date: '2026-11-20', done: false, deleted: false, createdAt: 1, updatedAt: 1 }
        tx.objectStore('todos').put({ ...alt, id: 'alt-offen', title: 'Alt mit Erinnerung', remindAt: '2026-11-20T18:00' })
        tx.objectStore('todos').put({ ...alt, id: 'alt-weg', title: 'Alt weggeklickt', remindAt: '2026-11-20T18:00', remindedAt: 5 })
        tx.objectStore('todos').put({ ...alt, id: 'alt-ohne', title: 'Alt ohne Erinnerung' })
        tx.objectStore('habits').put({
          id: 'alt-1', name: 'Alte Gewohnheit', emoji: '🌳', color: 'blau', seed: 7, order: 1, startDate: '2026-10-01',
          schedule: [{ from: '2026-10-01', days: [0, 1, 2, 3, 4, 5, 6] }], deleted: false, createdAt: 1, updatedAt: 1,
        })
        tx.objectStore('dayEntries').put({ id: '2026-10-01', date: '2026-10-01', note: 'Alte Notiz', updatedAt: 1 })
        tx.oncomplete = () => {
          d.close()
          resolve()
        }
      }
    }),
)
await page.goto(BASE, { waitUntil: 'networkidle0' })
await sleep(400)
const migrated = await db(async (db) => ({
  version: db.verno,
  habits: await db.habits.count(),
  notes: await db.dayEntries.count(),
  todos: await db.todos.count(),
  rows: Object.fromEntries((await db.todos.toArray()).map((t) => [t.id, { reminders: t.reminders, old: 'remindAt' in t || 'remindedAt' in t }])),
}))
check('Migration behält Altdaten', migrated.version >= 4 && migrated.habits === 1 && migrated.notes === 1 && migrated.todos === 3, `Version ${migrated.version}`)
check('Migration übernimmt offene Erinnerung', JSON.stringify(migrated.rows['alt-offen']) === JSON.stringify({ reminders: ['2026-11-20T18:00'], old: false }), JSON.stringify(migrated.rows['alt-offen']))
check('Migration: weggeklickte bleibt weg, ohne bleibt leer', migrated.rows['alt-weg'].reminders.length === 0 && migrated.rows['alt-ohne'].reminders.length === 0 && !migrated.rows['alt-weg'].old)
check('Alte Gewohnheit wird angezeigt', await page.evaluate(() => document.body.innerText.includes('Alte Gewohnheit')))

// Demodaten dazu (fügt nur hinzu)
await page.evaluate(async () => {
  const { hainDemo } = await import('/src/dev/demo.ts')
  await hainDemo()
})
await page.goto(BASE, { waitUntil: 'networkidle0' })
await sleep(500)
await shot('t1-heute')
check('„Heute“ zeigt die To-do-Karte', await page.evaluate(() => document.body.innerText.includes('Zahnarzt anrufen')))
const badge = await page.evaluate(() => document.querySelector('nav [aria-label^="To-dos"]')?.getAttribute('aria-label'))
check('Zähler an der Leiste', badge === 'To-dos, 3 offen', String(badge))

// ── Wischen ──────────────────────────────────────────────────────────────────
await swipe(330, 500, 110, 505, { hold: true })
await sleep(60)
const mid = await page.evaluate(() => {
  const el = document.querySelector('#root .overflow-x-clip > div')
  return { transform: getComputedStyle(el).transform, peek: document.body.innerText.includes('To-dos') }
})
check('Seite folgt dem Finger', mid.transform.startsWith('matrix') && mid.transform !== 'none', mid.transform)
await shot('t2-mitten-im-wischen')
const fabMid = await page.evaluate(() => {
  const r = document.querySelector('button[aria-label="Neue Gewohnheit"]').getBoundingClientRect()
  return { right: innerWidth - r.right, bottom: innerHeight - r.bottom }
})
check('Plus-Knopf fährt nicht mit', Math.abs(fabMid.right - 16) < 2 && fabMid.bottom < 120, JSON.stringify(fabMid))
await touch('touchEnd')
await sleep(1500)
check('Wischen nach links → To-dos', (await hash()) === '#/todos', await hash())
const settled = await page.evaluate(() => getComputedStyle(document.querySelector('#root .overflow-x-clip > div')).transform)
check('Seite steht danach wieder gerade', settled === 'none' || settled === 'matrix(1, 0, 0, 1, 0, 0)', settled)
const willChange = await page.evaluate(() => getComputedStyle(document.querySelector('#root .overflow-x-clip > div')).willChange)
check('kein dauerhaftes will-change', willChange === 'auto', willChange)
await shot('t3-todos')

// kurzer, langsamer Wisch: bleibt
await swipe(250, 400, 200, 402, { steps: 10, stepMs: 40 })
await sleep(500)
check('Kurzer Wisch bleibt auf der Seite', (await hash()) === '#/todos')

// senkrecht scrollen: kein Seitenwechsel
await swipe(200, 650, 215, 250, { steps: 14, stepMs: 16 })
await sleep(400)
const scrolled = await page.evaluate(() => scrollY)
check('Senkrechtes Wischen scrollt und wechselt nicht', (await hash()) === '#/todos' && scrolled > 50, `scrollY=${scrolled}`)
await shot('t4-todos-unten')
await page.evaluate(() => scrollTo(0, 0))

// am Rand gehört die Geste dem System
await swipe(8, 400, 300, 402)
await sleep(400)
check('Wisch vom Bildschirmrand löst nichts aus', (await hash()) === '#/todos')

// schneller, kurzer Wisch reicht
await swipe(120, 400, 200, 402, { steps: 4, stepMs: 12 })
await sleep(600)
check('Schneller Wisch nach rechts → Heute', (await hash()) === '#/', await hash())

// ganz links: geht nicht weiter
await swipe(100, 400, 340, 402)
await sleep(500)
check('Erste Seite: Wisch nach rechts bleibt', (await hash()) === '#/')

// durch alle Reiter
const order = ['#/todos', '#/garten', '#/erfolge', '#/einstellungen']
for (const h of order) {
  await swipe(330, 300, 90, 303)
  await sleep(650)
  check(`weiter nach ${h}`, (await hash()) === h, await hash())
  if (h === '#/garten') {
    await swipe(330, 300, 130, 303, { hold: true })
    await sleep(60)
    await shot('t5-garten-wischen')
    await touch('touchEnd')
    await sleep(650)
    if ((await hash()) !== '#/erfolge') throw new Error('Garten-Wisch unerwartet')
    await swipe(90, 300, 330, 303)
    await sleep(650)
    check('Garten wieder da', (await hash()) === '#/garten')
  }
}
await swipe(330, 300, 90, 303)
await sleep(500)
check('Letzte Seite: Wisch nach links bleibt', (await hash()) === '#/einstellungen')

// Wisch auf einem Knopf löst ihn nicht aus
await page.evaluate(() => { location.hash = '#/todos' })
await sleep(400)
const openBefore = await db((db) => db.todos.filter((t) => !t.done).count())
await swipe(40, 330, 290, 333)
await sleep(700)
const openAfter = await db((db) => db.todos.filter((t) => !t.done).count())
check('Wisch über einen Haken hakt nicht ab', openBefore === openAfter, `${openBefore} → ${openAfter}`)
check('… und wechselt die Seite', (await hash()) === '#/', await hash())
await page.evaluate(() => { location.hash = '#/todos' })
await sleep(400)

// ── Anlegen ──────────────────────────────────────────────────────────────────
await page.click('button[aria-label="Neues To-do"]')
await sleep(350)
await shot('t6-blatt-neu')
const disabledEmpty = await page.evaluate(() => document.querySelector('form button[type=submit]').disabled)
check('Ohne Titel nicht speicherbar', disabledEmpty)
await page.type('form input[aria-label^="Was darfst"]', 'Antrag, Formular; einreichen')
await page.keyboard.press('Enter')
await sleep(400)
const created = await db((db) => db.todos.filter((t) => t.title.startsWith('Antrag')).first())
check('Enter legt für heute an', !!created && created.scope === 'tag' && !created.remindAt, JSON.stringify(created))

// Wochen-To-do mit Erinnerung
await page.click('button[aria-label="To-do für diese Woche"]')
await sleep(350)
await page.type('form input[aria-label^="Was darfst"]', 'Wochenaufgabe mit Glocke')
const dayButtons = await page.evaluate(() => [...document.querySelectorAll('[aria-label="Erinnern an welchem Tag"] button')].map((b) => ({ t: b.textContent, d: b.disabled, p: b.getAttribute('aria-pressed') })))
check('Tage der Woche zur Wahl', dayButtons.length >= 1 && dayButtons[0].t === 'Heute', JSON.stringify(dayButtons.map((b) => b.t)))
await page.evaluate(() => {
  const days = [...document.querySelectorAll('[aria-label="Erinnern an welchem Tag"] button')]
  days[days.length - 1].click()
})
await sleep(60)
await tapText('form button', '18:00')
await sleep(100)
await shot('t7-blatt-woche')
const notifHint = await page.evaluate(() => document.querySelector('form').innerText.includes('erinnert dich nur der Kalender'))
check('Blatt sagt ehrlich, was bei geschlossener App gilt', notifHint)
await tapText('form button[type=submit]', 'Hinzufügen')
await sleep(400)
const weekly = await db((db) => db.todos.filter((t) => t.title.startsWith('Wochenaufgabe')).first())
check('Woche + Erinnerung am letzten Tag', weekly?.scope === 'woche' && weekly.reminders.length === 1 && /T18:00$/.test(weekly.reminders[0]), JSON.stringify(weekly?.reminders))

// ── Mehrere Erinnerungen ─────────────────────────────────────────────────────
const inGroup = async (label, text) => {
  const ok = await page.evaluate((label, text) => {
    const el = [...document.querySelectorAll(`[aria-label="${label}"] button`)].find((b) => b.textContent.trim() === text)
    if (!el) return false
    el.click()
    return true
  }, label, text)
  if (!ok) throw new Error(`nicht gefunden: ${label} / ${text}`)
  await sleep(60)
}
const chips = () => page.evaluate(() => [...document.querySelectorAll('[aria-label="Eingestellte Erinnerungen"] li')].map((l) => l.textContent.replace('🔔', '').replace('✕', '').trim()))
const setTime = (value) =>
  page.evaluate((value) => {
    const i = document.querySelector('input[aria-label="Eigene Uhrzeit"]')
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(i, value)
    i.dispatchEvent(new Event('input', { bubbles: true }))
  }, value)

await page.click('button[aria-label="Neues To-do"]')
await sleep(350)
await page.type('form input[aria-label^="Was darfst"]', 'Mehrfach erinnern')
await tapText('form button', 'Morgen')
await sleep(80)
const dayChips = await page.evaluate(() => [...document.querySelectorAll('[aria-label="Erinnern an welchem Tag"] button')].map((b) => [b.textContent, b.getAttribute('aria-pressed')]))
check('Tag ist vorgewählt: der Termin selbst', JSON.stringify(dayChips) === JSON.stringify([['Heute', 'false'], ['Morgen', 'true']]), JSON.stringify(dayChips))
await inGroup('Uhrzeiten', '08:00')
await inGroup('Uhrzeiten', '18:00')
await inGroup('Erinnern an welchem Tag', 'Heute')
const presetsToday = await page.evaluate(() => [...document.querySelectorAll('[aria-label="Uhrzeiten"] button')].map((b) => b.textContent))
const pad2 = (n) => String(n).padStart(2, '0')
const nowHm = (() => { const d = new Date(); return `${pad2(d.getHours())}:${pad2(d.getMinutes())}` })()
check('Heute werden keine vergangenen Uhrzeiten angeboten', presetsToday.filter((t) => /^\d\d:\d\d$/.test(t)).every((t) => t > nowHm), `${nowHm}: ${presetsToday.join(', ')}`)
// Drehen am Rad legt noch nichts an
await setTime('23:30')
await sleep(40)
await setTime('23:31')
await sleep(40)
await setTime('23:45')
await sleep(60)
check('Drehen an der Uhrzeit legt nichts an', (await chips()).length === 2, JSON.stringify(await chips()))
await tapText('form button', '+ Dazu')
await sleep(80)
check('Drei Erinnerungen an zwei Tagen, sortiert', JSON.stringify(await chips()) === JSON.stringify(['Heute 23:45', 'Morgen 08:00', 'Morgen 18:00']), JSON.stringify(await chips()))
const addTwice = await page.evaluate(() => [...document.querySelectorAll('form button')].find((b) => b.textContent.includes('+ Dazu')).disabled)
check('Dieselbe Zeit lässt sich nicht doppelt anlegen', addTwice)
check('Überschrift zählt mit', await page.evaluate(() => document.querySelector('form').innerText.toUpperCase().includes('3 ERINNERUNGEN')))
await shot('m1-blatt-mehrere')
// Uhrzeit-Knopf schaltet um
await inGroup('Erinnern an welchem Tag', 'Morgen')
await inGroup('Uhrzeiten', '08:00')
check('Nochmal antippen entfernt', (await chips()).length === 2)
await inGroup('Uhrzeiten', '08:00')
check('… und wieder dazu', (await chips()).length === 3)
// Kreuz entfernt
await page.evaluate(() => document.querySelector('button[aria-label="Erinnerung Morgen 18:00 entfernen"]').click())
await sleep(80)
check('Kreuz entfernt eine einzelne', JSON.stringify(await chips()) === JSON.stringify(['Heute 23:45', 'Morgen 08:00']), JSON.stringify(await chips()))
await tapText('form button[type=submit]', 'Hinzufügen')
await sleep(400)
const multi = await db((db) => db.todos.filter((t) => t.title === 'Mehrfach erinnern').first())
check('Gespeichert: beide, aufsteigend', multi?.reminders.length === 2 && multi.reminders[0] < multi.reminders[1] && /T23:45$/.test(multi.reminders[0]) && /T08:00$/.test(multi.reminders[1]), JSON.stringify(multi?.reminders))
const rowText = await page.evaluate(() => [...document.querySelectorAll('main li')].find((l) => l.innerText.includes('Mehrfach erinnern'))?.innerText ?? '')
check('Zeile zeigt alle Uhrzeiten eindeutig', rowText.includes('Heute 23:45, 08:00'), rowText.replace(/\n/g, ' | '))
await shot('m2-liste-mehrere')
// To-do wandert, Erinnerungen wandern mit
await tapText('main button', 'Mehrfach erinnern')
await sleep(350)
check('Bearbeiten zeigt alle Erinnerungen', (await chips()).length === 2)
await tapText('form button', 'Nächste Woche')
await sleep(80)
await tapText('form button[type=submit]', 'Speichern')
await sleep(400)
const moved = await db((db) => db.todos.filter((t) => t.title === 'Mehrfach erinnern').first())
check('Wandert das To-do, wandern die Erinnerungen mit', moved.scope === 'woche' && moved.reminders.length === 2 && moved.reminders.every((r, i) => r > multi.reminders[i]) && moved.reminders.every((r) => r.slice(11) === (r.endsWith('23:45') ? '23:45' : '08:00')), JSON.stringify(moved.reminders))
// … und zurück: Was dabei in die Vergangenheit rutscht, entfällt
await tapText('main button', 'Mehrfach erinnern')
await sleep(350)
await setTime('23:50')
await sleep(40)
await tapText('form button', '+ Dazu')
await sleep(80)
await tapText('form button', 'Heute')
await sleep(80)
const afterBack = await chips()
check('Beim Vorziehen fällt Vergangenes weg, Künftiges bleibt', JSON.stringify(afterBack) === JSON.stringify(['Heute 23:50']), JSON.stringify(afterBack))
await page.mouse.click(195, 30)
await sleep(350)

// ── Abhaken ──────────────────────────────────────────────────────────────────
await page.evaluate(() => document.querySelector('button[aria-label="Paket zur Post bringen erledigt"]').click())
await sleep(800)
const paket = await db((db) => db.todos.filter((t) => t.title.startsWith('Paket')).first())
check('Haken erledigt das To-do', paket?.done === true && typeof paket.doneAt === 'number')
await tapText('button', 'Erledigt (')
await sleep(250)
await page.evaluate(() => document.querySelector('button[aria-label="Paket zur Post bringen erledigt"]').click())
await sleep(500)
const paket2 = await db((db) => db.todos.filter((t) => t.title.startsWith('Paket')).first())
check('Zurücknehmen geht', paket2?.done === false)

// ── Bearbeiten und Löschen ───────────────────────────────────────────────────
await tapText('main button', 'Antrag, Formular')
await sleep(350)
await shot('t8-blatt-bearbeiten')
await page.evaluate(() => {
  const i = document.querySelector('form input[aria-label^="Was darfst"]')
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(i, 'Antrag geändert')
  i.dispatchEvent(new Event('input', { bubbles: true }))
})
await tapText('form button', 'Morgen')
await tapText('form button[type=submit]', 'Speichern')
await sleep(400)
const edited = await db((db) => db.todos.filter((t) => t.title === 'Antrag geändert').first())
check('Bearbeiten speichert Titel und Tag', !!edited && edited.date > created.date, JSON.stringify(edited?.date))
await tapText('main button', 'Antrag geändert')
await sleep(350)
await tapText('form button', 'To-do löschen')
await sleep(400)
const gone = await db((db) => db.todos.filter((t) => t.title === 'Antrag geändert').first())
check('Löschen als Grabstein', gone?.deleted === true)
check('… und aus der Liste verschwunden', !(await page.evaluate(() => document.body.innerText.includes('Antrag geändert'))))

// Überfälliges holen
const overdueBefore = await page.evaluate(() => document.body.innerText.includes('ÜBERFÄLLIG') || document.body.innerText.toLowerCase().includes('überfällig'))
check('Überfällig wird angezeigt', overdueBefore)
await tapText('button', 'Auf heute legen')
await sleep(400)
const holt = await db((db) => db.todos.get('demo-todo-1'))
const todayStr = (await db((db) => db.todos.get('demo-todo-2'))).date
check('„Auf heute legen“ wirkt', holt.date === todayStr, holt.date)

// ── Erinnerung ───────────────────────────────────────────────────────────────
await page.evaluate(async () => {
  const { db } = await import('/src/db/schema.ts')
  // Die Demodaten klingeln abends selbst, das würde hier mitzählen
  await db.todos.update('demo-todo-2', { reminders: [] })
  const pad = (n) => String(n).padStart(2, '0')
  const d = new Date(Date.now() - 120_000)
  const at = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  const base = { scope: 'tag', date: at.slice(0, 10), done: false, deleted: false, createdAt: 1, updatedAt: 1 }
  const pad3 = (x) => String(x).padStart(2, '0')
  const t = new Date(Date.now() + 86_400_000)
  const later = `${t.getFullYear()}-${pad3(t.getMonth() + 1)}-${pad3(t.getDate())}T09:00`
  const d0 = new Date(Date.now() - 600_000)
  const earlier = `${d0.getFullYear()}-${pad3(d0.getMonth() + 1)}-${pad3(d0.getDate())}T${pad3(d0.getHours())}:${pad3(d0.getMinutes())}`
  await db.todos.bulkPut([
    { ...base, id: 'ring-1', title: 'Erinnerung Eins', reminders: [earlier, at, later] },
    { ...base, id: 'ring-2', title: 'Erinnerung Zwei', reminders: [earlier, at, later] },
    { ...base, id: 'ring-3', title: 'Erinnerung Drei', reminders: [at] },
  ])
  document.dispatchEvent(new Event('visibilitychange'))
})
await sleep(600)
await shot('t9-erinnerung')
const banner = await page.evaluate(() => document.querySelector('[role=alert]')?.innerText ?? '')
check('Banner: pro To-do einer, auch wenn mehrere verpasst sind', banner.includes('Erinnerung Eins') && banner.includes('2 weitere'), banner.replace(/\n/g, ' | '))
await tapText('[role=alert] button', '1 Std.')
await sleep(500)
const r1 = await db((db) => db.todos.get('ring-1'))
check('„1 Std.“ ersetzt die fälligen, die spätere bleibt', r1.reminders.length === 2 && r1.reminders[1].endsWith('T09:00'), JSON.stringify(r1.reminders))
await tapText('[role=alert] button', 'OK')
await sleep(500)
const r2 = await db((db) => db.todos.get('ring-2'))
check('„OK“ räumt alle fälligen ab, die spätere bleibt, To-do bleibt offen', r2.reminders.length === 1 && r2.reminders[0].endsWith('T09:00') && !r2.done, JSON.stringify(r2.reminders))
await tapText('[role=alert] button', 'Erledigt')
await sleep(500)
const r3 = await db((db) => db.todos.get('ring-3'))
check('„Erledigt“ im Banner hakt ab', r3.done === true)
check('Banner ist weg', !(await page.evaluate(() => !!document.querySelector('[role=alert]'))))

// Erinnerung, die erst beim Warten fällig wird
await page.evaluate(async () => {
  const { db } = await import('/src/db/schema.ts')
  const pad = (n) => String(n).padStart(2, '0')
  const d = new Date()
  const at = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  await db.todos.put({ id: 'ring-live', title: 'Kommt von selbst', scope: 'tag', date: at.slice(0, 10), done: false, deleted: false, createdAt: 1, updatedAt: 1, reminders: [at] })
})
await sleep(16_500)
// nach 12 s ist das Banner zur Glocke geworden
await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.getAttribute('aria-label')?.startsWith('Erinnerung:'))?.click())
await sleep(500)
check('Offene App meldet sich ohne Zutun', (await page.evaluate(() => document.querySelector('[role=alert]')?.innerText ?? '')).includes('Kommt von selbst'))
await tapText('[role=alert] button', 'OK')
await sleep(400)

// ── Kalender ─────────────────────────────────────────────────────────────────
const calendar = await page.evaluate(async () => {
  const file = new File(['x'], 'a.ics', { type: 'text/calendar' })
  const canShare = navigator.canShare?.({ files: [file] }) ?? null
  // Wegspeichern abfangen, um den Inhalt zu lesen
  navigator.canShare = () => false
  let captured = null
  const orig = URL.createObjectURL
  URL.createObjectURL = (b) => {
    captured = b
    return orig.call(URL, b)
  }
  const btn = [...document.querySelectorAll('button')].find((b) => /in den Kalender/.test(b.textContent))
  const label = btn.textContent
  btn.click()
  await new Promise((r) => setTimeout(r, 300))
  URL.createObjectURL = orig
  return { canShare, label, type: captured?.type, text: captured ? await captured.text() : null }
})
console.log('     canShare(.ics) in Edge headless:', calendar.canShare, '· Knopf:', calendar.label)
check('Kalenderdatei wird erzeugt', calendar.type === 'text/calendar' && /BEGIN:VEVENT/.test(calendar.text ?? ''))
check('… enthält den Alarm', /BEGIN:VALARM/.test(calendar.text ?? '') && /TRIGGER:PT0S/.test(calendar.text ?? ''))
check('… nur künftige, offene Erinnerungen', !(calendar.text ?? '').includes('Kommt von selbst') && !(calendar.text ?? '').includes('Erinnerung Drei'))
const wanted = await db(async (db) => {
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  const now = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
  return (await db.todos.toArray()).filter((t) => !t.done && !t.deleted).flatMap((t) => t.reminders).filter((r) => r > now).length
})
const events = (calendar.text ?? '').match(/BEGIN:VEVENT/g)?.length ?? 0
const uids = (calendar.text ?? '').split('\r\n').filter((l) => l.startsWith('UID:'))
check('Jede Erinnerung ist ein eigener Termin', events === wanted && wanted > 3 && new Set(uids).size === events, `${events} Termine, erwartet ${wanted}`)
console.log((calendar.text ?? '').split('\r\n').slice(0, 18).join('\n'))

// ── Backup ───────────────────────────────────────────────────────────────────
const backup = await page.evaluate(async () => {
  const { createBackup, parseBackup, restoreBackup } = await import('/src/db/backup.ts')
  const { db } = await import('/src/db/schema.ts')
  const made = await createBackup()
  const parsed = parseBackup(JSON.stringify(made))
  const before = (await db.todos.toArray()).filter((t) => !t.deleted).length
  await restoreBackup(parsed)
  const after = await db.todos.count()
  return { version: made.version, inFile: made.todos.length, before, after }
})
check('Backup enthält To-dos und spielt sie zurück', backup.version >= 5 && backup.inFile === backup.before && backup.after === backup.before, JSON.stringify(backup))

// ── Leiste: passen fünf Reiter? ──────────────────────────────────────────────
for (const width of [320, 360, 390, 430]) {
  await page.setViewport({ width, height: 800, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
  await sleep(200)
  const m = await page.evaluate(() =>
    [...document.querySelectorAll('nav button')].map((b) => {
      const range = document.createRange()
      range.selectNodeContents(b.lastChild)
      const t = range.getBoundingClientRect()
      const r = b.getBoundingClientRect()
      return { label: b.innerText.trim(), text: Math.ceil(t.width), box: Math.floor(r.width), left: Math.floor(t.left), right: Math.ceil(t.right) }
    }),
  )
  const last = m[m.length - 1]
  const ok = m.every((x) => x.text <= x.box) && last.right <= width
  check(`Leiste bei ${width}px`, ok, m.map((x) => `${x.label} ${x.text}/${x.box}`).join(', '))
  if (width === 320) await shot('t10-leiste-320')
}

// ── Dunkel ───────────────────────────────────────────────────────────────────
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'dark' }])
await page.evaluate(() => { location.hash = '#/todos' })
await sleep(500)
await shot('t11-todos-dunkel')
await page.evaluate(() => { location.hash = '#/' })
await sleep(500)
await shot('t12-heute-dunkel')

console.log(errors.length ? `\nFehler im Browser:\n${errors.join('\n')}` : '\nKeine Browser-Fehler')
console.log(fails ? `\n${fails} FEHLGESCHLAGEN` : '\nALLES OK')
await browser.close()
process.exit(fails || errors.length ? 1 : 0)
