import { motion } from 'motion/react'

/**
 * Sprechblase deines Schattens – erscheint mit kurzer Verzögerung, als würde
 * er erst Luft holen. Wechselt der Text, taucht sie neu auf.
 */
export function ShadowTaunt({ text }: { text: string }) {
  return (
    <motion.figure
      key={text}
      initial={{ opacity: 0, y: 8, scale: 0.94 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay: 0.5, duration: 0.55, ease: 'easeOut' }}
      className="taunt absolute top-1 right-0 z-10 max-w-[64%] rounded-2xl rounded-br-[4px] border border-[#7b2cbf]/60 bg-[#12081a]/92 px-3 py-2 text-[#f2e8ff] shadow-[0_0_22px_rgba(140,60,200,0.4)]"
    >
      <figcaption className="mb-0.5 text-[10px] font-bold tracking-[0.12em] text-[#ff5a4a] uppercase">Dein Schatten</figcaption>
      <blockquote className="text-[14px] leading-snug italic">„{text}“</blockquote>
    </motion.figure>
  )
}
