// Alle Ansichten in mehreren Breiten, hell und dunkel: Fehler, Überlauf, zu kleine Knöpfe, Extremfälle
import puppeteer from 'puppeteer-core'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const BASE = process.env.BASE ?? 'http://localhost:5173'
const OUT = new URL('./bilder/', import.meta.url).pathname.replace(/^\/(\w:)/, '$1')
;(await import('node:fs')).mkdirSync(OUT, { recursive: true })
const EDGE = process.env.EDGE ?? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const browser = await puppeteer.launch({ executablePath: EDGE, headless: 'new', userDataDir: mkdtempSync(join(tmpdir(), 'hain-sm-')), args: ['--no-first-run'] })
const page = await browser.newPage()
const errors = new Set()
page.on('pageerror', (e) => errors.add(`pageerror: ${e.message}`))
page.on('console', (m) => {
  if ((m.type() === 'error' || m.type() === 'warn') && !/favicon|404|Download the React/.test(m.text())) errors.add(`${m.type()}: ${m.text().slice(0, 200)}`)
})
await page.emulate({ viewport: { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1' })
await page.goto(`${BASE}/?demo`, { waitUntil: 'networkidle0' })
await sleep(800)

// Extremfälle in die Daten
await page.evaluate(async () => {
  const { db } = await import('/src/db/schema.ts')
  const pad = (n) => String(n).padStart(2, '0')
  const d = new Date()
  const t = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  const long = 'Donaudampfschifffahrtsgesellschaftskapitänsmützenabzeichenhersteller'.repeat(2)
  const base = { scope: 'tag', date: t, done: false, deleted: false, createdAt: 1, updatedAt: 1, reminders: [] }
  await db.todos.bulkPut([
    { ...base, id: 'x1', title: long },
    { ...base, id: 'x2', title: '🌿'.repeat(60) },
    { ...base, id: 'x3', title: '<b>nicht fett</b> & "Zeichen" \'', reminders: [`${t}T23:59`, `${t}T23:58`, `${t}T23:57`, `${t}T23:56`, `${t}T23:55`] },
    { ...base, id: 'x4', title: 'Mit Reihe', repeat: { rule: 'zweiwoechentlich', from: t, reminders: [] } },
    { ...base, id: 'x5', title: 'Jährlich', repeat: { rule: 'jaehrlich', from: t, reminders: [] } },
  ])
  const h = await db.habits.get('demo-1')
  await db.habits.put({ ...h, id: 'x-h', name: long, emoji: '👨‍👩‍👧‍👦', order: 99 })
})

const routes = ['#/', '#/todos', '#/garten', '#/erfolge', '#/einstellungen', '#/rueckblick', '#/habit/demo-1', '#/habit/demo-8', '#/habit/x-h', '#/neu', '#/habit/demo-1/bearbeiten']
const problems = []
for (const scheme of ['dark', 'light']) {
  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: scheme }])
  for (const width of [320, 375, 430]) {
    await page.setViewport({ width, height: 800, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
    for (const r of routes) {
      await page.goto(`${BASE}/${r}`, { waitUntil: 'networkidle0' })
      await sleep(450)
      const res = await page.evaluate(() => {
        const vw = document.documentElement.clientWidth
        const over = document.documentElement.scrollWidth - vw
        // sichtbare Elemente, die seitlich aus dem Bild ragen (Tiere und Himmel dürfen das)
        const wide = []
        for (const el of document.querySelectorAll('main *, header *, nav *, [role=dialog] *')) {
          if (el.closest('svg') || el.closest('.garden-scene .sway')) continue
          const b = el.getBoundingClientRect()
          if (b.width === 0 || b.height === 0) continue
          if (b.right > vw + 1 || b.left < -1) wide.push(`${el.tagName.toLowerCase()}.${String(el.className).slice(0, 40)} [${Math.round(b.left)}…${Math.round(b.right)}]`)
        }
        const small = []
        for (const el of document.querySelectorAll('main button, header button, nav button')) {
          const b = el.getBoundingClientRect()
          if (b.width && (b.height < 30 || b.width < 30)) small.push(`${(el.getAttribute('aria-label') ?? el.textContent).slice(0, 24)} ${Math.round(b.width)}×${Math.round(b.height)}`)
        }
        return { over, wide: wide.slice(0, 4), small: small.slice(0, 4) }
      })
      if (res.over > 0) problems.push(`${scheme} ${width} ${r}: Seite ${res.over}px zu breit`)
      if (res.wide.length) problems.push(`${scheme} ${width} ${r}: ragt heraus: ${res.wide.join(' | ')}`)
      if (res.small.length && width === 375 && scheme === 'dark') problems.push(`${r}: kleine Knöpfe: ${res.small.join(' | ')}`)
    }
  }
}
console.log(problems.length ? problems.join('\n') : 'Kein Überlauf')
await page.setViewport({ width: 375, height: 800, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
for (const scheme of ['light']) {
  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: scheme }])
  for (const [name, r] of [['s-heute', '#/'], ['s-todos', '#/todos'], ['s-rueck', '#/rueckblick'], ['s-garten', '#/garten'], ['s-detail', '#/habit/demo-1']]) {
    await page.goto(`${BASE}/${r}`, { waitUntil: 'networkidle0' })
    await sleep(500)
    await page.screenshot({ path: join(OUT, `${name}.png`) })
  }
}
console.log(errors.size ? `Meldungen:\n${[...errors].join('\n')}` : 'Keine Browser-Meldungen')
await browser.close()
