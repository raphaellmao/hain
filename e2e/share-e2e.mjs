// Vorlagen, App weitergeben (QR) und Gartenbild über die echte Oberfläche, frisches Profil
import puppeteer from 'puppeteer-core'
import jsQR from 'jsqr'
import { PNG } from 'pngjs'
import { mkdtempSync, writeFileSync } from 'node:fs'
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

const browser = await puppeteer.launch({ executablePath: EDGE, headless: 'new', userDataDir: mkdtempSync(join(tmpdir(), 'hain-share-')), args: ['--no-first-run'] })
await browser.defaultBrowserContext().overridePermissions(BASE, ['clipboard-read', 'clipboard-write', 'clipboard-sanitized-write'])
const page = await browser.newPage()
await page.emulate({ viewport: { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36' })
const errors = []
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
page.on('console', (m) => {
  if (m.type() === 'error' && !/favicon|404/.test(m.text())) errors.push(`console: ${m.text()}`)
  if (m.type() === 'warning' && /Gartenbild/.test(m.text())) errors.push(`warn: ${m.text()}`)
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
  await sleep(300)
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
const pressed = () => page.evaluate(() => [...document.querySelectorAll('button[aria-pressed=true]')].map((b) => b.textContent.trim()))
const waitFor = async (fn, ms = 8000) => {
  const end = Date.now() + ms
  while (Date.now() < end) {
    const v = await page.evaluate(fn)
    if (v) return v
    await sleep(150)
  }
  return null
}

// ── Vorlagen auf dem leeren „Heute“ ─────────────────────────────────────────
await page.goto(`${BASE}/`, { waitUntil: 'networkidle0' })
await sleep(700)
const chips = await page.evaluate(() => [...document.querySelectorAll('main button, div button')].filter((b) => b.closest('.flex-wrap')).map((b) => b.textContent.trim()))
check('Leerer Start zeigt sechs Vorlagen', chips.length === 6 && chips[0].includes('Wasser trinken'), chips.join(', '))
await shot('v1-leer')
await tap('button', 'Wasser trinken')
await sleep(400)
check('Vorlage öffnet das Formular', (await page.evaluate(() => location.hash)) === '#/neu/wasser')
let form = await page.evaluate(() => ({ name: document.querySelector('input')?.value, menge: document.querySelector('input[inputmode=decimal]')?.value }))
check('Name vorausgefüllt', form.name === 'Wasser trinken', JSON.stringify(form))
let p = await pressed()
check('Vorlage, Ziel „Menge“ und Symbol markiert', p.some((t) => t.startsWith('💧Wasser trinken')) && p.includes('Menge') && p.includes('💧'), p.join(' | '))
await shot('v2-formular')
await tap('button', 'Pflanzen')
await sleep(600)
const water = await db((db) => db.habits.toArray())
check(
  'Gespeichert wie die Vorlage',
  water.length === 1 && water[0].name === 'Wasser trinken' && water[0].emoji === '💧' && water[0].color === 'tuerkis' && JSON.stringify(water[0].goal) === JSON.stringify({ kind: 'menge', target: 8, unit: 'Gläser', step: 1 }) && water[0].schedule[0].days.length === 7,
  JSON.stringify(water[0]),
)

// ── Vorlagen im Formular wechseln ───────────────────────────────────────────
await page.goto(`${BASE}/#/neu`, { waitUntil: 'networkidle0' })
await sleep(500)
await tap('button[aria-pressed]', 'Kein Social Media')
p = await pressed()
check('Lassen-Vorlage wählt das Schatten-Ich', p.includes('Schatten-Ich') && p.includes('Abhaken'), p.join(' | '))
await tap('button[aria-pressed]', 'Laufen')
p = await pressed()
const days = await page.evaluate(() => [...document.querySelectorAll('button[aria-pressed=true]')].map((b) => b.textContent.trim()).filter((t) => /^(Mo|Di|Mi|Do|Fr|Sa|So)$/.test(t)))
check('Wechsel zu „Laufen“: Pflanze, Dauer, Mo/Mi/Fr', p.includes('Wachsende Pflanze') && p.includes('Dauer') && days.join(',') === 'Mo,Mi,Fr', `${p.join(' | ')} / ${days}`)
const strip = await page.evaluate(() => {
  const s = document.querySelector('[aria-labelledby=vorlagen] .overflow-x-auto')
  return { scroll: s.scrollWidth > s.clientWidth, page: document.documentElement.scrollWidth > innerWidth }
})
check('Vorlagen wischbar, Seite nicht zu breit', strip.scroll && !strip.page, JSON.stringify(strip))
await page.evaluate(() => history.back())
await sleep(500)
check('Bearbeiten zeigt keine Vorlagen', await (async () => {
  await page.goto(`${BASE}/#/habit/${water[0].id}/bearbeiten`, { waitUntil: 'networkidle0' })
  await sleep(400)
  return page.evaluate(() => !document.querySelector('[aria-labelledby=vorlagen]'))
})())

// ── App weitergeben ────────────────────────────────────────────────────────
await page.goto(`${BASE}/#/einstellungen`, { waitUntil: 'networkidle0' })
await sleep(500)
await tap('button', 'Hain weitergeben')
await sleep(700)
const qr = await page.waitForSelector('[role=dialog] svg[role=img]', { timeout: 10000 }).catch(() => null)
check('Blatt mit QR-Code', !!qr)
const qrPng = PNG.sync.read(await qr.screenshot({ type: 'png' }))
const decoded = jsQR(new Uint8ClampedArray(qrPng.data), qrPng.width, qrPng.height)
check('QR-Code lässt sich lesen und führt zur App', decoded?.data === `${BASE}/`, decoded?.data)
await shot('v3-qr')
await tap('[role=dialog] button', 'Link kopieren')
await sleep(300)
const clip = await page.evaluate(() => navigator.clipboard.readText().catch(() => 'FEHLER'))
check('Link kopiert', clip === `${BASE}/`, clip)
await page.keyboard.press('Escape')
await sleep(500)

// ── Garten als Bild ────────────────────────────────────────────────────────
const imageInfo = async () => {
  const src = await waitFor(() => {
    const img = document.querySelector('[role=dialog] img')
    return img?.complete && img.naturalWidth ? img.src : null
  }, 15000)
  if (!src) return null
  return page.evaluate(async (src) => {
    const img = document.querySelector('[role=dialog] img')
    const blob = await (await fetch(src)).blob()
    const buf = new Uint8Array(await blob.arrayBuffer())
    let bin = ''
    for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000))
    return { src, w: img.naturalWidth, h: img.naturalHeight, type: blob.type, kb: Math.round(blob.size / 1024), b64: btoa(bin) }
  }, src)
}
await page.goto(`${BASE}/#/garten`, { waitUntil: 'networkidle0' })
await sleep(600)
await page.evaluate(() => document.querySelector('button[aria-label="Garten als Bild teilen"]').click())
let info = await imageInfo()
check('Gartenbild mit einer Pflanze: 1080 × 1350 PNG', info?.w === 1080 && info?.h === 1350 && info?.type === 'image/png', info && `${info.w}×${info.h} ${info.type} ${info.kb} KB`)
if (info) writeFileSync(join(OUT, 'v4-bild-eins.png'), Buffer.from(info.b64, 'base64'))
await shot('v5-blatt')
const before = info?.src
await page.evaluate(() => document.querySelector('[role=dialog] input[type=checkbox]').click())
await sleep(300)
info = await imageInfo()
check('Ohne Namen: neues Bild', info && info.src !== before, info?.src)
if (info) writeFileSync(join(OUT, 'v6-bild-ohne-namen.png'), Buffer.from(info.b64, 'base64'))
const save = await page.evaluate(() => {
  const a = [...document.querySelectorAll('[role=dialog] a[download]')].find((x) => x.textContent.includes('Bild sichern'))
  return a ? { download: a.getAttribute('download'), blob: a.href.startsWith('blob:') } : null
})
check('„Bild sichern“ lädt mein-hain.png', save?.download === 'mein-hain.png' && save.blob, JSON.stringify(save))
await page.keyboard.press('Escape')
await sleep(500)
check('Blatt zu, versteckte Zeichenfläche wieder weg', await page.evaluate(() => !document.querySelector('[role=dialog]') && ![...document.body.children].some((c) => c.style?.left === '-9999px')))

// Viele Pflanzen → hochkant
await page.evaluate(async () => {
  const m = await import('/src/dev/demo.ts')
  await m.hainDemo()
})
await sleep(800)
const count = await db((db) => db.habits.filter((h) => !h.deleted && !h.archived).count())
await page.goto(`${BASE}/#/garten`, { waitUntil: 'networkidle0' })
await sleep(600)
await page.evaluate(() => document.querySelector('button[aria-label="Garten als Bild teilen"]').click())
info = await imageInfo()
check(`Gartenbild mit ${count} Pflanzen: hochkant 1080 × 1920`, info?.w === 1080 && info?.h === 1920, info && `${info.w}×${info.h} ${info.kb} KB`)
if (info) writeFileSync(join(OUT, 'v7-bild-viele.png'), Buffer.from(info.b64, 'base64'))
await shot('v8-blatt-viele')

check('Keine Fehler in der Konsole', errors.length === 0, errors.join(' / '))
await browser.close()
console.log(fails ? `${fails} FEHLER` : 'ALLES OK')
process.exit(fails ? 1 : 0)
