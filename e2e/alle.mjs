// Alle Oberflächen-Tests nacheinander gegen den laufenden Entwicklungsserver (npm run dev).
// Aufruf: npm run e2e  ·  einzelne Reihe: node e2e/mood-e2e.mjs
// Edge-Pfad mit EDGE=…, andere Adresse mit BASE=… überschreibbar. Unter Windows aus der
// PowerShell starten (aus Git Bash beendet sich headless Edge sofort).
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const dir = dirname(fileURLToPath(import.meta.url))
const SUITES = [
  'todos-e2e', 'overlay-e2e', 'repeat-e2e', 'goal-e2e', 'absence-e2e', 'archive-e2e', 'mood-e2e', 'share-e2e',
  'routine-e2e', 'missed-e2e', 'plants-e2e', 'deko-e2e', 'herbarium-e2e', 'smoke',
]
const BASE = process.env.BASE ?? 'http://localhost:5173'
try {
  await fetch(BASE)
} catch {
  console.log(`Der Entwicklungsserver unter ${BASE} läuft nicht – zuerst „npm run dev“ starten.`)
  process.exit(1)
}

const only = process.argv.slice(2)
const results = []
for (const name of only.length ? only : SUITES) {
  const t = Date.now()
  const r = spawnSync(process.execPath, [join(dir, `${name}.mjs`)], { encoding: 'utf8', env: process.env })
  const out = `${r.stdout ?? ''}${r.stderr ?? ''}`
  const failed = out.split('\n').filter((l) => /^FAIL|Error/.test(l))
  const ok = r.status === 0 && (/ALLES OK|Kein Überlauf|Keine Browser-Meldungen/.test(out) || name === 'smoke')
  results.push({ name, ok, s: Math.round((Date.now() - t) / 1000) })
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${name} (${results.at(-1).s} s)`)
  if (!ok) console.log(failed.slice(0, 8).map((l) => `     ${l}`).join('\n'))
}
const bad = results.filter((r) => !r.ok)
console.log(bad.length ? `\n${bad.length} von ${results.length} Reihen mit Fehlern` : `\nAlle ${results.length} Reihen in Ordnung`)
process.exit(bad.length ? 1 : 0)
