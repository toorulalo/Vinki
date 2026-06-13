import { useState, useRef, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { getYoutubeId, getDomain } from '../lib/linkPreview'
import { compressImage } from '../lib/compressImage'
import { loadYouTubeAPI } from '../lib/youtubeApi'
import SpotifyEmbed from './SpotifyEmbed'

const TYPE_LABEL = {
  note: 'Nota',
  link: 'Link',
  image: 'Imagen',
  pdf: 'PDF',
  timer: 'Temporizador',
  spotify: 'Música'
}

export default function CardEditPanel({
  card,
  onUpdate,
  onRemove,
  onSendToVrop,
  onClose,
  readOnly = false
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

        {readOnly ? (
          <ReadOnlyView card={card} onUpdate={onUpdate} />
        ) : (
          <>
            {card.type === 'note' && <NoteEditor card={card} onUpdate={onUpdate} />}
            {card.type === 'link' && <LinkEditor card={card} onUpdate={onUpdate} />}
            {card.type === 'image' && <ImageEditor card={card} onUpdate={onUpdate} />}
            {card.type === 'pdf' && <PdfEditor card={card} onUpdate={onUpdate} />}
            {card.type === 'spotify' && (
              <SpotifyEmbed card={card} onUpdate={onUpdate} />
            )}
            {card.type === 'timer' && (
              <p className="canvas-empty" style={{ margin: '8px 0' }}>
                El temporizador funciona directo en el lienzo. Cerrá este panel y
                tocá Iniciar.
              </p>
            )}

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
          </>
        )}
      </div>
    </div>
  )
}

function ReadOnlyView({ card, onUpdate }) {
  if (card.type === 'note') {
    return (
      <p className="panel-note-text" style={{ whiteSpace: 'pre-wrap' }}>
        {card.content?.text || '(nota vacía)'}
      </p>
    )
  }

  if (card.type === 'link') {
    const youtubeId = getYoutubeId(card.content?.url)
    const domain = getDomain(card.content?.url)
    return (
      <div className="panel-link-body">
        {youtubeId ? (
          <YoutubeWithNotes
            videoId={youtubeId}
            card={card}
            onUpdate={onUpdate}
            editable={false}
          />
        ) : card.content?.url ? (
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
        ) : (
          <p className="canvas-empty">(sin link)</p>
        )}
        {card.title && <p className="card-link-title-static">{card.title}</p>}
        {card.content?.note && (
          <p className="vrop-item-note">"{card.content.note}"</p>
        )}
      </div>
    )
  }

  if (card.type === 'image') {
    return card.content?.url ? (
      <img className="panel-image-preview" src={card.content.url} alt="" />
    ) : (
      <p className="canvas-empty">(sin imagen)</p>
    )
  }

  if (card.type === 'pdf') {
    return card.content?.url ? (
      <iframe
        className="panel-pdf-frame"
        src={card.content.url}
        title={card.content.filename || 'PDF'}
      />
    ) : (
      <p className="canvas-empty">(sin archivo)</p>
    )
  }

  if (card.type === 'spotify') {
    return <SpotifyEmbed card={card} onUpdate={() => {}} readOnly />
  }

  return (
    <p className="canvas-empty" style={{ margin: '8px 0' }}>
      Vista de solo lectura.
    </p>
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
        <YoutubeWithNotes
          videoId={youtubeId}
          card={card}
          onUpdate={onUpdate}
          editable
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

function PdfEditor({ card, onUpdate }) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  async function handleFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const name = file.name || ''
    const isPdf =
      file.type === 'application/pdf' || /\.pdf$/i.test(name)
    if (!isPdf) {
      setError('Solo se permiten archivos PDF.')
      return
    }
    setUploading(true)
    setError('')

    const path = `${card.id}-${Date.now()}.pdf`
    const { error: uploadError } = await supabase.storage
      .from('card-pdfs')
      .upload(path, file, {
        upsert: true,
        contentType: 'application/pdf'
      })

    if (uploadError) {
      setUploading(false)
      setError('No se pudo subir el PDF.')
      return
    }

    const { data } = supabase.storage.from('card-pdfs').getPublicUrl(path)
    setUploading(false)
    onUpdate(card.id, {
      title: card.title || name.replace(/\.pdf$/i, ''),
      content: { ...card.content, url: data.publicUrl, filename: name }
    })
  }

  // Visor con Google Docs Viewer: funciona bien dentro de un iframe en
  // celulares, donde el visor nativo del navegador a veces no carga PDFs
  // dentro de iframes.
  const viewerUrl = card.content?.url
    ? `https://docs.google.com/gview?embedded=true&url=${encodeURIComponent(card.content.url)}`
    : null

  return (
    <div className="panel-pdf-body">
      {viewerUrl ? (
        <>
          <iframe
            className="panel-pdf-frame"
            src={viewerUrl}
            title={card.content.filename || 'PDF'}
          />
          <a
            className="btn-pill"
            href={card.content.url}
            target="_blank"
            rel="noreferrer"
            style={{ textAlign: 'center', textDecoration: 'none' }}
          >
            Abrir en pantalla completa
          </a>
        </>
      ) : (
        <p className="canvas-empty" style={{ margin: '8px 0' }}>
          Subí un PDF desde tu dispositivo o Google Drive (aparece en el
          selector de archivos).
        </p>
      )}

      <label className="file-input-label">
        {uploading
          ? 'Subiendo...'
          : card.content?.url
          ? 'Cambiar PDF'
          : 'Elegir archivo PDF'}
        <input
          className="file-input"
          type="file"
          accept="application/pdf,.pdf"
          onChange={handleFile}
          disabled={uploading}
        />
      </label>

      {error && <p className="message error">{error}</p>}
    </div>
  )
}

// --- Helpers de notas por timestamp en YouTube ---

function formatTime(totalSec) {
  const s = Math.max(0, Math.round(totalSec || 0))
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${m}:${String(r).padStart(2, '0')}`
}

// Acepta "1:23", "83" o "1m23s"
function parseTime(input) {
  if (!input) return null
  const clean = input.trim()
  if (/^\d+$/.test(clean)) return Number(clean)
  const mmss = clean.match(/^(\d+):(\d{1,2})$/)
  if (mmss) return Number(mmss[1]) * 60 + Number(mmss[2])
  const ms = clean.match(/^(?:(\d+)m)?\s*(?:(\d+)s)?$/)
  if (ms && (ms[1] || ms[2])) {
    return Number(ms[1] || 0) * 60 + Number(ms[2] || 0)
  }
  return null
}

/**
 * Reproductor de YouTube embebido con notas por timestamp. Se usa en
 * tarjetas de tipo "link" cuando el link es un video de YouTube.
 * En modo `editable` permite agregar/eliminar notas; en solo lectura, las
 * notas se pueden ver y usar para saltar a ese momento.
 */
function YoutubeWithNotes({ videoId, card, onUpdate, editable }) {
  const playerInstanceRef = useRef(null)
  const containerId = `yt-link-${card.id}`
  const notes = card.content?.ytNotes || []

  const [ready, setReady] = useState(false)
  const [noteTime, setNoteTime] = useState('')
  const [noteText, setNoteText] = useState('')
  const [noteError, setNoteError] = useState('')

  useEffect(() => {
    if (!videoId) return
    let cancelled = false
    setReady(false)

    loadYouTubeAPI().then((YT) => {
      if (cancelled) return
      if (playerInstanceRef.current) {
        playerInstanceRef.current.destroy()
        playerInstanceRef.current = null
      }
      playerInstanceRef.current = new YT.Player(containerId, {
        videoId,
        width: '100%',
        height: '100%',
        playerVars: { rel: 0, modestbranding: 1 },
        events: {
          onReady: () => {
            if (!cancelled) setReady(true)
          }
        }
      })
    })

    return () => {
      cancelled = true
      if (playerInstanceRef.current) {
        playerInstanceRef.current.destroy()
        playerInstanceRef.current = null
      }
    }
  }, [videoId, containerId])

  function seekTo(seconds) {
    const player = playerInstanceRef.current
    if (player && ready) {
      player.seekTo(seconds, true)
      player.playVideo()
    }
  }

  function useCurrentTime() {
    const player = playerInstanceRef.current
    if (player && ready) {
      const t = player.getCurrentTime?.()
      if (typeof t === 'number') setNoteTime(formatTime(t))
    }
  }

  function addNote() {
    setNoteError('')
    const parsed = parseTime(noteTime)
    if (parsed === null) {
      setNoteError('Tiempo inválido. Usá formato 1:23 o segundos.')
      return
    }
    if (!noteText.trim()) {
      setNoteError('Escribí una nota.')
      return
    }
    const newNote = { id: `${Date.now()}`, time: parsed, text: noteText.trim() }
    const updated = [...notes, newNote].sort((a, b) => a.time - b.time)
    onUpdate(card.id, { content: { ...card.content, ytNotes: updated } })
    setNoteTime('')
    setNoteText('')
  }

  function removeNote(id) {
    onUpdate(card.id, {
      content: { ...card.content, ytNotes: notes.filter((n) => n.id !== id) }
    })
  }

  return (
    <>
      <div className="music-player-wrap" style={{ aspectRatio: '16 / 9' }}>
        <div id={containerId} style={{ width: '100%', height: '100%' }} />
      </div>

      <div className="video-notes">
        <h4 className="video-notes-title">Notas del video</h4>

        {notes.length === 0 && (
          <p className="canvas-empty" style={{ margin: '0 0 8px', fontSize: '0.85rem' }}>
            {editable
              ? 'Marcá momentos del video con una nota.'
              : 'Sin notas todavía.'}
          </p>
        )}

        {notes.map((n) => (
          <div className="video-note-row" key={n.id}>
            <button
              type="button"
              className="video-note-time"
              onClick={() => seekTo(n.time)}
              disabled={!ready}
              title="Ir a este momento"
            >
              {formatTime(n.time)}
            </button>
            <span className="video-note-text">{n.text}</span>
            {editable && (
              <button
                type="button"
                className="card-control-btn video-note-del"
                onClick={() => removeNote(n.id)}
                aria-label="Eliminar nota"
              >
                ×
              </button>
            )}
          </div>
        ))}

        {editable && (
          <div className="video-note-add">
            <input
              className="card-link-input video-note-time-input"
              type="text"
              placeholder="1:23"
              value={noteTime}
              onChange={(e) => setNoteTime(e.target.value)}
            />
            <input
              className="card-link-input"
              type="text"
              placeholder="Nota para este momento"
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  addNote()
                }
              }}
            />
            <button
              type="button"
              className="btn-pill btn-pill-muted"
              onClick={useCurrentTime}
              disabled={!ready}
            >
              Ahora
            </button>
            <button type="button" className="btn-pill" onClick={addNote}>
              Agregar
            </button>
          </div>
        )}
        {noteError && <p className="message error">{noteError}</p>}
      </div>
    </>
  )
}
