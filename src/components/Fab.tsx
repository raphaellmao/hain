import { motion } from 'motion/react'
import { IconPlus } from './icons'

/** Runder „+“-Knopf unten rechts – dort, wo der rechte Daumen ist. */
export function Fab({ onClick }: { onClick: () => void }) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileTap={{ scale: 0.9 }}
      aria-label="Neue Gewohnheit"
      className="fixed right-4 bottom-nav z-10 mb-4 flex size-14 items-center justify-center rounded-full bg-accent text-accent-ink shadow-lg"
    >
      <IconPlus width={26} height={26} />
    </motion.button>
  )
}
