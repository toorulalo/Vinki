import { useState } from 'react'
import { useDecks, useFlashcards, LEVEL_LABELS, LEVEL_CSS } from '../../lib/useDecks'
import ReviewSession from './ReviewSession'

// Level dot colors
const LEVEL_COLORS = ['#9ca3af', '#3b82f6', '#f59e0b', '#10b981']

// Props: { card, onUpdate, profile }
export default function DeckEditPanel({ card, onUpdate, profile }) {
  const { createDeck, renameDeck } = useDecks(profile)
  const deckId = card?.content?.deckId || null
  const { cards: flashcards, dueCards, avgLevel, loading, addCard, updateCard, removeCard, recordResult } = useFlashcards(deckId)

  const [showReview, setShowReview] = useState(false)
  const [creating, setCreating] = useState(false)
  const [deckTitle, setDeckTitle] = useState(card?.content?.deckTitle || '')
  const [expandedCardId, setExpandedCardId] = useState(null)

  async function handleCreateDeck() {
    setCreating(true)
    const title = card?.title || 'Mi mazo'
    const { data, error } = await createDeck(card.id, profile.id, title)
    setCreating(false)
    if (!error && data) {
      setDeckTitle(data.title)
      onUpdate({ content: { ...card.content, deckId: data.id, deckTitle: data.title } })
    }
  }

  async function handleRenameTitle(newTitle) {
    setDeckTitle(newTitle)
    if (deckId) {
      await renameDeck(deckId, newTitle)
      onUpdate({ content: { ...card.content, deckTitle: newTitle } })
    }
  }

  async function handleAddFlashcard() {
    await addCard('', '')
  }

  async function handleUpdateFlashcard(id, field, value) {
    await updateCard(id, { [field]: value })
  }

  async function handleRemoveFlashcard(id) {
    if (window.confirm('¿Eliminar esta tarjeta?')) {
      await removeCard(id)
    }
  }

  if (!deckId) {
    return (
      <div style={{ padding: '16px 0', display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'flex-start' }}>
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', margin: 0 }}>
          Esta tarjeta todavía no tiene un mazo de flashcards asociado.
        </p>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={handleCreateDeck}
          disabled={creating}
        >
          {creating ? 'Creando...' : '✨ Crear mazo'}
        </button>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Deck title */}
      <div>
        <label style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
          Título del mazo
        </label>
        <input
          className="field-input"
          type="text"
          value={deckTitle}
          onChange={e => setDeckTitle(e.target.value)}
          onBlur={e => handleRenameTitle(e.target.value.trim() || 'Mi mazo')}
          placeholder="Nombre del mazo..."
          style={{ fontSize: 'var(--text-sm)', width: '100%' }}
        />
      </div>

      {/* Stats row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        {/* Level badge */}
        <span
          className="badge badge-primary"
          style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 'var(--text-xs)' }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: LEVEL_COLORS[avgLevel] || LEVEL_COLORS[0],
              display: 'inline-block',
            }}
          />
          {LEVEL_LABELS[avgLevel] || LEVEL_LABELS[0]}
        </span>

        {/* Due cards badge */}
        {dueCards.length > 0 && (
          <span
            className="badge"
            style={{
              background: 'rgba(239,68,68,0.12)',
              color: '#ef4444',
              border: '1px solid rgba(239,68,68,0.3)',
              fontSize: 'var(--text-xs)',
              borderRadius: 'var(--radius-full)',
              padding: '2px 8px',
            }}
          >
            {dueCards.length} para hoy
          </span>
        )}

        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginLeft: 'auto' }}>
          {flashcards.length} tarjeta{flashcards.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Review button */}
      {dueCards.length > 0 && (
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={() => setShowReview(true)}
        >
          🚀 Empezar repaso ({dueCards.length})
        </button>
      )}

      {/* Flashcard list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <p style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-muted)', margin: 0 }}>
          Tarjetas
        </p>

        {loading ? (
          <div className="spinner" style={{ margin: '8px auto' }} />
        ) : flashcards.length === 0 ? (
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', textAlign: 'center', padding: '12px 0', margin: 0 }}>
            Añade tu primera tarjeta
          </p>
        ) : (
          flashcards.map(fc => (
            <FlashcardRow
              key={fc.id}
              card={fc}
              expanded={expandedCardId === fc.id}
              onToggle={() => setExpandedCardId(id => id === fc.id ? null : fc.id)}
              onUpdateFront={val => handleUpdateFlashcard(fc.id, 'front', val)}
              onUpdateBack={val => handleUpdateFlashcard(fc.id, 'back', val)}
              onRemove={() => handleRemoveFlashcard(fc.id)}
            />
          ))
        )}
      </div>

      {/* Add card button */}
      <button
        type="button"
        className="btn btn-secondary btn-sm"
        onClick={handleAddFlashcard}
      >
        + Añadir tarjeta
      </button>

      {/* Review modal */}
      {showReview && (
        <ReviewSession
          deckId={deckId}
          onClose={() => setShowReview(false)}
        />
      )}
    </div>
  )
}

function FlashcardRow({ card, expanded, onToggle, onUpdateFront, onUpdateBack, onRemove }) {
  const levelColor = ['#9ca3af', '#3b82f6', '#f59e0b', '#10b981'][card.level] || '#9ca3af'

  return (
    <div
      style={{
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)',
        overflow: 'hidden',
        background: 'var(--bg-surface)',
      }}
    >
      {/* Row header */}
      <button
        type="button"
        onClick={onToggle}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 10px',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: levelColor,
            flexShrink: 0,
          }}
        />
        <span
          style={{
            flex: 1,
            fontSize: 'var(--text-sm)',
            color: 'var(--text-primary)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {card.front || '(anverso vacío)'}
        </span>
        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', flexShrink: 0 }}>
          {expanded ? '▲' : '▼'}
        </span>
      </button>

      {/* Expanded editor */}
      {expanded && (
        <div
          style={{
            borderTop: '1px solid var(--border)',
            padding: 10,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          <div>
            <label style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', display: 'block', marginBottom: 3 }}>
              Anverso (pregunta)
            </label>
            <textarea
              className="field-input"
              rows={2}
              defaultValue={card.front}
              onBlur={e => onUpdateFront(e.target.value)}
              placeholder="Pregunta o concepto..."
              style={{ width: '100%', fontSize: 'var(--text-sm)', resize: 'vertical', fontFamily: 'var(--font-body)' }}
            />
          </div>
          <div>
            <label style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', display: 'block', marginBottom: 3 }}>
              Reverso (respuesta)
            </label>
            <textarea
              className="field-input"
              rows={2}
              defaultValue={card.back}
              onBlur={e => onUpdateBack(e.target.value)}
              placeholder="Respuesta o definición..."
              style={{ width: '100%', fontSize: 'var(--text-sm)', resize: 'vertical', fontFamily: 'var(--font-body)' }}
            />
          </div>
          <button
            type="button"
            className="btn btn-danger btn-sm"
            onClick={onRemove}
            style={{ alignSelf: 'flex-end' }}
          >
            🗑 Eliminar
          </button>
        </div>
      )}
    </div>
  )
}
