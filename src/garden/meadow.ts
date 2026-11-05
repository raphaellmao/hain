/**
 * Die Wiese als Kachelbild: Gras, Blumen, Laub oder Schnee werden einmal als SVG
 * erzeugt und vom Browser nur noch wiederholt. Das kostet beim Scrollen nichts,
 * egal wie lang der Garten wird. Zwei Kacheln mit verschiedenen Größen sorgen
 * dafür, dass man das Muster nicht wiedererkennt.
 */
import { mix, rnd, type ScenePalette } from './palette'

const svgUrl = (size: number, body: string) =>
  `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='${size}' height='${size}' viewBox='0 0 ${size} ${size}'>${body}</svg>`)}")`

const num = (v: number) => v.toFixed(1)

/** Ein Grasbüschel als Pfadstück: wenige gebogene Halme */
export function tuft(x: number, y: number, h: number, salt: number, blades = 3): string {
  let d = ''
  for (let i = 0; i < blades; i++) {
    const lean = (rnd(i, salt) - 0.5) * h * 0.9
    const height = h * (0.65 + rnd(i, salt + 1) * 0.5)
    const foot = x + (i - (blades - 1) / 2) * 1.4
    d += `M${num(foot)} ${num(y)}Q${num(foot + lean * 0.2)} ${num(y - height * 0.6)} ${num(foot + lean)} ${num(y - height)}`
  }
  return d
}

/** Weiche helle und dunkle Flecken: So sieht der Boden nicht mehr wie eine Fläche aus */
function patches(p: ScenePalette, size: number, salt: number): string {
  const winter = p.season === 'winter'
  const lightColor = winter ? '#ffffff' : p.blade[1]
  const darkColor = winter ? mix(p.meadow[1], '#7f9ac0', 0.5) : p.blade[0]
  const soft = (id: string, c: string, a: number) =>
    `<radialGradient id='${id}'><stop offset='0' stop-color='${c}' stop-opacity='${a}'/><stop offset='1' stop-color='${c}' stop-opacity='0'/></radialGradient>`
  let out = `<defs>${soft('l', lightColor, winter ? 0.5 : 0.3)}${soft('d', darkColor, winter ? 0.22 : 0.26)}</defs>`
  for (let i = 0; i < 18; i++) {
    const rx = 56 + rnd(i, salt) * 80
    const ry = rx * (0.34 + rnd(i, salt + 1) * 0.2)
    const margin = rx + 1
    const cx = margin + rnd(i, salt + 2) * Math.max(1, size - margin * 2)
    const cy = ry + 1 + rnd(i, salt + 3) * (size - ry * 2 - 2)
    out += `<ellipse cx='${num(cx)}' cy='${num(cy)}' rx='${num(rx)}' ry='${num(ry)}' fill='url(#${i % 2 === 0 ? 'l' : 'd'})'/>`
  }
  return out
}

function flower(x: number, y: number, color: string, centre: string, stem: string, size: number): string {
  const petals = [0, 72, 144, 216, 288]
    .map((a) => {
      const rad = (a * Math.PI) / 180
      return `<circle cx='${num(x + Math.cos(rad) * size)}' cy='${num(y - 5 + Math.sin(rad) * size)}' r='${num(size * 0.72)}' fill='${color}'/>`
    })
    .join('')
  return `<path d='M${num(x)} ${num(y)}L${num(x)} ${num(y - 5)}' stroke='${stem}' stroke-width='1' fill='none'/>${petals}<circle cx='${num(x)}' cy='${num(y - 5)}' r='${num(size * 0.6)}' fill='${centre}'/>`
}

function details(p: ScenePalette, size: number, salt: number): string {
  const winter = p.season === 'winter'
  const margin = 14
  const at = (i: number, s: number) => margin + rnd(i, salt + s) * (size - margin * 2)

  let dark = ''
  let light = ''
  const tufts = winter ? 16 : 62
  for (let i = 0; i < tufts; i++) {
    const h = 5 + rnd(i, salt + 3) * 7
    const d = tuft(at(i, 1), at(i, 2), h, salt + i)
    if (i % 3 === 0) light += d
    else dark += d
  }
  let out = `<path d='${dark}' stroke='${p.blade[0]}' stroke-width='1.1' stroke-linecap='round' fill='none' opacity='${winter ? 0.5 : 0.75}'/>`
  out += `<path d='${light}' stroke='${p.blade[1]}' stroke-width='1' stroke-linecap='round' fill='none' opacity='${winter ? 0.45 : 0.7}'/>`

  if (p.season === 'herbst') {
    // Laub am Boden
    for (let i = 0; i < 26; i++) {
      const c = p.flowers[i % p.flowers.length]
      out += `<ellipse cx='${num(at(i, 5))}' cy='${num(at(i, 6))}' rx='${num(2.2 + rnd(i, 7) * 1.8)}' ry='1.4' fill='${c}' opacity='0.72' transform='rotate(${Math.round(rnd(i, 8) * 180)} ${num(at(i, 5))} ${num(at(i, 6))})'/>`
    }
  } else if (winter) {
    // Schatten kleiner Schneewehen
    for (let i = 0; i < 12; i++) {
      out += `<path d='M${num(at(i, 5))} ${num(at(i, 6))}q14 -5 28 0' stroke='${mix(p.meadow[1], '#6f86a6', 0.45)}' stroke-width='1.4' stroke-linecap='round' fill='none' opacity='0.4'/>`
    }
  } else {
    const count = p.season === 'fruehling' ? 22 : 16
    for (let i = 0; i < count; i++) {
      const color = p.flowers[Math.floor(rnd(i, salt + 9) * p.flowers.length)]
      const centre = color === p.flowers[1] ? '#a8691e' : '#f3c33c'
      out += flower(at(i, 10), at(i, 11), color, centre, p.blade[0], 1 + rnd(i, 12) * 0.7)
    }
  }
  return out
}

const cache = new Map<string, { image: string; size: string }>()

/** Hintergrund der Wiese, passend zu Jahreszeit und Licht */
export function meadowBackground(p: ScenePalette, key: string): { image: string; size: string } {
  const hit = cache.get(key)
  if (hit) return hit
  const small = 310
  const large = 470
  const value = {
    image: [
      `radial-gradient(ellipse 130% 420px at 50% 290px, ${p.pool}, transparent)`,
      svgUrl(small, details(p, small, 3)),
      svgUrl(large, patches(p, large, 5)),
      `linear-gradient(to bottom, ${p.meadow[0]} 0, ${p.meadow[0]} 300px, ${p.meadow[1]} 100%)`,
    ].join(', '),
    size: `100% 100%, ${small}px ${small}px, ${large}px ${large}px, 100% 100%`,
  }
  cache.set(key, value)
  return value
}
