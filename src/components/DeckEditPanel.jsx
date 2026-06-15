import { useState, useEffect } from 'react'
import { useFlashcards, LEVEL_LABELS, LEVEL_CSS } from '../lib/useDecks'
import { IconClose, IconPlus, IconX, IconStar } from './icons/index.jsx'

export default function DeckEditPanel({ card, deck, onUpdate, onClose, onStartReview }) {
  const { cards, dueCards, avgLevel, loading, addCard, updateCard, removeCard } = useFlashcards(deck?.id)
  const [title, setTitle] = useState(deck?.title || card?.title || 'Mi mazo')

  useEffect(() => {
    if (deck?.title) setTitle(deck.title)
    else if (card?.title) setTitle(card.title)
  }, [deck, card])

  function saveTitle() {
    if (!title.trim()) return
    onUpdate?.(card?.id, { title: title.trim() })
  }

  if (!deck) return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">Mazo</span>
          <button type="button" className="btn-icon" onClick={onClose} aria-label="Cerrar"><IconClose size={18} /></button>
        </div>
        <p style={{ color: 'var(--ink-soft)', fontSize: '0.9rem' }}>Cargando mazo...</p>
      </div>
    </div>
  )

  const levelLabel = LEVEL_LABELS[avgLevel] || 'Nueva'
  const levelClass = LEVEL_CSS[avgLevel]   || 'level-0'

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal deck-panel" onClick={(e) => e.stopPropagation()}>

        <div className="modal-header">
          <input
            className="deck-title-input"
            value={title}
            maxLength={50}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={saveTitle}
            placeholder="Nombre del mazo"
          />
          <button type="button" className="btn-icon" onClick={onClose} aria-label="Cerrar">
            <IconClose size={18} />
          </button>
        </div>

        {/* Estado del mazo */}
        <div className="deck-status">
          <span className={`deck-level-badge ${levelClass}`}>{levelLabel}</span>
          <span className="deck-stat">{cards.length} cartas</span>
          {dueCards.length > 0 && (
            <span className="deck-stat due">{dueCards.length} para hoy</span>
          )}
        </div>

        {/* Botón repasar */}
        {dueCards.length > 0 && (
          <button
            type="button"
            className="btn-primary"
            style={{ marginBottom: 16 }}
            onClick={() => onStartReview(deck, dueCards)}
          >
            Repasar ahora ({dueCards.length})
          </button>
        )}

        {dueCards.length === 0 && cards.length > 0 && (
          <div className="deck-all-done">
            <IconStar size={18} style={{ color: 'var(--terracota)' }} />
            <span>Al día — sin cartas pendientes</span>
          </div>
        )}

        {/* Lista de flashcards */}
        <div className="deck-cards-list">
          {loading && <p style={{ color: 'var(--ink-faint)', fontSize: '0.85rem' }}>Cargando...</p>}
          {!loading && cards.length === 0 && (
            <p style={{ color: 'var(--ink-faint)', fontSize: '0.85rem', textAlign: 'center', padding: '16px 0' }}>
              Sin cartas todavía — agregá una abajo.
            </p>
          )}
          {cards.map((fc) => (
            <FlashcardRow key={fc.id} card={fc} onUpdate={updateCard} onRemove={removeCard} />
          ))}
        </div>

        {/* Agregar carta */}
        <button
          type="button"
          className="deck-add-btn"
          onClick={() => addCard()}
        >
          <IconPlus size={16} /> Agregar carta
        </button>
      </div>
    </div>
  )
}

function FlashcardRow({ card, onUpdate, onRemove }) {
  const [front, setFront] = useState(card.front || '')
  const [back,  setBack]  = useState(card.back  || '')
  const [open,  setOpen]  = useState(!card.front && !card.back)

  function save() { onUpdate(card.id, { front: front.trim(), back: back.trim() }) }

  const levelLabel = LEVEL_LABELS[card.level] || 'Nueva'
  const levelClass = LEVEL_CSS[card.level]    || 'level-0'

  return (
    <div className="flashcard-row">
      <div className="flashcard-row-header" onClick={() => setOpen((o) => !o)}>
        <span className={`fc-level-dot ${levelClass}`} title={levelLabel} />
        <span className="flashcard-row-front">{front || 'Frente (vacío)'}</span>
        <button
          type="button"
          className="btn-icon-sm"
          onClick={(e) => { e.stopPropagation(); onRemove(card.id) }}
          aria-label="Eliminar carta"
        >
          <IconX size={13} />
        </button>
      </div>
      {open && (
        <div className="flashcard-row-body">
          <div className="field">
            <label className="field-label">Frente</label>
            <input className="field-input" value={front} placeholder="Pregunta o concepto"
              onChange={(e) => setFront(e.target.value)} onBlur={save} autoFocus={!card.front} />
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label className="field-label">Reverso</label>
            <textarea className="field-textarea" value={back} placeholder="Respuesta o definición"
              style={{ minHeight: 72 }} onChange={(e) => setBack(e.target.value)} onBlur={save} />
          </div>
        </div>
      )}
    </div>
  )
}
