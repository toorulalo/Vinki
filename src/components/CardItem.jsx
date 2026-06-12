import { useRef, useState } from 'react'
import CardEditPanel from './CardEditPanel'
import { getYoutubeId, getDomain } from '../lib/linkPreview'

const TYPE_LABEL = {
  note: 'Nota',
  link: 'Link',
  image: 'Imagen'
}

const DRAG_THRESHOLD = 5

export default function CardItem({
  card,
  onUpdate,
  onUpdateLocal,
  onRemove,
  onSendToVrop
}) {
  const [dragging, setDragging] = useState(false)
  const [showPanel, setShowPanel] = useState(false)
  const movedRef = useRef(false)

  function handlePointerDown(e) {
    if (e.target.closest('.card-controls')) return

    e.preventDefault()
    const startX = e.clientX
    const startY = e.clientY
    const origX = card.x
    const origY = card.y
    let lastX = origX
    let lastY = origY
    movedRef.current = false

    function handleMove(ev) {
      const dx = ev.clientX - startX
      const dy = ev.clientY - startY
      if (
        !movedRef.current &&
        (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD)
      ) {
        movedRef.current = true
        setDragging(true)
      }
      if (movedRef.current) {
        lastX = origX + dx
        lastY = origY + dy
        onUpdateLocal(card.id, { x: lastX, y: lastY })
      }
    }

    function handleUp() {
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', handleUp)

      if (movedRef.current) {
        setDragging(false)
        onUpdate(card.id, { x: lastX, y: lastY })
      } else {
        setShowPanel(true)
      }
    }

    window.addEventListener('pointermove', handleMove)
    window.addEventListener('pointerup', handleUp)
  }

  function toggleMinimize(e) {
    e.stopPropagation()
    onUpdate(card.id, { minimized: !card.minimized })
  }

  return (
    <>
      <div
        className={`card-item card-${card.type}${dragging ? ' dragging' : ''}${
          card.minimized ? ' minimized' : ''
        }`}
        style={{ left: card.x, top: card.y }}
        onPointerDown={handlePointerDown}
      >
        <div className="card-header">
          <span className="card-type-tag">{TYPE_LABEL[card.type]}</span>
          <div className="card-controls">
            {onSendToVrop && (
              <button
                type="button"
                className="card-control-btn"
                onClick={(e) => {
                  e.stopPropagation()
                  onSendToVrop(card)
                }}
                aria-label="Enviar a Vrop It"
                title="Enviar a Vrop It"
              >
                ➤
              </button>
            )}
            <button
              type="button"
              className="card-control-btn"
              onClick={toggleMinimize}
              aria-label={card.minimized ? 'Expandir tarjeta' : 'Minimizar tarjeta'}
            >
              {card.minimized ? '▢' : '—'}
            </button>
            <button
              type="button"
              className="card-control-btn"
              onClick={(e) => {
                e.stopPropagation()
                onRemove(card.id)
              }}
              aria-label="Eliminar tarjeta"
            >
              ×
            </button>
          </div>
        </div>

        {!card.minimized && (
          <div className="card-preview">
            <CardPreview card={card} />
          </div>
        )}
      </div>

      {showPanel && (
        <CardEditPanel
          card={card}
          onUpdate={onUpdate}
          onClose={() => setShowPanel(false)}
        />
      )}
    </>
  )
}

function CardPreview({ card }) {
  if (card.type === 'note') {
    const text = card.content?.text?.trim()
    return (
      <p className="preview-note">
        {text || 'Nota vacía — tocá para escribir'}
      </p>
    )
  }

  if (card.type === 'link') {
    const youtubeId = getYoutubeId(card.content?.url)
    const domain = getDomain(card.content?.url)

    return (
      <div className="preview-link">
        {youtubeId ? (
          <img
            className="preview-thumb"
            src={`https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`}
            alt=""
            loading="lazy"
          />
        ) : card.content?.url ? (
          <div className="preview-chip">
            <img
              className="card-link-favicon"
              src={`https://www.google.com/s2/favicons?domain=${domain}&sz=32`}
              alt=""
            />
            <span className="card-link-domain">{domain}</span>
          </div>
        ) : (
          <p className="preview-empty">Sin link — tocá para agregar</p>
        )}
        {card.title && <p className="preview-title">{card.title}</p>}
      </div>
    )
  }

  if (card.type === 'image') {
    return card.content?.url ? (
      <img
        className="preview-thumb"
        src={card.content.url}
        alt=""
        loading="lazy"
      />
    ) : (
      <p className="preview-empty">Sin imagen — tocá para agregar</p>
    )
  }

  return null
}
