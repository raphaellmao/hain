/**
 * Arten, die auf dem rekursiven Baum aufbauen – nur die Parameter unterscheiden sich.
 */
import { recursiveTree, segmentOn } from './recursive'
import { appleFruit, appleShine, appleStem, birchLeaf, catkin, cherryFlower, flowerPath, leafPath, roundLeaf } from '../shapes'
import type { PlantModel, RawBranch } from '../model'

/** Laubbaum: der ursprüngliche Baum (bestehende Habits sehen unverändert aus) */
export const laubbaum = (seed: number): PlantModel =>
  recursiveTree(seed, {
    spread: [0.4, 0.64],
    ratio: [0.72, 0.8],
    upright: [0.06, 0.2],
    lean: [-0.12, 0.12],
    trunkLen: [40, 50],
    trunkWidth: [8.5, 11],
    leafSize: [12.5, 15],
    blossom: { count: 48, early: 6, size: [3.4, 4.6], shape: flowerPath, center: { f: 0.32, tone: 'yellow' } },
  })

/** Kirschbaum: kurzer Stamm, weit ausladende Krone, dichte Blütenbüschel */
export const kirsche = (seed: number): PlantModel =>
  recursiveTree(seed, {
    spread: [0.62, 0.8],
    ratio: [0.7, 0.77],
    upright: [0, 0.07],
    lean: [-0.2, 0.2],
    trunkLen: [32, 40],
    trunkWidth: [9, 11.5],
    leafSize: [9.5, 11.5],
    leafShape: leafPath,
    thirdChild: [0.6, 0.3],
    maxAngle: 1.85,
    blossom: {
      count: 36,
      cluster: 2,
      early: 9,
      earlyFrom: 4,
      size: [3.3, 4.3],
      shape: cherryFlower,
      center: { f: 0.24, tone: 'pale' },
    },
  })

/** Apfelbaum: runde, dichte Krone; statt Blüten reifen Äpfel in der Habit-Farbe */
export const apfel = (seed: number): PlantModel =>
  recursiveTree(seed, {
    spread: [0.45, 0.6],
    ratio: [0.72, 0.78],
    upright: [0.12, 0.22],
    lean: [-0.08, 0.08],
    trunkLen: [36, 44],
    trunkWidth: [9.5, 12],
    leafSize: [11, 13],
    leafShape: roundLeaf,
    blossom: {
      count: 30,
      early: 4,
      earlyFrom: 5,
      size: [4.6, 5.8],
      hanging: true,
      shape: (s) => appleFruit(s),
      shine: appleShine,
      lines: (s) => appleStem(s),
    },
  })

/** Birke: schlanker weißer Stamm mit dunklen Streifen, kleine Blätter, hängende Kätzchen */
export const birke = (seed: number): PlantModel =>
  recursiveTree(seed, {
    spread: [0.3, 0.42],
    ratio: [0.71, 0.77],
    upright: [0.18, 0.28],
    lean: [-0.06, 0.06],
    trunkLen: [56, 64],
    trunkWidth: [6.5, 8],
    leafSize: [10, 12],
    leafShape: birchLeaf,
    branchTone: (depth) => (depth <= 1 ? 'birch' : 'twig'),
    blossom: { count: 30, early: 4, size: [7, 10], hanging: true, shape: catkin },
    extras: ({ branches, r }) => {
      // dunkle Querstreifen auf Stamm und Hauptästen
      const marks: RawBranch[] = []
      for (const b of branches) {
        if (b.depth > 1) continue
        const n = b.depth === 0 ? 9 : 3
        for (let i = 0; i < n; i++) {
          const t = r(0.08, 0.95)
          const len = b.width * r(0.45, 0.8)
          const s = segmentOn(b, t, 1, 90 + r(-15, 15))
          const ux = s.x2 - s.x // Einheitsvektor quer zum Ast
          const uy = s.y2 - s.y
          // Streifen beginnt am Rand des Stamms und reicht ein Stück hinein
          const ax = s.x - ux * b.width * 0.5
          const ay = s.y - uy * b.width * 0.5
          const ex = ax + ux * len
          const ey = ay + uy * len
          marks.push({
            pts: [ax, ay, (ax + ex) / 2, (ay + ey) / 2, ex, ey],
            width: r(1.1, 1.9),
            depth: b.depth,
            start: b.start + b.span * t,
            span: 0.05,
            tone: 'mark',
          })
        }
      }
      branches.push(...marks)
    },
  })
