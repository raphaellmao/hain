// Baumlabor: neue Arten in allen Stufen fotografieren (hell und dunkel)
import puppeteer from 'puppeteer-core'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const OUT = new URL('./bilder/', import.meta.url).pathname.replace(/^\/(\w:)/, '$1')
;(await import('node:fs')).mkdirSync(OUT, { recursive: true })
const EDGE = process.env.EDGE ?? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const species = (process.env.ARTEN ?? 'olive,ahorn,palme,kristall,lumenpilz,orbital,neonfarn').split(',')
const scheme = process.env.SCHEME ?? 'dark'

const browser = await puppeteer.launch({ executablePath: EDGE, headless: 'new', userDataDir: mkdtempSync(join(tmpdir(), 'hain-lab-')), args: ['--no-first-run'] })
const page = await browser.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: scheme }])
await page.setViewport({ width: 1180, height: 400, deviceScaleFactor: 1 })
for (const s of species) {
  await page.goto(`http://localhost:5173/baumlabor.html?species=${s}&seeds=11,77&size=105&color=${process.env.COLOR ?? 'flieder'}`, { waitUntil: 'networkidle0' })
  await sleep(700)
  await page.screenshot({ path: join(OUT, `lab-${s}-${scheme}.png`), fullPage: true })
}
console.log(errors.length ? errors.join('\n') : 'ok')
await browser.close()
