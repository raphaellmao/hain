// iPhone-Test mit WebKit (Safaris Engine) und iPhone-Profil – nur über die Oberfläche,
// gegen den fertigen Build. Kein echtes iPhone, aber dieselbe Engine wie Safari.
import { webkit, devices } from 'playwright'
import { join } from 'node:path'

const APP = process.env.APP ?? 'http://localhost:4173/'
const OUT = new URL('./bilder/', import.meta.url).pathname.replace(/^\/(\w:)/, '$1')
;(await import('node:fs')).mkdirSync(OUT, { recursive: true })
const DEVICE = process.env.DEVICE ?? 'iPhone 15'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let fails = 0
const check = (name, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${name}${extra ? ` – ${extra}` : ''}`)
}

const browser = await webkit.launch()
const context = await browser.newContext({ ...devices[DEVICE], colorScheme: process.env.SCHEME ?? 'dark', permissions: [] })
const page = await context.newPage()
page.setDefaultTimeout(20000)
const errors = []
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
page.on('console', (m) => {
  if (m.type() === 'error' && !/favicon|404|Failed to load resource/.test(m.text())) errors.push(`console: ${m.text()}`)
})
const tag = DEVICE.replace(/\W+/g, '').toLowerCase()
const shot = (name) => page.screenshot({ path: join(OUT, `ip-${tag}-${name}.png`) })
const go = async (hash) => {
  // Live gibt es einen Service Worker – dann wird das Netz nie ganz ruhig
  await page.goto(`${APP}${hash}`, { waitUntil: 'load', timeout: 30000 })
  await sleep(1200)
}
const clickText = async (selector, text) => {
  const el = page.locator(selector, { hasText: text }).first()
  await el.click()
  await sleep(350)
}
const tapRow = async (name) => {
  await page.locator(`main button[aria-pressed][aria-label^="${name}"]`).first().click()
  await sleep(450)
}
const overflow = () => page.evaluate(() => document.documentElement.scrollWidth - innerWidth)

console.log(`Gerät: ${DEVICE} · WebKit ${browser.version()}`)

// ── Start ──────────────────────────────────────────────────────────────────
await go('')
check('Startseite lädt (leerer Hain mit Vorlagen)', (await page.locator('text=Oder mit einer Vorlage').count()) === 1)
await shot('01-start')

// ── Gewohnheiten über Vorlagen anlegen ─────────────────────────────────────
await clickText('button', 'Liegestütze')
await clickText('button[aria-pressed]', 'Lumenpilz')
await page.locator('button[aria-label="Regenbogen"]').click()
await sleep(200)
await shot('02-formular')
await clickText('button', 'Pflanzen')
await sleep(600)
for (const t of ['Früh aufstehen', 'Kein Social Media']) {
  await go('#/neu')
  await clickText('[aria-labelledby=vorlagen] button', t)
  await clickText('button', 'Pflanzen')
  await sleep(500)
}
await go('')
const rows = await page.locator('main button[aria-pressed]').count()
check('Drei Gewohnheiten auf „Heute“', rows >= 3, String(rows))
check('„Heute“ nicht zu breit', (await overflow()) <= 0, String(await overflow()))
await shot('03-heute')

// ── Abhaken bis zur Feier ──────────────────────────────────────────────────
for (let i = 0; i < 5; i++) await tapRow('Liegestütze')
await tapRow('Früh aufstehen')
await tapRow('Kein Social Media')
await sleep(900)
const party = await page.locator('[data-celebration]').getAttribute('data-celebration').catch(() => null)
check('Feier erscheint nach dem letzten Haken', party === 'gross', String(party))
await sleep(900)
await shot('04-feier')
if (party) await clickText('[data-celebration] button', 'Weiter')
await sleep(500)

// ── Stimmung und Notiz ─────────────────────────────────────────────────────
await page.locator('[role=radiogroup][aria-label=Stimmung] button[aria-label="Gut"]').click()
await sleep(300)
check('Stimmung gespeichert', (await page.locator('[role=radiogroup][aria-label=Stimmung] [aria-checked=true]').count()) === 1)
const note = page.locator('textarea').first()
await note.fill('Test auf dem iPhone')
await note.blur()
await sleep(500)

// ── To-do ──────────────────────────────────────────────────────────────────
await go('#/todos')
await page.locator('button[aria-label="To-do für heute"]').click()
await sleep(600)
await page.locator('input[placeholder="Was darfst du nicht vergessen?"]').fill('Uniform reinigen')
await sleep(150)
await shot('05-todo-blatt')
await page.locator('[role=dialog] button[type=submit]').first().click()
await sleep(800)
check('To-do angelegt', (await page.locator('text=Uniform reinigen').count()) >= 1)
await page.locator('button[aria-label^="Kleiner anzeigen"]').click()
await sleep(400)
check('Anzeigegröße umschaltbar', (await page.evaluate(() => document.documentElement.dataset.density)) === 'kompakt')
await shot('06-todos-kompakt')
await page.locator('button[aria-label="Größer anzeigen"]').click()
await sleep(300)

// ── Routine ────────────────────────────────────────────────────────────────
await go('#/routine/neu')
await page.locator('input[placeholder="z. B. Morgenroutine"]').fill('Morgen')
await clickText('button', 'Nach dem Aufstehen')
await clickText('main button, div button', 'Früh aufstehen')
await clickText('main button, div button', 'Liegestütze')
await clickText('button', 'Routine anlegen')
await sleep(600)
await go('')
check('Routinenkarte auf „Heute“', (await page.locator('li[aria-label="Routine Morgen"]').count()) === 1)

// ── Garten, Teilen, QR ─────────────────────────────────────────────────────
await go('#/garten')
await sleep(800)
check('Garten zeigt die Pflanzen', (await page.locator('main li').count()) >= 3)
check('Garten nicht zu breit', (await overflow()) <= 0)
await shot('07-garten')
await page.locator('button[aria-label="Garten als Bild teilen"]').click()
let size = null
for (let i = 0; i < 60 && !size; i++) {
  await sleep(250)
  size = await page.evaluate(() => {
    const img = document.querySelector('[role=dialog] img')
    return img?.complete && img.naturalWidth ? `${img.naturalWidth}×${img.naturalHeight}` : null
  })
}
check('Gartenbild entsteht in WebKit', size === '1080×1350', String(size))
await shot('08-gartenbild')
await page.keyboard.press('Escape')
await sleep(500)
await go('#/einstellungen')
await clickText('button', 'Hain weitergeben')
const qr = await page.locator('[role=dialog] svg[role=img]').count()
check('QR-Code erscheint', qr === 1)
await page.keyboard.press('Escape')
await sleep(400)

// ── Detail, Schatten-Ich, Erfolge, Rückblick ───────────────────────────────
await go('#/garten')
await page.locator('main li button', { hasText: 'Kein Social Media' }).first().click()
await sleep(1200)
check('Schatten-Ich-Detail lädt', (await page.locator('svg[role=img][aria-label*="Schatten-Ich"]').count()) >= 1)
await shot('09-schatten')
await go('#/erfolge')
check('Erfolge laden', (await page.locator('text=Kettenreaktion').count()) >= 1)
check('Erfolge nicht zu breit', (await overflow()) <= 0)
await shot('10-erfolge')
const shareBtn = page.locator('button[aria-label$="als Bild teilen"]').first()
if (await shareBtn.count()) {
  await shareBtn.click()
  let achSize = null
  for (let i = 0; i < 40 && !achSize; i++) {
    await sleep(250)
    achSize = await page.evaluate(() => {
      const img = document.querySelector('[role=dialog] img')
      return img?.complete && img.naturalWidth ? `${img.naturalWidth}×${img.naturalHeight}` : null
    })
  }
  check('Erfolgsbild entsteht in WebKit', achSize === '1080×1350', String(achSize))
  await shot('11-erfolgsbild')
  await page.keyboard.press('Escape')
  await sleep(400)
} else check('Ein Erfolg zum Teilen vorhanden', false)
await go('#/rueckblick')
check('Wochenrückblick lädt', (await page.locator('h1', { hasText: 'Wochenrückblick' }).count()) === 1)

// ── Speicher bleibt nach Neuladen ──────────────────────────────────────────
await page.reload({ waitUntil: 'load' })
await go('')
check('Daten überleben das Neuladen (IndexedDB in WebKit)', (await page.locator('main button[aria-pressed]').count()) >= 3)
check('Notiz gespeichert', (await page.locator('textarea').first().inputValue()) === 'Test auf dem iPhone')

check('Keine Fehler in der Konsole', errors.length === 0, errors.slice(0, 4).join(' / '))
await browser.close()
console.log(fails ? `${fails} FEHLER` : 'ALLES OK')
process.exit(fails ? 1 : 0)
