import { useState } from 'react'
import { useFlashcards } from '../lib/useDecks'
import { burstConfetti } from '../lib/effects'
import { IconClose, IconCheck, IconX } from './icons/index.jsx'

export default function ReviewSession({ deck, initialCards, onClose }) {
  const { recordResult } = useFlashcards(deck.id)

  const [queue,    setQueue]    = useState(() => shuffled([...initialCards]))
  const [current,  setCurrent]  = useState(0)
  const [revealed, setRevealed] = useState(false)
  const [results,  setResults]  = useState([]) // { id, remembered }
  const [done,     setDone]     = useState(false)

  function shuffled(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]]
    }
    return arr
  }

  async function handleResult(remembered) {
    const card = queue[current]
    await recordResult(card.id, remembered)
    const newResults = [...results, { id: card.id, remembered }]
    setResults(newResults)

    if (current + 1 >= queue.length) {
      const correct = newResults.filter((r) => r.remembered).length
      if (correct > 0) burstConfetti()
      setDone(true)
    } else {
      setCurrent((c) => c + 1)
      setRevealed(false)
    }
  }

  if (done) {
    const correct = results.filter((r) => r.remembered).length
    const total   = results.length
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal review-done" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <h3 className="modal-title">Repaso terminado</h3>
            <button type="button" className="btn-icon" onClick={onClose} aria-label="Cerrar">
              <IconClose size={18} />
            </button>
          </div>
          <div className="review-done-score">
            <span className="review-done-number">{correct}</span>
            <span className="review-done-sep">/</span>
            <span className="review-done-total">{total}</span>
          </div>
          <p className="review-done-label">
            {correct === total
              ? '¡Las recordaste todas!'
              : correct === 0
                ? 'No te preocupes, repasalas de nuevo pronto.'
                : `Bien. Las ${total - correct} que fallaste vuelven pronto.`}
          </p>
          <button type="button" className="btn-primary" style={{ marginTop: 8 }} onClick={onClose}>
            Listo
          </button>
        </div>
      </div>
    )
  }

  const card     = queue[current]
  const progress = (current / queue.length) * 100

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal review-session" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span className="review-counter">{current + 1} / {queue.length}</span>
          <button type="button" className="btn-icon" onClick={onClose} aria-label="Cerrar">
            <IconClose size={18} />
          </button>
        </div>

        <div className="review-progress-bar">
          <div className="review-progress-fill" style={{ width: `${progress}%` }} />
        </div>

        <div className="review-card" onClick={() => !revealed && setRevealed(true)}>
          <div className="review-front">{card.front}</div>
          {revealed
            ? <div className="review-back">{card.back}</div>
            : <p className="review-tap-hint">Tap para revelar</p>
          }
        </div>

        {revealed && (
          <div className="review-actions">
            <button type="button" className="review-btn review-btn-fail" onClick={() => handleResult(false)}>
              <IconX size={18} /> No me salió
            </button>
            <button type="button" className="review-btn review-btn-pass" onClick={() => handleResult(true)}>
              <IconCheck size={18} /> La recordé
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
