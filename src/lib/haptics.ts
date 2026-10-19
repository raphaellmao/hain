/**
 * Kurzes haptisches Feedback beim Abhaken.
 *
 * Android: offizielle Vibration-API.
 * iPhone: Safari kennt keine Vibration-API. Seit iOS 18 gibt es aber
 * Schalter-Checkboxen (<input type="checkbox" switch>), die beim Umschalten
 * ein kurzes „Tick“ der Taptic Engine auslösen. Wir schalten unsichtbar so
 * einen Schalter um. Das ist inoffiziell – fällt es mit einem iOS-Update weg,
 * bleibt einfach nur die Animation. Muss innerhalb einer Nutzer-Geste
 * (Tap-Handler) aufgerufen werden.
 */
export function tick(): void {
  try {
    if (typeof navigator.vibrate === 'function') {
      navigator.vibrate(10)
      return
    }
    iosSwitchTick()
  } catch {
    // Feedback ist Kür – Fehler hier dürfen nie das Abhaken stören.
  }
}

/** Etwas kräftiger, z. B. wenn der Baum eine Stufe aufsteigt. */
export function celebrate(): void {
  try {
    if (typeof navigator.vibrate === 'function') {
      navigator.vibrate([12, 60, 18])
      return
    }
    iosSwitchTick()
    window.setTimeout(iosSwitchTick, 90)
  } catch {
    /* siehe oben */
  }
}

function iosSwitchTick() {
  const label = document.createElement('label')
  label.ariaHidden = 'true'
  label.style.display = 'none'
  const input = document.createElement('input')
  input.type = 'checkbox'
  input.setAttribute('switch', '')
  label.appendChild(input)
  document.head.appendChild(label)
  label.click()
  label.remove()
}
