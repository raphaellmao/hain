// Schatten-Ich im Labor fotografieren (alle Szenarien, groß)
import puppeteer from 'puppeteer-core'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const OUT = new URL('./bilder/', import.meta.url).pathname.replace(/^\/(\w:)/, '$1')
;(await import('node:fs')).mkdirSync(OUT, { recursive: true })
const EDGE = process.env.EDGE ?? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const tag = process.env.TAG ?? 'vorher'
const browser = await puppeteer.launch({ executablePath: EDGE, headless: 'new', userDataDir: mkdtempSync(join(tmpdir(), 'hain-sh-')), args: ['--no-first-run'] })
const page = await browser.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
for (const scheme of ['dark', 'light']) {
  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: scheme }])
  await page.setViewport({ width: 1240, height: 600, deviceScaleFactor: 1 })
  await page.goto(`http://localhost:5173/baumlabor.html?schatten&size=${process.env.SIZE ?? 240}&color=${process.env.COLOR ?? 'blau'}`, { waitUntil: 'networkidle0' })
  await sleep(1800)
  await page.screenshot({ path: join(OUT, `sh-${tag}-${scheme}.png`), fullPage: true })
}
console.log(errors.length ? errors.join('\n') : 'ok')
await browser.close()
