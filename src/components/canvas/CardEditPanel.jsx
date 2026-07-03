import { useState, useEffect } from 'react'
import NoteCard from '../cards/NoteCard'
import LinkCard from '../cards/LinkCard'
import ImageCard from '../cards/ImageCard'
import PdfCard from '../cards/PdfCard'
import TimerCard from '../cards/TimerCard'
import DeckEditPanel from '../decks/DeckEditPanel'

const TYPE_ICON_EMOJI = {
  note:  '📝',
  link:  '🔗',
  image: '🖼️',
  pdf:   '📄',
  timer: '⏱️',
  deck:  '🃏',
}

const TYPE_LABEL = {
  note:  'Nota',
  link:  'Link',
  image: 'Imagen',
  pdf:   'PDF',
  timer: 'Temporizador',
  deck:  'Mazo',
}

export default function CardEditPanel({
  card,
  onUpdate,
  onRemove,
  onClose,
  profile,
}) {
  const [title, setTitle] = useState(card?.title || '')

  useEffect(() => {
    setTitle(card?.title || '')
  }, [card?.id])

  if (!card) return null

  function handleTitleBlur() {
    if (title !== card.title) {
      onUpdate({ title })
    }
  }

  function handleTitleKeyDown(e) {
    if (e.key === 'Enter') e.currentTarget.blur()
  }

  function renderEditor() {
    const props = { card, isEditing: true, onUpdate, profile }
    switch (card.type) {
      case 'note':  return <NoteCard  {...props} />
      case 'link':  return <LinkCard  {...props} />
      case 'image': return <ImageCard {...props} />
      case 'pdf':   return <PdfCard   {...props} />
      case 'timer': return <TimerCard {...props} />
      case 'deck':  return <DeckEditPanel card={card} onUpdate={onUpdate} profile={profile} />
      default:      return <p style={{ color: 'var(--text-muted)' }}>Tipo desconocido.</p>
    }
  }

  return (
    <div className={`card-edit-panel card-type-${card.type}`} style={{ zIndex: 60 }}>
      <div className="card-edit-header">
        <div className="card-edit-type-icon">
          <span style={{ fontSize: '1rem' }}>{TYPE_ICON_EMOJI[card.type] || '📋'}</span>
        </div>

        <input
          className="card-edit-title-input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={handleTitleBlur}
          onKeyDown={handleTitleKeyDown}
          placeholder={`Título (${TYPE_LABEL[card.type] || 'tarjeta'})`}
          maxLength={80}
        />

        <button
          type="button"
          className="btn-icon"
          onClick={onClose}
          aria-label="Cerrar"
          style={{ flexShrink: 0 }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      <div className="card-edit-body">
        {renderEditor()}
      </div>

      {onRemove && (
        <div className="card-edit-footer">
          <button
            type="button"
            className="btn btn-danger btn-sm"
            onClick={() => {
              if (window.confirm('¿Eliminar esta tarjeta?')) {
                onRemove()
              }
            }}
          >
            Eliminar tarjeta
          </button>
        </div>
      )}
    </div>
  )
}
