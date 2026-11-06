import { useMemo } from 'react'
import { encode } from 'uqr'

/** QR-Code als SVG: dunkle Felder auf weißem Grund – so lesen ihn alle Kameras, auch im Dunkelmodus. */
export default function QrCode({ text, className }: { text: string; className?: string }) {
  const { d, size } = useMemo(() => {
    const { data } = encode(text, { ecc: 'M', border: 2 })
    // Felder einer Zeile, die nebeneinander liegen, als ein Rechteck
    let path = ''
    data.forEach((row, y) => {
      for (let x = 0; x < row.length; ) {
        if (!row[x]) {
          x++
          continue
        }
        let w = 1
        while (row[x + w]) w++
        path += `M${x} ${y}h${w}v1h${-w}z`
        x += w
      }
    })
    return { d: path, size: data.length }
  }, [text])

  return (
    <svg viewBox={`0 0 ${size} ${size}`} shapeRendering="crispEdges" role="img" aria-label={`QR-Code für ${text}`} className={className}>
      <rect width={size} height={size} fill="#ffffff" />
      <path d={d} fill="#111111" />
    </svg>
  )
}
