import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { getYoutubeId, getDomain } from '../lib/linkPreview'
import { compressImage } from '../lib/compressImage'

const TYPE_LABEL = { note: 'Nota', link: 'Link', image: 'Imagen' }

export default function CardEditPanel({
  card,
  onUpdate,
  onRemove,
  onSendToVrop,
  onClose
}) {
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

        <div className="panel-actions">
          {onSendToVrop && (
            <button
              type="button"
              className="btn-pill"
              onClick={() => onSendToVrop(card)}
            >
              ➤ Enviar a Vrop
            </button>
          )}
          {onRemove && (
            <button
              type="button"
              className="btn-pill btn-pill-muted btn-danger"
              onClick={() => onRemove(card.id)}
            >
              Eliminar
            </button>
          )}
        </div>
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

  function save() {
    onUpdate(card.id, { title, content: { ...card.content, url, note } })
  }

  const youtubeId = getYoutubeId(card.content?.url)
  const domain = getDomain(card.content?.url)

  return (
    <div className="panel-link-body">
      {youtubeId && (
        <iframe
          className="panel-youtube"
          src={`https://www.youtube.com/embed/${youtubeId}`}
          title="YouTube"
          allowFullScreen
        />
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
        <label>Link</label>
        <input
          className="card-link-input"
          type="url"
          value={url}
          placeholder="https://..."
          onChange={(e) => setUrl(e.target.value)}
          onBlur={save}
        />
      </div>
      <div className="field">
        <label>Título</label>
        <input
          className="card-link-input"
          type="text"
          value={title}
          placeholder="Título (opcional)"
          onChange={(e) => setTitle(e.target.value)}
          onBlur={save}
        />
      </div>
      <div className="field">
        <label>Nota</label>
        <textarea
          className="card-link-note"
          value={note}
          placeholder="Nota o comentario (opcional)"
          onChange={(e) => setNote(e.target.value)}
          onBlur={save}
        />
      </div>
    </div>
  )
}

function ImageEditor({ card, onUpdate }) {
  const [title, setTitle] = useState(card.title || '')
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [zoom, setZoom] = useState(false)
  const size = card.content?.size || 200

  async function handleFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setError('')

    let toUpload = file
    try {
      toUpload = await compressImage(file)
    } catch {
      // si falla la compresión, subimos el original
    }

    const ext = 'jpg'
    const path = `${card.id}-${Date.now()}.${ext}`
    const { error: uploadError } = await supabase.storage
      .from('card-images')
      .upload(path, toUpload, { upsert: true })

    if (uploadError) {
      setUploading(false)
      setError('No se pudo subir la imagen.')
      return
    }

    const { data } = supabase.storage.from('card-images').getPublicUrl(path)
    setUploading(false)
    onUpdate(card.id, { content: { ...card.content, url: data.publicUrl } })
  }

  function setSize(px) {
    onUpdate(card.id, { content: { ...card.content, size: px } })
  }

  return (
    <div className="panel-image-body">
      {card.content?.url ? (
        <img
          className={`panel-image-preview${zoom ? ' zoomed' : ''}`}
          src={card.content.url}
          alt=""
          onClick={() => setZoom((z) => !z)}
        />
      ) : (
        <p className="canvas-empty" style={{ margin: '8px 0' }}>
          Todavía no agregaste una imagen.
        </p>
      )}

      {card.content?.url && (
        <div className="field">
          <label>Tamaño en el lienzo</label>
          <input
            type="range"
            min="120"
            max="360"
            value={size}
            onChange={(e) => setSize(Number(e.target.value))}
          />
        </div>
      )}

      <label className="file-input-label">
        {uploading ? 'Subiendo...' : card.content?.url ? 'Cambiar imagen' : 'Elegir imagen'}
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
        <label>Título</label>
        <input
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
