import { useState } from 'react'
import { getDomain, getYoutubeId } from '../lib/linkPreview'
import { IconNote, IconLinkCard, IconClose } from './icons/index.jsx'

const TYPE_LABEL = { note: 'Nota', link: 'Link' }
const TYPE_ICON  = { note: IconNote, link: IconLinkCard }

export default function CardEditPanel({ card, onUpdate, onRemove, onSendToVrop, onClose, readOnly = false }) {
  const TypeIcon = TYPE_ICON[card.type] || IconNote
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal card-edit-panel" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span className="panel-type-label"><TypeIcon size={14} />{TYPE_LABEL[card.type]}</span>
          <button type="button" className="btn-icon" onClick={onClose} aria-label="Cerrar"><IconClose size={18} /></button>
        </div>

        {readOnly ? (
          <ReadOnlyView card={card} />
        ) : (
          <>
            {card.type === 'note' && <NoteEditor card={card} onUpdate={onUpdate} />}
            {card.type === 'link' && <LinkEditor card={card} onUpdate={onUpdate} />}
            <div className="panel-actions">
              {onSendToVrop && (
                <button type="button" className="btn-pill btn-pill-ghost" onClick={() => onSendToVrop(card)}>
                  Enviar a Vrop It
                </button>
              )}
              {onRemove && (
                <button type="button" className="btn-pill btn-pill-danger" onClick={() => onRemove(card.id)}>
                  Eliminar
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function ReadOnlyView({ card }) {
  if (card.type === 'note') return (
    <p style={{ whiteSpace: 'pre-wrap', fontSize: '0.95rem', lineHeight: 1.55 }}>
      {card.content?.note || '(nota vacía)'}
    </p>
  )
  if (card.type === 'link') {
    const youtubeId = getYoutubeId(card.content?.url)
    const domain = getDomain(card.content?.url)
    return (
      <div className="link-body">
        {card.content?.url && (
          <a className="link-chip" href={card.content.url} target="_blank" rel="noreferrer">
            <img className="link-chip-favicon" src={`https://www.google.com/s2/favicons?domain=${domain}&sz=32`} alt="" />
            <span className="link-chip-domain">{domain}</span>
          </a>
        )}
        {youtubeId && (
          <iframe style={{ width: '100%', aspectRatio: '16/9', border: 'none', borderRadius: 10 }}
            src={`https://www.youtube.com/embed/${youtubeId}`} allowFullScreen title="YouTube" />
        )}
        {card.title && <p className="link-title-static">{card.title}</p>}
        {card.content?.note && <p style={{ fontSize: '0.88rem', color: 'var(--ink-soft)', fontStyle: 'italic' }}>"{card.content.note}"</p>}
      </div>
    )
  }
  return <p style={{ color: 'var(--ink-soft)' }}>Vista de solo lectura.</p>
}

function NoteEditor({ card, onUpdate }) {
  const [text, setText] = useState(card.content?.note || '')
  return (
    <textarea className="note-textarea" value={text} placeholder="Escribí tu nota..." autoFocus
      onChange={(e) => setText(e.target.value)}
      onBlur={() => onUpdate(card.id, { content: { ...card.content, note: text } })} />
  )
}

function LinkEditor({ card, onUpdate }) {
  const [url,   setUrl]   = useState(card.content?.url   || '')
  const [title, setTitle] = useState(card.title          || '')
  const [note,  setNote]  = useState(card.content?.note  || '')
  const youtubeId = getYoutubeId(card.content?.url)
  const domain    = getDomain(card.content?.url)

  function save() { onUpdate(card.id, { title, content: { ...card.content, url, note } }) }

  return (
    <div className="link-body">
      {card.content?.url && (
        <a className="link-chip" href={card.content.url} target="_blank" rel="noreferrer">
          <img className="link-chip-favicon" src={`https://www.google.com/s2/favicons?domain=${domain}&sz=32`} alt="" />
          <span className="link-chip-domain">{domain}</span>
        </a>
      )}
      {youtubeId && (
        <iframe style={{ width: '100%', aspectRatio: '16/9', border: 'none', borderRadius: 10 }}
          src={`https://www.youtube.com/embed/${youtubeId}`} allowFullScreen title="YouTube" />
      )}
      <div className="field">
        <label className="field-label">URL</label>
        <input className="field-input" type="url" value={url} placeholder="https://..."
          onChange={(e) => setUrl(e.target.value)} onBlur={save} />
      </div>
      <div className="field">
        <label className="field-label">Título</label>
        <input className="field-input" type="text" value={title} placeholder="Título (opcional)"
          onChange={(e) => setTitle(e.target.value)} onBlur={save} />
      </div>
      <div className="field">
        <label className="field-label">Nota</label>
        <textarea className="field-textarea" value={note} placeholder="Comentario (opcional)" style={{ minHeight: 72 }}
          onChange={(e) => setNote(e.target.value)} onBlur={save} />
      </div>
    </div>
  )
}
