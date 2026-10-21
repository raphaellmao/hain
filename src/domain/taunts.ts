/**
 * Was dein Schatten-Ich zu dir sagt. Die Auswahl hängt von der Lage im Kampf
 * ab und wechselt einmal am Tag (fest je Habit und Datum – kein Flackern beim
 * Neuzeichnen). Hast du heute schon erledigt oder ausgesetzt, reagiert er darauf.
 */
import type { DateStr } from './dates'

/** Je Lage (Index in TERRITORY_STATUS: 0 = Er herrscht … 4 = Dein Land) */
const BY_STATUS: string[][] = [
  [
    'Das hier ist jetzt mein Land.',
    'Du hast aufgehört. Ich nicht.',
    'Jeder Tag ohne dich macht mich stärker.',
    'Erinnerst du dich, wer du sein wolltest? Ich schon.',
    'Bequem, oder? Bleib einfach liegen.',
  ],
  [
    'Noch ein Tag, und die Grenze gehört mir.',
    'Ich spüre, wie du nachgibst.',
    'Morgen hast du wieder eine Ausrede. Ich warte.',
    'Du wirst müde. Ich nicht.',
    'Schritt für Schritt hole ich mir alles.',
  ],
  [
    'Wir sind gleich stark. Wie lange noch?',
    'Ein schwacher Tag genügt mir.',
    'Ich bin du – nur ohne Ausreden.',
    'Ich kenne jede deiner Ausreden.',
    'Wer zuerst nachgibt, verliert. Rate, wer das sein wird.',
  ],
  [
    'Genieß es. Ich bin geduldig.',
    'Ein verpasster Tag, und ich bin zurück.',
    'Du hältst dich für stark? Wir werden sehen.',
    'Ich zähle die Tage, bis du schwach wirst.',
  ],
  [
    '… ich warte im Schatten.',
    'Irgendwann wirst du müde.',
    'Du hast gewonnen. Für heute.',
    'Ich bin nie ganz weg. Vergiss das nicht.',
  ],
]

const AFTER_MISS = [
  'Gestern warst du schwach. Ich habe es gespürt.',
  'Schon wieder nicht? Danke für das Land.',
  'Jeder ausgelassene Tag schmeckt mir.',
]
const AFTER_DONE = ['Hmpf. Morgen wieder.', 'Ein Tag beweist gar nichts.', 'Das war knapp. Für dich.', 'Ich weiche nur zurück. Ich gehe nicht.']
const AFTER_EXCUSE = ['Ausreden. Ich zähle mit.', 'Heute lasse ich dich. Morgen nicht.', 'Krank, Dienst, unterwegs … ich kenne sie alle.']

/** kleiner, stabiler Hash (FNV-1a) */
function hash(s: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

export function shadowTaunt(o: {
  habitId: string
  today: DateStr
  status: number
  missRun: number
  doneToday: boolean
  excusedToday: boolean
}): string {
  let list: string[]
  if (o.excusedToday) list = AFTER_EXCUSE
  else if (o.doneToday) list = o.status >= 4 ? BY_STATUS[4] : AFTER_DONE
  else if (o.missRun > 0 && o.status <= 2) list = AFTER_MISS
  else list = BY_STATUS[Math.max(0, Math.min(4, o.status))]
  return list[hash(`${o.habitId}|${o.today}|${list.length}`) % list.length]
}
