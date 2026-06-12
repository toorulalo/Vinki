import { useState, useEffect, useRef } from 'react'

// Metas progresivas (en minutos): cada una se desbloquea al alcanzar la anterior
const GOALS = [25, 60, 120]
const GOAL_LABELS = { 25: '25 min', 60: '1 hora', 120: '2 horas' }

function format(totalSec) {
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

/**
 * onComplete(goalMinutes) se llama al cruzar cada meta — el lienzo lo usa
 * para confetti + sonido con proximidad.
 */
export default function TimerEmbed({ card, onComplete }) {
  const elapsed = card.content?.elapsedSec || 0
  const [running, setRunning] = useState(false)
  const [sec, setSec] = useState(elapsed)
  const reachedRef = useRef(new Set(card.content?.reached || []))
  const tickRef = useRef(null)

  useEffect(() => {
    if (!running) {
      clearInterval(tickRef.current)
      return
    }
    tickRef.current = setInterval(() => {
      setSec((s) => {
        const next = s + 1
        // Revisar metas alcanzadas
        for (const g of GOALS) {
          if (next >= g * 60 && !reachedRef.current.has(g)) {
            reachedRef.current.add(g)
            onComplete?.(g, card)
          }
        }
        return next
      })
    }, 1000)
    return () => clearInterval(tickRef.current)
  }, [running])

  // Meta "actual" desbloqueada: la primera que aún no se alcanzó
  const currentGoal = GOALS.find((g) => sec < g * 60) || GOALS[GOALS.length - 1]
  const progress = Math.min(1, sec / (currentGoal * 60))

  function reset() {
    setRunning(false)
    setSec(0)
    reachedRef.current = new Set()
  }

  return (
    <div className="timer-embed">
      <div className="timer-ring" style={{ '--p': progress }}>
        <span className="timer-time">{format(sec)}</span>
      </div>

      <p className="timer-goal">
        Meta: <strong>{GOAL_LABELS[currentGoal]}</strong>
      </p>

      <div className="timer-steps">
        {GOALS.map((g) => (
          <span
            key={g}
            className={`timer-step${sec >= g * 60 ? ' done' : ''}`}
            title={GOAL_LABELS[g]}
          >
            {sec >= g * 60 ? '✓' : GOAL_LABELS[g]}
          </span>
        ))}
      </div>

      <div className="timer-controls">
        <button
          type="button"
          className="btn-pill"
          onClick={() => setRunning((r) => !r)}
        >
          {running ? 'Pausar' : 'Iniciar'}
        </button>
        <button
          type="button"
          className="btn-pill btn-pill-muted"
          onClick={reset}
        >
          Reiniciar
        </button>
      </div>
    </div>
  )
}
