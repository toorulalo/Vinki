import { useState } from 'react'
import { getDomain, getYoutubeId } from '../lib/linkPreview'
import { compressImage } from '../lib/compressImage'
import { supabase } from '../lib/supabaseClient'
import { TYPE_ICON, TYPE_LABEL } from './CardItem'
import { IconClose, IconUpload } from './icons/index.jsx'

export default function CardEditPanel({
  card,
  onUpdate,
  onRemove,
  onSendToVrop,
  onClose,
  onOpenDeck,
  readOnly = false,
}) {
  const TypeIcon = TYPE_ICON[card.type] || TYPE_ICON.note

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal card-edit-panel" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span className="panel-type-label">
            <TypeIcon size={14} />{TYPE_LABEL[card.type] || card.type}
          </span>
          <button type="button" className="btn-icon" onClick={onClose} aria-label="Cerrar">
            <IconClose size={18} />
          </button>
        </div>

        {readOnly ? (
          <ReadOnlyView card={card} />
        ) : (
          <>
            {card.type === 'note'  && <NoteEditor  card={card} onUpdate={onUpdate} />}
            {card.type === 'link'  && <LinkEditor  card={card} onUpdate={onUpdate} />}
            {card.type === 'image' && <ImageEditor card={card} onUpdate={onUpdate} />}
            {card.type === 'pdf'   && <PdfEditor   card={card} onUpdate={onUpdate} />}
            {card.type === 'deck'  && (
              <DeckProxy card={card} onOpenDeck={onOpenDeck} onClose={onClose} />
            )}

            {card.type !== 'deck' && (
              <div className="panel-actions">
                {onSendToVrop && card.type === 'link' && (
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
            )}

            {card.type === 'deck' && onRemove && (
              <div className="panel-actions" style={{ marginTop: 8 }}>
                <button type="button" className="btn-pill btn-pill-danger" onClick={() => onRemove(card.id)}>
                  Eliminar mazo
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

/* ---- Read-only view ---- */
function ReadOnlyView({ card }) {
  if (card.type === 'note') return (
    <p style={{ whiteSpace: 'pre-wrap', fontSize: '0.95rem', lineHeight: 1.55 }}>
      {card.content?.note || '(nota vacía)'}
    </p>
  )
  if (card.type === 'link') {
    const youtubeId = getYoutubeId(card.content?.url)
    const domain    = getDomain(card.content?.url)
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
  if (card.type === 'image') return (
    <div>
      {card.content?.url
        ? <img src={card.content.url} alt={card.title || ''} style={{ width: '100%', borderRadius: 10, maxHeight: 320, objectFit: 'cover' }} />
        : <p style={{ color: 'var(--ink-soft)' }}>(sin imagen)</p>
      }
      {card.content?.note && <p style={{ fontSize: '0.88rem', color: 'var(--ink-soft)', marginTop: 8 }}>{card.content.note}</p>}
    </div>
  )
  if (card.type === 'pdf') {
    const viewerUrl = card.content?.url
      ? `https://docs.google.com/viewer?url=${encodeURIComponent(card.content.url)}&embedded=true`
      : null
    return viewerUrl
      ? <iframe src={viewerUrl} style={{ width: '100%', height: 360, border: 'none', borderRadius: 10 }} title="PDF" />
      : <p style={{ color: 'var(--ink-soft)' }}>(sin PDF)</p>
  }
  return <p style={{ color: 'var(--ink-soft)' }}>Vista de solo lectura.</p>
}

/* ---- Editores ---- */

function NoteEditor({ card, onUpdate }) {
  const [text, setText] = useState(card.content?.note || '')
  return (
    <textarea
      className="note-textarea"
      value={text}
      placeholder="Escribí tu nota..."
      autoFocus
      onChange={(e) => setText(e.target.value)}
      onBlur={() => onUpdate(card.id, { content: { ...card.content, note: text } })}
    />
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
        <textarea className="field-textarea" value={note} placeholder="Comentario (opcional)"
          style={{ minHeight: 72 }} onChange={(e) => setNote(e.target.value)} onBlur={save} />
      </div>
    </div>
  )
}

function ImageEditor({ card, onUpdate }) {
  const [url,       setUrl]       = useState(card.content?.url  || '')
  const [note,      setNote]      = useState(card.content?.note || '')
  const [uploading, setUploading] = useState(false)
  const [uploadErr, setUploadErr] = useState('')

  async function handleFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true); setUploadErr('')
    try {
      const blob = await compressImage(file)
      const path = `${card.id}/${Date.now()}.jpg`
      const { error: upErr } = await supabase.storage
        .from('card-images')
        .upload(path, blob, { contentType: 'image/jpeg', upsert: true })
      if (upErr) throw upErr
      const { data: { publicUrl } } = supabase.storage.from('card-images').getPublicUrl(path)
      setUrl(publicUrl)
      onUpdate(card.id, { content: { ...card.content, url: publicUrl, note } })
    } catch (err) {
      setUploadErr('No se pudo subir la imagen. Intentá de nuevo.')
    } finally {
      setUploading(false)
    }
  }

  function saveUrl() { onUpdate(card.id, { content: { ...card.content, url, note } }) }
  function saveNote() { onUpdate(card.id, { content: { ...card.content, url, note } }) }

  return (
    <div className="image-editor">
      {url && (
        <img src={url} alt=""
          style={{ width: '100%', borderRadius: 10, maxHeight: 280, objectFit: 'cover', marginBottom: 12 }} />
      )}

      <label className="upload-btn">
        <IconUpload size={16} />
        {uploading ? 'Subiendo...' : 'Subir imagen'}
        <input type="file" accept="image/*" onChange={handleFile} style={{ display: 'none' }} disabled={uploading} />
      </label>

      {uploadErr && <p className="msg msg-error">{uploadErr}</p>}

      <div className="field" style={{ marginTop: 12 }}>
        <label className="field-label">O pegar URL</label>
        <input className="field-input" type="url" value={url} placeholder="https://..."
          onChange={(e) => setUrl(e.target.value)} onBlur={saveUrl} />
      </div>
      <div className="field">
        <label className="field-label">Nota</label>
        <textarea className="field-textarea" value={note} placeholder="Descripción (opcional)"
          style={{ minHeight: 60 }} onChange={(e) => setNote(e.target.value)} onBlur={saveNote} />
      </div>
    </div>
  )
}

function PdfEditor({ card, onUpdate }) {
  const [url,       setUrl]       = useState(card.content?.url || '')
  const [title,     setTitle]     = useState(card.title        || '')
  const [uploading, setUploading] = useState(false)
  const [uploadErr, setUploadErr] = useState('')

  const viewerUrl = url
    ? `https://docs.google.com/viewer?url=${encodeURIComponent(url)}&embedded=true`
    : null

  async function handleFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
    if (!isPdf) { setUploadErr('Solo se aceptan archivos PDF.'); return }
    if (file.size > 25 * 1024 * 1024) { setUploadErr('El PDF debe pesar menos de 25 MB.'); return }
    setUploading(true); setUploadErr('')
    try {
      const path = `${card.id}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
      const { error: upErr } = await supabase.storage
        .from('card-pdfs')
        .upload(path, file, { contentType: 'application/pdf', upsert: true })
      if (upErr) throw upErr
      const { data: { publicUrl } } = supabase.storage.from('card-pdfs').getPublicUrl(path)
      const newTitle = title || file.name.replace('.pdf', '')
      setUrl(publicUrl)
      setTitle(newTitle)
      onUpdate(card.id, { title: newTitle, content: { ...card.content, url: publicUrl } })
    } catch (err) {
      setUploadErr('No se pudo subir el PDF. Revisá los permisos del bucket en Supabase.')
    } finally {
      setUploading(false)
    }
  }

  function save() { onUpdate(card.id, { title, content: { ...card.content, url } }) }

  return (
    <div className="pdf-editor">
      {viewerUrl && (
        <iframe src={viewerUrl}
          style={{ width: '100%', height: 360, border: 'none', borderRadius: 10, marginBottom: 12 }}
          title="PDF" />
      )}

      <label className="upload-btn">
        <IconUpload size={16} />
        {uploading ? 'Subiendo...' : 'Subir PDF (máx 25 MB)'}
        <input type="file" accept=".pdf,application/pdf" onChange={handleFile}
          style={{ display: 'none' }} disabled={uploading} />
      </label>

      {uploadErr && <p className="msg msg-error">{uploadErr}</p>}

      <div className="field" style={{ marginTop: 12 }}>
        <label className="field-label">Título</label>
        <input className="field-input" type="text" value={title} placeholder="Nombre del PDF"
          onChange={(e) => setTitle(e.target.value)} onBlur={save} />
      </div>
      <div className="field">
        <label className="field-label">O pegar URL del PDF</label>
        <input className="field-input" type="url" value={url} placeholder="https://..."
          onChange={(e) => setUrl(e.target.value)} onBlur={save} />
      </div>
    </div>
  )
}

function DeckProxy({ card, onOpenDeck, onClose }) {
  return (
    <div style={{ textAlign: 'center', padding: '16px 0' }}>
      <p style={{ color: 'var(--ink-soft)', fontSize: '0.9rem', marginBottom: 16 }}>
        Este es un mazo de repetición espaciada.
      </p>
      <button type="button" className="btn-primary" onClick={() => { onClose(); onOpenDeck?.(card) }}>
        Abrir mazo
      </button>
    </div>
  )
}
