// Feier in den Tag-Varianten (Blüten im Frühling, Laub im Herbst, Schnee im Winter) – Bildschirmfotos
import puppeteer from 'puppeteer-core'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const BASE = process.env.BASE ?? 'http://localhost:5173'
const OUT = new URL('./bilder/', import.meta.url).pathname.replace(/^\/(\w:)/, '$1')
;(await import('node:fs')).mkdirSync(OUT, { recursive: true })
const EDGE = process.env.EDGE ?? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const pad = (n) => String(n).padStart(2, '0')
const d = new Date(Date.now() - 2 * 86_400_000)
const start = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

for (const [saison, name] of [['fruehling', 'bluete'], ['herbst', 'laub'], ['winter', 'schnee']]) {
  const browser = await puppeteer.launch({ executablePath: EDGE, headless: 'new', userDataDir: mkdtempSync(join(tmpdir(), 'hain-fv-')), args: ['--no-first-run'] })
  const page = await browser.newPage()
  await page.emulate({ viewport: { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36' })
  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'light' }])
  await page.goto(`${BASE}/?zeit=tag&saison=${saison}`, { waitUntil: 'networkidle0' })
  await sleep(500)
  await page.evaluate(async (start) => {
    const m = await import('/src/db/repo.ts')
    await m.createHabit({ name: 'Liegestütze', emoji: '💪', color: 'rosa', days: [0, 1, 2, 3, 4, 5, 6], startDate: start, seed: 3, species: 'kirsche', metaphor: 'pflanze' })
  }, start)
  await sleep(700)
  await page.evaluate(() => [...document.querySelectorAll('main button[aria-pressed]')].find((b) => b.getAttribute('aria-label')?.startsWith('Liegestütze'))?.click())
  await sleep(1700)
  const v = await page.evaluate(() => document.querySelector('[data-celebration]')?.getAttribute('data-variant'))
  console.log(saison, '→', v)
  await page.screenshot({ path: join(OUT, `f-${name}.png`) })
  await browser.close()
}
