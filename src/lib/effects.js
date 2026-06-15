let audioCtx = null
function ctx() {
  if (!audioCtx) { const AC = window.AudioContext || window.webkitAudioContext; audioCtx = new AC() }
  return audioCtx
}

export function playChime(volume = 1) {
  try {
    const c = ctx(); const now = c.currentTime
    ;[880, 1320, 1760].forEach((freq, i) => {
      const osc = c.createOscillator(); const gain = c.createGain()
      osc.type = 'sine'; osc.frequency.value = freq
      const t = now + i * 0.12; const v = Math.max(0, Math.min(1, volume)) * 0.22
      gain.gain.setValueAtTime(0, t)
      gain.gain.linearRampToValueAtTime(v, t + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.5)
      osc.connect(gain); gain.connect(c.destination)
      osc.start(t); osc.stop(t + 0.5)
    })
  } catch {}
}

export function burstConfetti() {
  const colors = ['#2E7D52', '#4CAF76', '#E07240', '#F5F1EB', '#F0B429']
  const container = document.createElement('div')
  container.className = 'confetti-layer'
  document.body.appendChild(container)
  for (let i = 0; i < 80; i++) {
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
