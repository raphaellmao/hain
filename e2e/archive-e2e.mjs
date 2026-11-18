// Archiv und Reihenfolge über die echte Oberfläche, frisches Profil
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

const browser = await puppeteer.launch({ executablePath: EDGE, headless: 'new', userDataDir: mkdtempSync(join(tmpdir(), 'hain-arc-')), args: ['--no-first-run'] })
const page = await browser.newPage()
await page.emulate({ viewport: { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36' })
const errors = []
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
page.on('console', (m) => {
  if (m.type() === 'error' && !/favicon|404/.test(m.text())) errors.push(`console: ${m.text()}`)
})
const cdp = await page.createCDPSession()
const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] })
const shot = (name) => page.screenshot({ path: join(OUT, `${name}.png`) })
const tap = async (selector, text) => {
  const ok = await page.evaluate((selector, text) => {
    const el = [...document.querySelectorAll(selector)].find((e) => e.textContent.trim().includes(text))
    if (!el) return false
    el.click()
    return true
  }, selector, text)
  if (!ok) throw new Error(`nicht gefunden: ${selector} „${text}“`)
  await sleep(250)
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
const pad = (n) => String(n).padStart(2, '0')
const ds = (offset) => {
  const d = new Date(Date.now() + offset * 86_400_000)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
const todayNames = () => page.evaluate(() => [...document.querySelectorAll('main li')].map((li) => li.querySelector('.truncate')?.textContent).filter(Boolean))
const achieved = async () => {
  await page.goto(`${BASE}/#/erfolge`, { waitUntil: 'networkidle0' })
  await sleep(600)
  return page.evaluate(() => document.querySelector('header p').textContent)
}

await page.goto(`${BASE}/?demo`, { waitUntil: 'networkidle0' })
await sleep(1000)
const before = await achieved()

// ── Ins Archiv ───────────────────────────────────────────────────────────────
await page.goto(`${BASE}/#/habit/demo-2/bearbeiten`, { waitUntil: 'networkidle0' })
await sleep(500)
await tap('button', 'Ins Archiv legen')
await sleep(600)
check('Nach dem Archivieren auf „Heute“', await page.evaluate(() => location.hash === '#/' || location.hash === ''))
let names = await todayNames()
check('„Laufen“ ist aus „Heute“ verschwunden', !names.includes('Laufen'), names.join(', '))
const laufen = await db((db) => db.habits.get('demo-2'))
check('Archiv mit gemerkten Tagen und Pausen-Version', laufen.archived?.since === ds(0) && JSON.stringify(laufen.archived.days) === '[1,3,5]' && JSON.stringify(laufen.schedule.at(-1)) === JSON.stringify({ from: ds(0), days: [] }), JSON.stringify(laufen.archived))
await page.goto(`${BASE}/#/garten`, { waitUntil: 'networkidle0' })
await sleep(500)
check('… und aus dem Garten', !(await page.evaluate(() => document.querySelector('main').innerText.includes('Laufen'))))
check('Erfolge bleiben', (await achieved()) === before, `${before} → ${await achieved()}`)

// Zehn Tage Pause vortäuschen: Archiv begann vor zehn Tagen
await db((db, since) => db.habits.update('demo-2', (h) => {
  h.archived.since = since
  h.schedule[h.schedule.length - 1].from = since
}), ds(-10))

// ── Verwaltung ───────────────────────────────────────────────────────────────
await page.goto(`${BASE}/#/einstellungen`, { waitUntil: 'networkidle0' })
await sleep(500)
check('Einstellungen zeigen das Archiv', await page.evaluate(() => document.body.innerText.includes('1 im Archiv')))
await tap('button', 'Routinen & Archiv')
await sleep(500)
check('Seite „Gewohnheiten“', await page.evaluate(() => location.hash === '#/gewohnheiten'))
await shot('arc1-verwaltung')
const archText = await page.evaluate(() => [...document.querySelectorAll('section')].find((s) => s.textContent.includes('Archiv'))?.innerText ?? '')
check('Archiv-Liste mit „Laufen“', archText.includes('Laufen') && archText.includes('im Archiv seit'), archText.replace(/\n/g, ' | '))

// Detailseite eines archivierten
await page.goto(`${BASE}/#/habit/demo-2`, { waitUntil: 'networkidle0' })
await sleep(500)
const detail = await page.evaluate(() => document.body.innerText)
check('Detail: Hinweis und kein „Bearbeiten“', detail.includes('Im Archiv seit') && !detail.includes('Bearbeiten'))
await tap('button', 'Zurückholen')
await sleep(600)
const back = await db((db) => db.habits.get('demo-2'))
check('Zurückgeholt: wieder fällig wie vorher, ans Ende', !back.archived && JSON.stringify(back.schedule.at(-1)) === JSON.stringify({ from: ds(0), days: [1, 3, 5] }), JSON.stringify(back.schedule.slice(-2)))
await page.goto(`${BASE}/`, { waitUntil: 'networkidle0' })
await sleep(600)
names = await todayNames()
const laufenRow = await page.evaluate(() => [...document.querySelectorAll('main li')].find((li) => li.innerText.includes('Laufen'))?.innerText ?? '')
const fridayEtc = [1, 3, 5].includes(new Date().getDay())
check('Wieder auf „Heute“ (oder heute nicht fällig)', fridayEtc ? names.includes('Laufen') : true, names.join(', '))
check('Zehn Tage Pause: nichts gewelkt', !laufenRow.includes('welkt'), laufenRow.replace(/\n/g, ' | '))
const health = await page.evaluate(async () => {
  const { computeHealth } = await import('/src/domain/health.ts')
  const { db } = await import('/src/db/schema.ts')
  const h = await db.habits.get('demo-2')
  const done = new Set((await db.checkins.where('habitId').equals('demo-2').toArray()).filter((c) => c.done).map((c) => c.date))
  const p = (n) => String(n).padStart(2, '0')
  const d = new Date()
  return computeHealth(h, done, `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`).missRun
})
check('… auch rechnerisch kein verpasster Tag', health === 0, `missRun ${health}`)

// ── Reihenfolge per Ziehen ───────────────────────────────────────────────────
await page.goto(`${BASE}/#/gewohnheiten`, { waitUntil: 'networkidle0' })
await sleep(600)
const orderBefore = await page.evaluate(() => [...document.querySelectorAll('[data-grip]')].map((b) => b.getAttribute('data-grip')))
const grips = await page.evaluate(() => [...document.querySelectorAll('[data-grip]')].slice(0, 4).map((b) => { const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 } }))
// den dritten an die erste Stelle ziehen
await touch('touchStart', grips[2].x, grips[2].y)
for (let i = 1; i <= 16; i++) {
  await touch('touchMove', grips[2].x, grips[2].y + ((grips[0].y - 20 - grips[2].y) * i) / 16)
  await sleep(25)
}
await touch('touchEnd')
await sleep(800)
const orderAfter = await page.evaluate(() => [...document.querySelectorAll('[data-grip]')].map((b) => b.getAttribute('data-grip')))
check('Ziehen: der dritte steht oben', orderAfter[0] === orderBefore[2], `${orderBefore.slice(0, 3)} → ${orderAfter.slice(0, 3)}`)
const saved = await db((db) => db.habits.orderBy('order').toArray().then((l) => l.filter((h) => !h.deleted && !h.archived).map((h) => h.id)))
check('… gespeichert', JSON.stringify(saved) === JSON.stringify(orderAfter), saved.slice(0, 3).join(','))
await shot('arc2-sortiert')

// Tastatur
await page.focus(`[data-grip="${orderAfter[0]}"]`)
await page.keyboard.press('ArrowDown')
await sleep(600)
const orderKey = await db((db) => db.habits.orderBy('order').toArray().then((l) => l.filter((h) => !h.deleted && !h.archived).map((h) => h.id)))
check('Pfeiltaste schiebt einen Platz nach unten', orderKey[1] === orderAfter[0] && orderKey[0] === orderAfter[1], orderKey.slice(0, 3).join(','))
check('… Fokus bleibt am Griff', await page.evaluate((id) => document.activeElement?.getAttribute('data-grip') === id, orderAfter[0]))

// „Heute“ folgt der Reihenfolge
await page.goto(`${BASE}/`, { waitUntil: 'networkidle0' })
await sleep(600)
const todayIds = await page.evaluate(() => [...document.querySelectorAll('main li button[aria-label]')].map((b) => b.getAttribute('aria-label')))
const firstName = await db((db, id) => db.habits.get(id).then((h) => h.name), orderKey[0])
check('„Heute“ folgt der neuen Reihenfolge', (todayIds[0] ?? '').startsWith(firstName) || (await todayNames())[0] === firstName, `${firstName} / ${(await todayNames())[0]}`)

// Backup
const backup = await page.evaluate(async () => {
  const { db } = await import('/src/db/schema.ts')
  const { archiveHabit } = await import('/src/db/repo.ts')
  const p = (n) => String(n).padStart(2, '0')
  const d = new Date()
  await archiveHabit('demo-3', `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`)
  const { createBackup, parseBackup, restoreBackup } = await import('/src/db/backup.ts')
  const made = await createBackup()
  await restoreBackup(parseBackup(JSON.stringify(made)))
  return { version: made.version, archived: !!(await db.habits.get('demo-3')).archived }
})
check('Backup behält das Archiv', backup.version >= 8 && backup.archived, JSON.stringify(backup))

console.log(errors.length ? `\nFehler im Browser:\n${errors.join('\n')}` : '\nKeine Browser-Fehler')
console.log(fails ? `\n${fails} FEHLGESCHLAGEN` : '\nALLES OK')
await browser.close()
process.exit(fails || errors.length ? 1 : 0)
