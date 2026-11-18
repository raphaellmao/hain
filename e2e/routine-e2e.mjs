// Plan, Routinen und Belohnung über die echte Oberfläche, frisches Profil
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

const browser = await puppeteer.launch({ executablePath: EDGE, headless: 'new', userDataDir: mkdtempSync(join(tmpdir(), 'hain-rout-')), args: ['--no-first-run'] })
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
  await sleep(350)
}
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
/** Zeile abhaken über ihren großen Knopf */
const checkRow = async (name) => {
  const ok = await page.evaluate((name) => {
    const b = [...document.querySelectorAll('main button[aria-pressed]')].find((x) => x.getAttribute('aria-label')?.startsWith(`${name} `))
    b?.click()
    return !!b
  }, name)
  if (!ok) throw new Error(`Zeile ${name} nicht gefunden`)
  await sleep(600)
}
const card = () =>
  page.evaluate(() => {
    const c = document.querySelector('li[aria-label^="Routine "]')
    if (!c) return null
    return {
      text: c.querySelector('button')?.innerText ?? '',
      rows: [...c.querySelectorAll('button[aria-pressed]')].map((b) => b.getAttribute('aria-label')?.split(' ')[0]),
      next: [...c.querySelectorAll('li')].filter((li) => li.className.includes('ring-2')).map((li) => li.querySelector('button[aria-pressed]')?.getAttribute('aria-label')?.split(' ')[0]),
      burst: c.className.includes('routine-burst'),
    }
  })
const celebration = () => page.evaluate(() => document.querySelector('[data-celebration]')?.getAttribute('data-celebration') ?? null)
const toasts = () => page.evaluate(() => document.body.innerText)

// ── Drei Gewohnheiten ──────────────────────────────────────────────────────
await page.goto(`${BASE}/`, { waitUntil: 'networkidle0' })
await sleep(600)
const ids = {}
for (const [name, emoji] of [['Wasser', '💧'], ['Dehnen', '🤸'], ['Lesen', '📖']]) {
  ids[name] = await mod('/src/db/repo.ts', (m, name, emoji, start) => m.createHabit({ name, emoji, color: 'koralle', days: [0, 1, 2, 3, 4, 5, 6], startDate: start, seed: 5, species: 'laubbaum', metaphor: 'pflanze' }), name, emoji, ds(-3))
}
await sleep(500)
check('Beim Laden keine Feier', (await celebration()) === null)

// ── Plan über das Formular ─────────────────────────────────────────────────
await page.goto(`${BASE}/#/habit/${ids.Lesen}/bearbeiten`, { waitUntil: 'networkidle0' })
await sleep(500)
await tap('button', 'Vor dem Schlafengehen')
await tap('button', 'Speichern')
await sleep(500)
let lesen = await mod('/src/db/schema.ts', (m, id) => m.db.habits.get(id), ids.Lesen)
check('Plan gespeichert', lesen.plan === 'Vor dem Schlafengehen', lesen.plan)
await page.goto(`${BASE}/`, { waitUntil: 'networkidle0' })
await sleep(600)
const planLine = await page.evaluate(() => [...document.querySelectorAll('main li')].find((li) => li.innerText.includes('Lesen'))?.innerText ?? '')
check('Plan steht unter dem Namen', planLine.includes('↪ Vor dem Schlafengehen'), planLine.replace(/\n/g, ' | '))

// ── Routine anlegen ────────────────────────────────────────────────────────
await page.goto(`${BASE}/#/einstellungen`, { waitUntil: 'networkidle0' })
await sleep(400)
await tap('button', 'Reihenfolge, Routinen & Archiv')
await tap('button', '+ Neue Routine')
check('Routinen-Formular offen', (await page.evaluate(() => location.hash)) === '#/routine/neu')
await page.type('input[placeholder="z. B. Morgenroutine"]', 'Morgenroutine')
await tap('button', 'Nach dem Aufstehen')
await tap('main button, div button', 'Dehnen')
await tap('main button, div button', 'Wasser')
let saveDisabled = await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Routine anlegen')?.disabled)
check('Mit zwei Schritten speicherbar', saveDisabled === false)
await page.click('button[aria-label="Wasser nach oben"]')
await sleep(200)
const order = await page.evaluate(() => [...document.querySelectorAll('ol li')].map((li) => li.innerText.split('\n').find((t) => /\p{L}/u.test(t))))
check('Reihenfolge per Pfeil geändert', JSON.stringify(order).indexOf('Wasser') < JSON.stringify(order).indexOf('Dehnen'), JSON.stringify(order))
await shot('r1-formular')
await tap('button', 'Routine anlegen')
await sleep(600)
const routines = await mod('/src/db/schema.ts', (m) => m.db.routines.toArray())
check('Routine gespeichert', routines.length === 1 && routines[0].cue === 'Nach dem Aufstehen' && JSON.stringify(routines[0].habitIds) === JSON.stringify([ids.Wasser, ids.Dehnen]), JSON.stringify(routines))

// ── „Heute“: Kette, als Nächstes, Abhaken ──────────────────────────────────
await page.goto(`${BASE}/`, { waitUntil: 'networkidle0' })
await sleep(700)
let c = await card()
check('Routinenkarte mit Kette in Reihenfolge', c && JSON.stringify(c.rows) === '["Wasser","Dehnen"]', JSON.stringify(c))
check('Erste ist als Nächstes markiert', c?.text.includes('Als Nächstes: Wasser') && JSON.stringify(c.next) === '["Wasser"]', JSON.stringify(c))
await shot('r2-heute')
await checkRow('Wasser')
c = await card()
check('Nach dem Abhaken: Dehnen ist dran', c?.text.includes('Als Nächstes: Dehnen') && JSON.stringify(c.next) === '["Dehnen"]', c?.text)
await checkRow('Dehnen')
c = await card()
check('Routine komplett: geschafft und leuchtet', c?.text.includes('Geschafft') && c.burst, JSON.stringify(c))
check('Hinweis „Morgenroutine geschafft“', (await toasts()).includes('Morgenroutine geschafft'))
check('Noch keine Tagesfeier (Lesen offen)', (await celebration()) === null)
await shot('r3-routine-fertig')

// ── Alles erledigt: große Feier ────────────────────────────────────────────
await checkRow('Lesen')
await sleep(900)
check('Große Feier erscheint', (await celebration()) === 'gross')
const cardText = await page.evaluate(() => document.querySelector('[data-celebration] [role=status]')?.innerText ?? '')
check('Karte: Tag geschafft, alle 3, erster perfekter Tag', cardText.includes('Tag geschafft!') && cardText.includes('Alle 3 Gewohnheiten erledigt') && cardText.includes('erster perfekter Tag'), cardText.replace(/\n/g, ' | '))
const parts = await page.evaluate(() => document.querySelectorAll('[data-celebration] .cel').length)
check('Effekt mit Teilchen', parts >= 30, String(parts))
await sleep(1200)
await shot('r4-feier')
await tap('[data-celebration] button', 'Zum Garten')
await sleep(900)
check('„Zum Garten“ führt hin und schließt', (await page.evaluate(() => location.hash)) === '#/garten' && (await celebration()) === null)
const head = await page.evaluate(() => document.querySelector('header p')?.textContent ?? '')
check('Garten: „Perfekter Tag“ in der Kopfzeile', head.includes('Perfekter Tag'), head)

// Garten bei Tag und bei Nacht (Entwickler-Schalter für die Tageszeit)
await page.goto(`${BASE}/?zeit=tag&saison=sommer&wetter=klar#/garten`, { waitUntil: 'networkidle0' })
await sleep(900)
let g = await page.evaluate(() => ({ rainbow: !!document.querySelector('[data-rainbow]'), sparkles: document.querySelectorAll('.sparkle[data-perfect]').length }))
check('Tag: Regenbogen und Funkeln', g.rainbow && g.sparkles > 10, JSON.stringify(g))
await shot('r5-garten-tag')
await page.goto(`${BASE}/?zeit=nacht#/garten`, { waitUntil: 'networkidle0' })
await sleep(900)
g = await page.evaluate(() => ({ rainbow: !!document.querySelector('[data-rainbow]'), gold: document.querySelectorAll('.firefly-gold').length }))
check('Nacht: goldene Glühwürmchen, kein Regenbogen', !g.rainbow && g.gold > 20, JSON.stringify(g))
await shot('r6-garten-nacht')
check('Neu laden: keine erneute Feier', (await celebration()) === null)

// Wieder ab- und anhaken: nur noch der kleine Effekt
await page.goto(`${BASE}/`, { waitUntil: 'networkidle0' })
await sleep(700)
await checkRow('Lesen')
await checkRow('Lesen')
await sleep(500)
check('Zweites Mal am Tag: nur kleiner Effekt', (await celebration()) === 'klein')

// Serie: gestern auch perfekt
await mod('/src/db/schema.ts', (m, ids, d) => Promise.all(ids.map((id) => m.db.checkins.put({ id: `${id}_${d}`, habitId: id, date: d, done: true, updatedAt: Date.now() }))), Object.values(ids), ds(-1))
await page.goto(`${BASE}/`, { waitUntil: 'networkidle0' })
await sleep(800)
const allDone = await page.evaluate(() => document.querySelector('main')?.innerText ?? '')
check('„Heute“ zeigt die Serie perfekter Tage', allDone.includes('2 perfekte Tage in Folge'), allDone.slice(0, 200).replace(/\n/g, ' | '))

// Detailansicht nennt die Routine
await page.goto(`${BASE}/#/habit/${ids.Wasser}`, { waitUntil: 'networkidle0' })
await sleep(500)
const detail = await page.evaluate(() => document.querySelector('main')?.innerText ?? document.body.innerText)
check('Detail: Teil von „Morgenroutine“', detail.includes('Teil von „Morgenroutine“'))

// Backup
const backup = await mod('/src/db/backup.ts', async (m) => {
  const b = await m.createBackup()
  const back = m.parseBackup(JSON.stringify(b))
  return { version: b.version, routines: back.routines.length, plan: back.habits.find((h) => h.plan)?.plan }
})
check('Backup Format 10 mit Routine und Plan', backup.version === 10 && backup.routines === 1 && backup.plan === 'Vor dem Schlafengehen', JSON.stringify(backup))

// Routine auflösen
await page.goto(`${BASE}/#/routine/${routines[0].id}`, { waitUntil: 'networkidle0' })
await sleep(500)
await tap('button', 'Routine auflösen')
await tap('[role=alertdialog] button', 'Auflösen')
await sleep(600)
await page.goto(`${BASE}/`, { waitUntil: 'networkidle0' })
await sleep(600)
check('Aufgelöst: keine Karte mehr, Gewohnheiten bleiben', (await card()) === null && (await page.evaluate(() => document.querySelectorAll('main button[aria-pressed]').length)) === 3)

check('Keine Fehler in der Konsole', errors.length === 0, errors.join(' / '))
await browser.close()
console.log(fails ? `${fails} FEHLER` : 'ALLES OK')
process.exit(fails ? 1 : 0)
