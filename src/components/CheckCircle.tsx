import { motion } from 'motion/react'

/** Runder Haken in Habit-Farbe. Der Haken „zeichnet“ sich beim Abhaken. */
export function CheckCircle({ done, color, size = 32 }: { done: boolean; color: string; size?: number }) {
  return (
    <motion.span
      className="relative inline-flex shrink-0 items-center justify-center rounded-full"
      style={{ width: size, height: size }}
      animate={{ scale: done ? [1, 1.18, 1] : 1 }}
      transition={{ duration: 0.35 }}
    >
      <span
        className="absolute inset-0 rounded-full border-2 transition-colors duration-200"
        style={{ borderColor: done ? color : 'var(--line)', background: done ? color : 'transparent' }}
      />
      <svg viewBox="0 0 24 24" className="relative" width={size * 0.62} height={size * 0.62} aria-hidden>
        <motion.path
          d="M5 12.5l4.5 4.5L19 7.5"
          fill="none"
          stroke="white"
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={false}
          animate={{ pathLength: done ? 1 : 0, opacity: done ? 1 : 0 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
        />
      </svg>
    </motion.span>
  )
}
