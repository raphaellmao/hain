import { createPortal } from 'react-dom'
import { motion } from 'motion/react'
import { IconPlus } from './icons'

/**
 * Runder „+“-Knopf unten rechts – dort, wo der rechte Daumen ist. Liegt direkt
 * im body, damit er beim Wischen zwischen den Ansichten nicht mitfährt.
 */
export function Fab({ onClick, label = 'Neue Gewohnheit' }: { onClick: () => void; label?: string }) {
  return createPortal(
    <motion.button
      type="button"
      onClick={onClick}
      whileTap={{ scale: 0.9 }}
      aria-label={label}
      className="fixed right-4 bottom-nav z-10 mb-4 flex size-14 items-center justify-center rounded-full bg-accent text-accent-ink shadow-lg"
    >
      <IconPlus width={26} height={26} />
    </motion.button>,
    document.body,
  )
}
