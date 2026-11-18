// Fertiger Build (vite preview oder live): Vorlage → Gewohnheit, QR-Code, Gartenbild – nur über die Oberfläche
import puppeteer from 'puppeteer-core'
import jsQR from 'jsqr'
import { PNG } from 'pngjs'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const APP = process.env.APP ?? 'http://localhost:4173/hain/'
const EDGE = process.env.EDGE ?? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let fails = 0
const check = (name, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${name}${extra ? ` – ${extra}` : ''}`)
}
const browser = await puppeteer.launch({ executablePath: EDGE, headless: 'new', userDataDir: mkdtempSync(join(tmpdir(), 'hain-sp-')), args: ['--no-first-run'] })
const page = await browser.newPage()
await page.emulate({ viewport: { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36' })
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
page.on('console', (m) => m.type() === 'error' && !/favicon/.test(m.text()) && errors.push(m.text()))
const tap = async (selector, text) => {
  const ok = await page.evaluate((s, t) => {
    const el = [...document.querySelectorAll(s)].find((e) => e.textContent.trim().includes(t))
    el?.click()
    return !!el
  }, selector, text)
  if (!ok) throw new Error(`nicht gefunden: ${text}`)
  await sleep(400)
}

await page.goto(APP, { waitUntil: 'networkidle0' })
await sleep(800)
await tap('button', 'Lesen')
check('Vorlage „Lesen“ öffnet das Formular', (await page.evaluate(() => location.hash)) === '#/neu/lesen')
await tap('button', 'Pflanzen')
await sleep(600)
const row = await page.evaluate(() => document.querySelector('main')?.innerText.includes('Lesen'))
check('Gewohnheit steht auf „Heute“', row)

await page.goto(`${APP}#/einstellungen`, { waitUntil: 'networkidle0' })
await sleep(500)
await tap('button', 'Hain weitergeben')
const qr = await page.waitForSelector('[role=dialog] svg[role=img]', { timeout: 10000 }).catch(() => null)
const png = qr && PNG.sync.read(await qr.screenshot({ type: 'png' }))
const decoded = png && jsQR(new Uint8ClampedArray(png.data), png.width, png.height)
check('QR-Code führt zur App', decoded?.data === APP, decoded?.data)
await page.keyboard.press('Escape')
await sleep(500)

await page.goto(`${APP}#/garten`, { waitUntil: 'networkidle0' })
await sleep(600)
await page.evaluate(() => document.querySelector('button[aria-label="Garten als Bild teilen"]').click())
let size = null
for (let i = 0; i < 60 && !size; i++) {
  await sleep(250)
  size = await page.evaluate(() => {
    const img = document.querySelector('[role=dialog] img')
    return img?.complete && img.naturalWidth ? `${img.naturalWidth}×${img.naturalHeight}` : null
  })
}
check('Gartenbild entsteht', size === '1080×1350', size)
check('Keine Fehler', errors.length === 0, errors.join(' / '))
await browser.close()
console.log(fails ? `${fails} FEHLER` : 'ALLES OK')
process.exit(fails ? 1 : 0)
