import { useState, useEffect, useRef, useCallback } from 'react'
import { playChime, unlockAudio } from '../../lib/effects'

const DEFAULT_DURATION = 25 * 60 // 25 minutes in seconds

function formatTime(secs) {
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

// Progress ring SVG component
function ProgressRing({ progress, size = 64, strokeWidth = 4 }) {
  const r      = (size - strokeWidth) / 2
  const circum = 2 * Math.PI * r
  const offset = circum * (1 - progress)

  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      {/* Background track */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="var(--border)"
        strokeWidth={strokeWidth}
      />
      {/* Progress arc */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="var(--color-accent)"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circum}
        strokeDashoffset={offset}
        style={{ transition: 'stroke-dashoffset 0.5s linear' }}
      />
    </svg>
  )
}

export default function TimerCard({ card, isEditing, onUpdate }) {
  const duration = card.content?.duration ?? DEFAULT_DURATION
  const label    = card.content?.label    ?? 'Estudio'

  const [remaining,  setRemaining]  = useState(duration)
  const [running,    setRunning]    = useState(false)
  const [editLabel,  setEditLabel]  = useState(label)
  const [editMins,   setEditMins]   = useState(Math.floor(duration / 60))
  const intervalRef = useRef(null)

  // Reset timer when duration setting changes
  useEffect(() => {
    setRemaining(duration)
    setRunning(false)
    clearInterval(intervalRef.current)
  }, [duration])

  // Sync label state with card content
  useEffect(() => {
    setEditLabel(card.content?.label ?? 'Estudio')
    setEditMins(Math.floor((card.content?.duration ?? DEFAULT_DURATION) / 60))
  }, [card.content?.label, card.content?.duration])

  // Countdown tick
  useEffect(() => {
    if (!running) return
    intervalRef.current = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(intervalRef.current)
          setRunning(false)
          playChime()
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(intervalRef.current)
  }, [running])

  function togglePlay() {
    unlockAudio() // user gesture — lets the completion chime play later
    if (remaining === 0) {
      // Reset and start
      setRemaining(duration)
      setRunning(true)
    } else {
      setRunning((r) => !r)
    }
  }

  function reset() {
    clearInterval(intervalRef.current)
    setRunning(false)
    setRemaining(duration)
  }

  function saveDuration() {
    const mins    = Math.max(1, Math.min(180, parseInt(editMins) || 25))
    const newSecs = mins * 60
    setEditMins(mins)
    onUpdate?.({ content: { ...card.content, duration: newSecs, label: editLabel } })
    // Also reset the timer to new duration
    setRemaining(newSecs)
    setRunning(false)
  }

  function saveLabel() {
    onUpdate?.({ content: { ...card.content, label: editLabel } })
  }

  const progress = duration > 0 ? remaining / duration : 0
  const done     = remaining === 0

  // Compact shared timer UI (used in both preview and edit modes)
  const TimerDisplay = (
    <div className="timer-preview" style={{ gap: 12 }}>
      {/* Ring + time overlay */}
      <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
        <ProgressRing progress={progress} size={isEditing ? 80 : 64} />
        <span
          className="timer-preview-time"
          style={{
            position: 'absolute',
            fontSize: isEditing ? '1.1rem' : '0.9rem',
          }}
        >
          {formatTime(remaining)}
        </span>
      </div>

      <span className="timer-preview-label">{label}</span>

      {/* Controls */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          style={{ minWidth: 64 }}
          onClick={(e) => { e.stopPropagation(); togglePlay() }}
          aria-label={done ? 'Reiniciar' : running ? 'Pausar' : 'Iniciar'}
        >
          {done ? '↺ Reset' : running ? '⏸ Pausar' : '▶ Iniciar'}
        </button>

        {!done && (
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={(e) => { e.stopPropagation(); reset() }}
            aria-label="Reiniciar"
          >
            ↺
          </button>
        )}
      </div>
    </div>
  )

  if (isEditing) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {TimerDisplay}

        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="field">
            <label className="field-label">Etiqueta del temporizador</label>
            <input
              className="field-input"
              type="text"
              value={editLabel}
              placeholder="Ej: Estudio, Descanso..."
              maxLength={30}
              onChange={(e) => setEditLabel(e.target.value)}
              onBlur={saveLabel}
            />
          </div>

          <div className="field">
            <label className="field-label">Duración (minutos)</label>
            <input
              className="field-input"
              type="number"
              min={1}
              max={180}
              value={editMins}
              onChange={(e) => setEditMins(e.target.value)}
              onBlur={saveDuration}
            />
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {[5, 10, 15, 25, 45, 60].map((m) => (
              <button
                key={m}
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  setEditMins(m)
                  onUpdate?.({ content: { ...card.content, duration: m * 60, label: editLabel } })
                  setRemaining(m * 60)
                  setRunning(false)
                }}
              >
                {m} min
              </button>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return TimerDisplay
}
