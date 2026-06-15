import { useState, useEffect } from 'react'
import { useFlashcards } from '../../lib/useDecks'
import { burstConfetti } from '../../lib/effects'

// Props: { deckId, onClose }
export default function ReviewSession({ deckId, onClose }) {
  const { dueCards, loading, recordResult } = useFlashcards(deckId)

  const [queue, setQueue] = useState(null)       // cards to review in this session
  const [currentIdx, setCurrentIdx] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const [score, setScore] = useState({ pass: 0, fail: 0 })
  const [done, setDone] = useState(false)

  // Initialise queue once due cards are loaded
  useEffect(() => {
    if (!loading && queue === null) {
      setQueue([...dueCards])
    }
  }, [loading, dueCards, queue])

  const card = queue ? queue[currentIdx] : null
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
      // Session complete
      setDone(true)
      if (newScore.pass > 0) {
        setTimeout(() => burstConfetti(), 100)
      }
    } else {
      setCurrentIdx(nextIdx)
      setRevealed(false)
    }
  }

  // Loading state
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
          <p style={{ fontSize: 48, margin: '0 0 16px' }}>🎉</p>
          <p style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 'var(--text-2xl)', margin: '0 0 8px' }}>
            ¡Al día!
          </p>
          <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)', margin: '0 0 24px' }}>
            No tienes tarjetas pendientes para hoy.
          </p>
          <button type="button" className="btn btn-primary" onClick={onClose}>
            Cerrar
          </button>
        </div>
      </ReviewModal>
    )
  }

  // Completion screen
  if (done) {
    const pct = Math.round((score.pass / total) * 100)
    return (
      <ReviewModal onClose={onClose}>
        <div style={{ textAlign: 'center', padding: '48px 24px' }}>
          <p style={{ fontSize: 56, margin: '0 0 16px' }}>
            {pct >= 80 ? '🏆' : pct >= 50 ? '👍' : '💪'}
          </p>
          <p style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 'var(--text-2xl)', margin: '0 0 8px' }}>
            ¡Repaso completado!
          </p>
          <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)', margin: '0 0 24px' }}>
            Recordaste {score.pass} de {total} tarjetas ({pct}%)
          </p>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 24 }}>
            <span style={{ fontSize: 'var(--text-sm)', color: '#10b981', fontWeight: 600 }}>✓ {score.pass} correctas</span>
            <span style={{ color: 'var(--border)' }}>·</span>
            <span style={{ fontSize: 'var(--text-sm)', color: '#ef4444', fontWeight: 600 }}>✗ {score.fail} falladas</span>
          </div>
          <button type="button" className="btn btn-primary" onClick={onClose}>
            Cerrar
          </button>
        </div>
      </ReviewModal>
    )
  }

  // Review card
  return (
    <ReviewModal onClose={onClose}>
      {/* Progress bar */}
      <div className="review-progress-bar" style={{ height: 4, background: 'var(--bg-surface-2)', borderRadius: 2, margin: '0 0 24px', overflow: 'hidden' }}>
        <div
          className="review-progress-fill"
          style={{
            height: '100%',
            width: `${((currentIdx) / total) * 100}%`,
            background: 'var(--color-primary)',
            borderRadius: 2,
            transition: 'width 0.3s ease',
          }}
        />
      </div>

      {/* Counter */}
      <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', textAlign: 'center', margin: '0 0 20px' }}>
        {currentIdx + 1} / {total}
      </p>

      {/* Card face */}
      <div
        className="review-card"
        style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          padding: '32px 24px',
          minHeight: 160,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          gap: 16,
          cursor: revealed ? 'default' : 'pointer',
          boxShadow: 'var(--shadow-md)',
          transition: 'box-shadow 0.2s ease',
        }}
        onClick={() => !revealed && setRevealed(true)}
      >
        {/* Front */}
        <p
          className="review-front"
          style={{
            fontSize: 'var(--text-lg)',
            fontWeight: 600,
            fontFamily: 'var(--font-display)',
            margin: 0,
            color: 'var(--text-primary)',
          }}
        >
          {card.front || '(anverso vacío)'}
        </p>

        {/* Back (revealed) */}
        {revealed ? (
          <p
            className="review-back"
            style={{
              fontSize: 'var(--text-base)',
              color: 'var(--text-secondary)',
              margin: 0,
              borderTop: '1px solid var(--border)',
              paddingTop: 16,
              width: '100%',
            }}
          >
            {card.back || '(reverso vacío)'}
          </p>
        ) : (
          <p
            className="review-tap-hint"
            style={{
              fontSize: 'var(--text-sm)',
              color: 'var(--text-muted)',
              margin: 0,
              animation: 'fade-in 0.3s ease both',
            }}
          >
            Toca para ver la respuesta
          </p>
        )}
      </div>

      {/* Action buttons (only after reveal) */}
      {revealed && (
        <div
          className="review-actions"
          style={{
            display: 'flex',
            gap: 12,
            marginTop: 20,
            animation: 'slide-up 0.2s ease both',
          }}
        >
          <button
            type="button"
            className="review-btn-fail btn btn-danger"
            onClick={() => handleResult(false)}
            style={{ flex: 1 }}
          >
            ✗ No me salió
          </button>
          <button
            type="button"
            className="review-btn-pass btn"
            onClick={() => handleResult(true)}
            style={{
              flex: 1,
              background: '#10b981',
              color: '#fff',
              border: 'none',
            }}
          >
            ✓ La recordé
          </button>
        </div>
      )}
    </ReviewModal>
  )
}

// Shared modal wrapper
function ReviewModal({ children, onClose }) {
  return (
    <div
      className="modal-overlay"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        zIndex: 200,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div
        className="modal"
        style={{
          background: 'var(--bg-canvas)',
          borderRadius: 'var(--radius-lg)',
          width: '100%',
          maxWidth: 480,
          padding: 24,
          boxShadow: 'var(--shadow-lg)',
          position: 'relative',
          maxHeight: '90dvh',
          overflowY: 'auto',
        }}
      >
        {/* Close button */}
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
          className="modal-title"
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 700,
            fontSize: 'var(--text-lg)',
            margin: '0 0 20px',
          }}
        >
          Repaso de flashcards
        </h2>

        {children}
      </div>
    </div>
  )
}
