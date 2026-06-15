import { useState } from 'react'
import { getYoutubeId, getDomain, getFavicon } from '../../lib/linkPreview'

export default function LinkCard({ card, isEditing, onUpdate }) {
  const [url,   setUrl]   = useState(card.content?.url   || '')
  const [title, setTitle] = useState(card.title          || '')
  const [note,  setNote]  = useState(card.content?.note  || '')

  const currentUrl  = isEditing ? url : (card.content?.url || '')
  const youtubeId   = getYoutubeId(currentUrl)
  const domain      = getDomain(currentUrl)
  const favicon     = currentUrl ? getFavicon(currentUrl) : ''
  const thumbUrl    = youtubeId
    ? `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`
    : null

  function save() {
    onUpdate?.({
      title,
      content: { ...card.content, url, note },
    })
  }

  if (isEditing) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* Current preview */}
        {card.content?.url && (
          <div className="link-preview">
            {thumbUrl ? (
              <img
                className="link-preview-thumb"
                src={thumbUrl}
                alt="Miniatura"
                loading="lazy"
              />
            ) : (
              <div className="link-preview-meta">
                {favicon && (
                  <img className="link-preview-favicon" src={favicon} alt="" width={14} height={14} />
                )}
                <span className="link-preview-domain">{domain}</span>
              </div>
            )}
            {(card.title || card.content?.url) && (
              <span className="link-preview-title">{card.title || card.content.url}</span>
            )}
          </div>
        )}

        <div className="field">
          <label className="field-label">URL</label>
          <input
            className="field-input"
            type="url"
            value={url}
            placeholder="https://..."
            onChange={(e) => setUrl(e.target.value)}
            onBlur={save}
          />
        </div>

        <div className="field">
          <label className="field-label">Título (opcional)</label>
          <input
            className="field-input"
            type="text"
            value={title}
            placeholder="Nombre del enlace"
            onChange={(e) => setTitle(e.target.value)}
            onBlur={save}
          />
        </div>

        <div className="field">
          <label className="field-label">Nota (opcional)</label>
          <textarea
            className="field-textarea"
            value={note}
            placeholder="Comentario sobre este link..."
            style={{ minHeight: 72 }}
            onChange={(e) => setNote(e.target.value)}
            onBlur={save}
          />
        </div>

        {url && (
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="btn btn-secondary btn-sm"
            style={{ textDecoration: 'none', textAlign: 'center' }}
          >
            Abrir enlace ↗
          </a>
        )}
      </div>
    )
  }

  // Preview mode
  const displayUrl  = card.content?.url || ''
  const displayYtId = getYoutubeId(displayUrl)
  const displayDomain = getDomain(displayUrl)
  const displayThumb  = displayYtId
    ? `https://img.youtube.com/vi/${displayYtId}/hqdefault.jpg`
    : null
  const displayFavicon = displayUrl ? getFavicon(displayUrl) : ''

  if (!displayUrl) {
    return (
      <div className="link-preview">
        <div className="link-preview-thumb-placeholder">
          <span style={{ fontSize: '1.5rem' }}>🔗</span>
        </div>
        <span className="link-preview-title" style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>
          Sin link — toca para editar
        </span>
      </div>
    )
  }

  return (
    <div className="link-preview">
      {displayThumb ? (
        <img
          className="link-preview-thumb"
          src={displayThumb}
          alt="Miniatura"
          loading="lazy"
        />
      ) : (
        <div className="link-preview-meta">
          {displayFavicon && (
            <img className="link-preview-favicon" src={displayFavicon} alt="" width={14} height={14} />
          )}
          <span className="link-preview-domain">{displayDomain}</span>
        </div>
      )}
      {(card.title || displayUrl) && (
        <span className="link-preview-title">{card.title || displayDomain}</span>
      )}
    </div>
  )
}
