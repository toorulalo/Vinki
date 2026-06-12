// --- Audio con proximidad ---
// El volumen depende de qué tan "cerca" está el embed del centro de la vista.

let audioCtx = null
function ctx() {
  if (!audioCtx) {
    const AC = window.AudioContext || window.webkitAudioContext
    audioCtx = new AC()
  }
  return audioCtx
}

/**
 * Reproduce un sonidito de "logro" (campanita) con volumen relativo (0..1).
 * No depende de archivos externos: se genera con osciladores.
 */
export function playChime(volume = 1) {
  try {
    const c = ctx()
    const now = c.currentTime
    const notes = [880, 1320, 1760]
    notes.forEach((freq, i) => {
      const osc = c.createOscillator()
      const gain = c.createGain()
      osc.type = 'sine'
      osc.frequency.value = freq
      const t = now + i * 0.12
      const v = Math.max(0, Math.min(1, volume)) * 0.25
      gain.gain.setValueAtTime(0, t)
      gain.gain.linearRampToValueAtTime(v, t + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.5)
      osc.connect(gain)
      gain.connect(c.destination)
      osc.start(t)
      osc.stop(t + 0.5)
    })
  } catch {
    // audio no disponible: ignorar
  }
}

/**
 * Calcula un volumen 0..1 según la distancia (en px de pantalla) entre el
 * embed y el centro de la vista. Cerca = 1, lejos = 0.
 */
export function proximityVolume(distancePx, maxDist = 700) {
  return Math.max(0, 1 - distancePx / maxDist)
}

// --- Confetti (sin librerías) ---
export function burstConfetti() {
  const colors = ['#e8623d', '#ffe9a8', '#cfe8f0', '#f6d6d6', '#4a3b22']
  const container = document.createElement('div')
  container.className = 'confetti-layer'
  document.body.appendChild(container)

  const count = 80
  for (let i = 0; i < count; i++) {
    const piece = document.createElement('span')
    piece.className = 'confetti-piece'
    piece.style.left = Math.random() * 100 + 'vw'
    piece.style.background = colors[i % colors.length]
    piece.style.animationDelay = Math.random() * 0.3 + 's'
    piece.style.transform = `rotate(${Math.random() * 360}deg)`
    container.appendChild(piece)
  }

  setTimeout(() => container.remove(), 2600)
}
