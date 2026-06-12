import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { getYoutubeId, getDomain } from '../lib/linkPreview'

const TYPE_LABEL = {
  note: 'Nota',
  link: 'Link',
  image: 'Imagen'
}

export default function CardEditPanel({ card, onUpdate, onClose }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal card-edit-panel"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <span className="session-mode-badge">{TYPE_LABEL[card.type]}</span>
          <button
            type="button"
            className="card-control-btn"
            onClick={onClose}
            aria-label="Cerrar"
          >
            ×
          </button>
        </div>

        {card.type === 'note' && <NoteEditor card={card} onUpdate={onUpdate} />}
        {card.type === 'link' && <LinkEditor card={card} onUpdate={onUpdate} />}
        {card.type === 'image' && <ImageEditor card={card} onUpdate={onUpdate} />}
      </div>
    </div>
  )
}

function NoteEditor({ card, onUpdate }) {
  const [text, setText] = useState(card.content?.text || '')

  return (
    <textarea
      className="panel-note-text"
      value={text}
      placeholder="Escribí tu nota..."
      autoFocus
      onChange={(e) => setText(e.target.value)}
      onBlur={() => onUpdate(card.id, { content: { ...card.content, text } })}
    />
  )
}

function LinkEditor({ card, onUpdate }) {
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
    <div className="panel-link-body">
      {youtubeId && (
        <a href={card.content.url} target="_blank" rel="noreferrer">
          <img
            className="panel-link-thumb"
            src={`https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`}
            alt=""
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

      <div className="field">
        <label htmlFor={`url-${card.id}`}>Link</label>
        <input
          id={`url-${card.id}`}
          className="card-link-input"
          type="url"
          value={url}
          placeholder="https://..."
          autoFocus
          onChange={(e) => setUrl(e.target.value)}
          onBlur={() => save()}
        />
      </div>

      <div className="field">
        <label htmlFor={`title-${card.id}`}>Título</label>
        <input
          id={`title-${card.id}`}
          className="card-link-input"
          type="text"
          value={title}
          placeholder="Título (opcional)"
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => save()}
        />
      </div>

      <div className="field">
        <label htmlFor={`note-${card.id}`}>Nota</label>
        <textarea
          id={`note-${card.id}`}
          className="card-link-note"
          value={note}
          placeholder="Nota o comentario (opcional)"
          onChange={(e) => setNote(e.target.value)}
          onBlur={() => save()}
        />
      </div>
    </div>
  )
}

function ImageEditor({ card, onUpdate }) {
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
    <div className="panel-image-body">
      {card.content?.url ? (
        <img className="panel-image-preview" src={card.content.url} alt="" />
      ) : (
        <p className="canvas-empty" style={{ margin: '8px 0' }}>
          Todavía no agregaste una imagen.
        </p>
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

      <div className="field">
        <label htmlFor={`title-${card.id}`}>Título</label>
        <input
          id={`title-${card.id}`}
          className="card-link-input"
          type="text"
          value={title}
          placeholder="Título (opcional)"
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => onUpdate(card.id, { title })}
        />
      </div>
    </div>
  )
}
