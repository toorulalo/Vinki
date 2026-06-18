import { useState, useEffect } from 'react'
import { useFlashcards } from '../../lib/useDecks'
import { burstConfetti } from '../../lib/effects'

// Props: { deckId, onClose }
export default function ReviewSession({ deckId, onClose }) {
  const { dueCards, loading, recordResult } = useFlashcards(deckId)

  const [queue, setQueue]       = useState(null)
  const [currentIdx, setCurrentIdx] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const [score, setScore]       = useState({ pass: 0, fail: 0 })
  const [done, setDone]         = useState(false)

  useEffect(() => {
    if (!loading && queue === null) setQueue([...dueCards])
  }, [loading, dueCards, queue])

  const card  = queue ? queue[currentIdx] : null
  const total = queue?.length || 0

  async function handleResult(remembered) {
    if (!card) return
    await recordResult(card.id, remembered)
    const newScore = {
      pass: score.pass + (remembered ? 1 : 0),
      fail: score.fail + (remembered ? 0 : 1),
    }
    setScore(newScore)

    const nextIdx = currentIdx + 1
    if (nextIdx >= total) {
      setDone(true)
      if (newScore.pass > 0) setTimeout(() => burstConfetti(), 100)
    } else {
      setCurrentIdx(nextIdx)
      setRevealed(false)
    }
  }

  // Loading
  if (loading || queue === null) {
    return (
      <ReviewModal onClose={onClose}>
        <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
          <div className="spinner" />
        </div>
      </ReviewModal>
    )
  }

  // No due cards
  if (total === 0) {
    return (
      <ReviewModal onClose={onClose}>
        <div style={{ textAlign: 'center', padding: '48px 24px' }}>
          <p style={{ fontSize: 52, margin: '0 0 16px' }}>🎉</p>
          <p style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 'var(--text-2xl)', margin: '0 0 8px', color: 'var(--text-primary)' }}>
            ¡Al día!
          </p>
          <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)', margin: '0 0 24px' }}>
            No tienes tarjetas pendientes para hoy.
          </p>
          <button type="button" className="btn btn-primary" onClick={onClose}>Cerrar</button>
        </div>
      </ReviewModal>
    )
  }

  // Completion screen
  if (done) {
    const pct = Math.round((score.pass / total) * 100)
    const emoji = pct >= 80 ? '🏆' : pct >= 50 ? '👍' : '💪'
    return (
      <ReviewModal onClose={onClose}>
        <div style={{ textAlign: 'center', padding: '40px 24px' }}>
          <p style={{ fontSize: 56, margin: '0 0 16px', animation: 'bounce-in 0.45s var(--ease-spring) both' }}>{emoji}</p>
          <p style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 'var(--text-2xl)', margin: '0 0 6px', color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
            ¡Repaso completado!
          </p>
          <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)', margin: '0 0 24px' }}>
            Recordaste {score.pass} de {total} tarjetas
          </p>

          {/* Score breakdown */}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginBottom: 28 }}>
            <div style={{
              background: 'var(--color-primary-soft)',
              color: 'var(--color-primary)',
              padding: '10px 20px',
              borderRadius: 'var(--radius-md)',
              fontWeight: 600,
              fontSize: 'var(--text-sm)',
            }}>
              ✓ {score.pass} correctas
            </div>
            <div style={{
              background: 'rgba(194,58,58,.09)',
              color: 'var(--color-danger)',
              padding: '10px 20px',
              borderRadius: 'var(--radius-md)',
              fontWeight: 600,
              fontSize: 'var(--text-sm)',
            }}>
              ✗ {score.fail} falladas
            </div>
          </div>

          {/* Progress ring visual */}
          <div style={{ margin: '0 auto 28px', width: 88, height: 8, background: 'var(--bg-surface-3)', borderRadius: 99, overflow: 'hidden', border: '1px solid var(--border)' }}>
            <div style={{ height: '100%', width: `${pct}%`, background: 'var(--color-primary)', borderRadius: 99, transition: 'width 0.6s var(--ease-out)' }} />
          </div>

          <button type="button" className="btn btn-primary btn-full" onClick={onClose}>
            Cerrar
          </button>
        </div>
      </ReviewModal>
    )
  }

  const progressPct = Math.round((currentIdx / total) * 100)

  return (
    <ReviewModal onClose={onClose}>
      {/* Progress bar */}
      <div style={{ marginBottom: 8 }}>
        <div className="review-progress-bar">
          <div
            className="review-progress-fill"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', textAlign: 'right', margin: '4px 0 0' }}>
          {currentIdx + 1} / {total}
        </p>
      </div>

      {/* Flashcard */}
      <div
        className="review-card"
        style={{ cursor: revealed ? 'default' : 'pointer' }}
        onClick={() => !revealed && setRevealed(true)}
      >
        <p className="review-front">{card.front || '(anverso vacío)'}</p>

        {revealed ? (
          <p className="review-back">{card.back || '(reverso vacío)'}</p>
        ) : (
          <p className="review-tap-hint">Toca para ver la respuesta</p>
        )}
      </div>

      {/* Action buttons */}
      {revealed && (
        <div
          className="review-actions"
          style={{ animation: 'slide-up 0.18s var(--ease-out) both' }}
        >
          <button
            type="button"
            className="review-btn review-btn-fail"
            onClick={() => handleResult(false)}
          >
            ✗ No me salió
          </button>
          <button
            type="button"
            className="review-btn review-btn-pass"
            onClick={() => handleResult(true)}
          >
            ✓ La recordé
          </button>
        </div>
      )}
    </ReviewModal>
  )
}

function ReviewModal({ children, onClose }) {
  return (
    <div
      className="modal-overlay"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div
        className="modal"
        style={{ background: 'var(--bg-surface)', padding: 24, position: 'relative' }}
      >
        <button
          type="button"
          className="btn btn-ghost btn-icon btn-sm"
          onClick={onClose}
          aria-label="Cerrar repaso"
          style={{ position: 'absolute', top: 12, right: 12 }}
        >
          ✕
        </button>

        <h2
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 700,
            fontSize: 'var(--text-lg)',
            color: 'var(--text-primary)',
            margin: '0 0 20px',
            letterSpacing: '-0.01em',
          }}
        >
          Repaso de flashcards
        </h2>

        {children}
      </div>
    </div>
  )
}
