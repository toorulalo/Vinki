import { useState } from 'react'

const TYPE_LABEL = {
  note: 'Nota',
  link: 'Link',
  image: 'Imagen'
}

export default function CardItem({
  card,
  onUpdate,
  onUpdateLocal,
  onRemove,
  onSendToVrop
}) {
  const [dragging, setDragging] = useState(false)

  function handlePointerDown(e) {
    // Evita arrastrar si el click empezó en un control interno
    if (e.target.closest('.card-controls, textarea, input, a')) return

    e.preventDefault()
    const startX = e.clientX
    const startY = e.clientY
    const origX = card.x
    const origY = card.y
    let lastX = origX
    let lastY = origY

    setDragging(true)

    function handleMove(ev) {
      lastX = origX + (ev.clientX - startX)
      lastY = origY + (ev.clientY - startY)
      onUpdateLocal(card.id, { x: lastX, y: lastY })
    }

    function handleUp() {
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', handleUp)
      setDragging(false)
      onUpdate(card.id, { x: lastX, y: lastY })
    }

    window.addEventListener('pointermove', handleMove)
    window.addEventListener('pointerup', handleUp)
  }

  function toggleMinimize() {
    onUpdate(card.id, { minimized: !card.minimized })
  }

  return (
    <div
      className={`card-item card-${card.type}${dragging ? ' dragging' : ''}${
        card.minimized ? ' minimized' : ''
      }`}
      style={{ left: card.x, top: card.y }}
    >
      <div className="card-header" onPointerDown={handlePointerDown}>
        <span className="card-type-tag">{TYPE_LABEL[card.type]}</span>
        <div className="card-controls">
          {onSendToVrop && (
            <button
              type="button"
              className="card-control-btn"
              onClick={() => onSendToVrop(card)}
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
            onClick={() => onRemove(card.id)}
            aria-label="Eliminar tarjeta"
          >
            ×
          </button>
        </div>
      </div>

      {!card.minimized && (
        <div className="card-body">
          {card.type === 'note' && (
            <NoteBody card={card} onUpdate={onUpdate} />
          )}
          {card.type === 'link' && (
            <LinkBody card={card} onUpdate={onUpdate} />
          )}
          {card.type === 'image' && (
            <ImageBody card={card} onUpdate={onUpdate} />
          )}
        </div>
      )}
    </div>
  )
}

function NoteBody({ card, onUpdate }) {
  const [text, setText] = useState(card.content?.text || '')

  return (
    <textarea
      className="card-note-text"
      value={text}
      placeholder="Escribí tu nota..."
      onChange={(e) => setText(e.target.value)}
      onBlur={() => onUpdate(card.id, { content: { ...card.content, text } })}
    />
  )
}

function LinkBody({ card, onUpdate }) {
  const [url, setUrl] = useState(card.content?.url || '')
  const hasUrl = Boolean(card.content?.url)

  function save() {
    onUpdate(card.id, { content: { ...card.content, url } })
  }

  return (
    <div className="card-link-body">
      <input
        className="card-link-input"
        type="url"
        value={url}
        placeholder="https://..."
        onChange={(e) => setUrl(e.target.value)}
        onBlur={save}
      />
      {hasUrl && (
        <a
          className="card-link-preview"
          href={card.content.url}
          target="_blank"
          rel="noreferrer"
        >
          {card.content.url}
        </a>
      )}
    </div>
  )
}

function ImageBody({ card, onUpdate }) {
  const [url, setUrl] = useState(card.content?.url || '')

  function save() {
    onUpdate(card.id, { content: { ...card.content, url } })
  }

  return (
    <div className="card-image-body">
      {card.content?.url && (
        <img
          className="card-image-preview"
          src={card.content.url}
          alt=""
          loading="lazy"
        />
      )}
      <input
        className="card-link-input"
        type="url"
        value={url}
        placeholder="URL de la imagen"
        onChange={(e) => setUrl(e.target.value)}
        onBlur={save}
      />
    </div>
  )
}
