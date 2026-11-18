// Online-Version mit iPhone-Kennung, frisches Profil
import puppeteer from 'puppeteer-core'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const BASE = 'https://raphaellmao.github.io/hain/'
const EDGE = process.env.EDGE ?? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let fails = 0
const check = (name, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${name}${extra ? ` – ${extra}` : ''}`)
}

const browser = await puppeteer.launch({ executablePath: EDGE, headless: 'new', userDataDir: mkdtempSync(join(tmpdir(), 'hain-live-')), args: ['--no-first-run'] })
const page = await browser.newPage()
await page.emulate({ viewport: { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, userAgent: IPHONE })
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
const seen = []
page.on('response', (r) => {
  if (r.url().includes('/kalender/')) seen.push({ url: r.url(), status: r.status(), type: r.headers()['content-type'], nav: r.request().isNavigationRequest() })
})

await page.goto(BASE, { waitUntil: 'networkidle0' })
await page.evaluate(() => navigator.serviceWorker.ready)
await sleep(800)
await page.reload({ waitUntil: 'networkidle0' })
await sleep(500)
const sw = await page.evaluate(async () => ({
  controller: !!navigator.serviceWorker.controller,
  scope: (await navigator.serviceWorker.ready).scope,
  extra: (await fetch('sw-extra.js')).status,
  old: (await fetch('sw-notify.js')).status,
}))
check('Service Worker aktiv unter /hain/', sw.controller && sw.scope === BASE && sw.extra === 200, JSON.stringify(sw))

await page.evaluate(() => { location.hash = '#/todos' })
await sleep(500)
await page.evaluate(() => document.querySelector('button[aria-label="Neues To-do"]').click())
await sleep(400)
await page.type('form input[aria-label^="Was darfst"]', 'Test online')
await page.evaluate(() => {
  const i = document.querySelector('input[aria-label="Eigene Uhrzeit"]')
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(i, '23:58')
  i.dispatchEvent(new Event('input', { bubbles: true }))
})
await sleep(80)
await page.evaluate(() => [...document.querySelectorAll('form button')].find((b) => b.textContent.includes('+ Dazu')).click())
await sleep(80)
await page.evaluate(() => [...document.querySelectorAll('form button')].find((b) => b.textContent.includes('in den Kalender')).click())
await sleep(2000)
const nav = seen.find((s) => s.nav)
check('Aufruf unter /hain/kalender/ mit text/calendar', nav?.status === 200 && /^text\/calendar/.test(nav?.type ?? '') && nav.url.startsWith(`${BASE}kalender/`), JSON.stringify(nav))
check('Keine Fehler auf der Seite', errors.length === 0, errors.join(' | '))
console.log(fails ? `${fails} FEHLGESCHLAGEN` : 'ALLES OK')
await browser.close()
process.exit(fails ? 1 : 0)
