import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'

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

function getYoutubeId(url) {
  if (!url) return null
  try {
    const u = new URL(url)
    if (u.hostname.includes('youtu.be')) {
      return u.pathname.slice(1) || null
    }
    if (u.hostname.includes('youtube.com')) {
      if (u.pathname === '/watch') return u.searchParams.get('v')
      if (u.pathname.startsWith('/shorts/')) {
        return u.pathname.split('/')[2] || null
      }
    }
  } catch {
    return null
  }
  return null
}

function getDomain(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return ''
  }
}

function LinkBody({ card, onUpdate }) {
  const [url, setUrl] = useState(card.content?.url || '')
  const [title, setTitle] = useState(card.title || '')
  const [note, setNote] = useState(card.content?.note || '')

  function save(patch) {
    onUpdate(card.id, {
      title,
      content: { ...card.content, url, note },
      ...patch
    })
  }

  const youtubeId = getYoutubeId(card.content?.url)
  const domain = getDomain(card.content?.url)

  return (
    <div className="card-link-body">
      {youtubeId && (
        <a href={card.content.url} target="_blank" rel="noreferrer">
          <img
            className="card-link-thumb"
            src={`https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`}
            alt=""
            loading="lazy"
          />
        </a>
      )}

      {!youtubeId && card.content?.url && (
        <a
          className="card-link-chip"
          href={card.content.url}
          target="_blank"
          rel="noreferrer"
        >
          <img
            className="card-link-favicon"
            src={`https://www.google.com/s2/favicons?domain=${domain}&sz=32`}
            alt=""
          />
          <span className="card-link-domain">{domain}</span>
        </a>
      )}

      {card.title && <p className="card-link-title">{card.title}</p>}

      <input
        className="card-link-input"
        type="url"
        value={url}
        placeholder="https://..."
        onChange={(e) => setUrl(e.target.value)}
        onBlur={() => save()}
      />
      <input
        className="card-link-input"
        type="text"
        value={title}
        placeholder="Título (opcional)"
        onChange={(e) => setTitle(e.target.value)}
        onBlur={() => save()}
      />
      <textarea
        className="card-link-note"
        value={note}
        placeholder="Nota o comentario (opcional)"
        onChange={(e) => setNote(e.target.value)}
        onBlur={() => save()}
      />
    </div>
  )
}

function ImageBody({ card, onUpdate }) {
  const [title, setTitle] = useState(card.title || '')
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  async function handleFile(e) {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    setError('')

    const ext = file.name.split('.').pop()
    const path = `${card.id}-${Date.now()}.${ext}`

    const { error: uploadError } = await supabase.storage
      .from('card-images')
      .upload(path, file, { upsert: true })

    if (uploadError) {
      setUploading(false)
      setError('No se pudo subir la imagen.')
      return
    }

    const { data } = supabase.storage.from('card-images').getPublicUrl(path)

    setUploading(false)
    onUpdate(card.id, { content: { ...card.content, url: data.publicUrl } })
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

      <label className="file-input-label">
        {uploading ? 'Subiendo...' : 'Elegir imagen'}
        <input
          className="file-input"
          type="file"
          accept="image/*"
          onChange={handleFile}
          disabled={uploading}
        />
      </label>

      {error && <p className="message error">{error}</p>}

      <input
        className="card-link-input"
        type="text"
        value={title}
        placeholder="Título (opcional)"
        onChange={(e) => setTitle(e.target.value)}
        onBlur={() => onUpdate(card.id, { title })}
      />
    </div>
  )
}
