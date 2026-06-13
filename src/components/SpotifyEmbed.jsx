import { useState } from 'react'
import { getYoutubeId } from '../lib/linkPreview'
import { useMusicPlayer } from '../lib/MusicPlayerContext'

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
 * Vista compacta en el lienzo: el "disco" es un botón real de play/pause
 * conectado al reproductor global (MusicPlayerContext). La música sigue
 * sonando aunque se cierre la tarjeta o se cambie de lienzo.
 */
export function SpotifyTower({ card }) {
  const m = useMusicPlayer()
  const videoId = getYoutubeId(card.content?.url)
  const isThis = Boolean(videoId) && m?.videoId === videoId
  const isPlaying = isThis && m.playing

  function toggle(e) {
    e.stopPropagation()
    if (!videoId || !m) return
    if (isThis) m.togglePlay()
    else m.play(videoId, { title: card.title || 'Música' })
  }

  return (
    <div className="spotify-tower">
      <div className={`spotify-waves${isPlaying ? ' playing' : ''}`}>
        <span></span>
        <span></span>
        <span></span>
      </div>
      <button
        type="button"
        className="spotify-disc"
        onClick={toggle}
        aria-label={isPlaying ? 'Pausar' : 'Reproducir'}
      >
        {videoId ? (isPlaying ? '⏸' : '▶') : '🎵'}
      </button>
      <p className="spotify-tower-label">
        {videoId ? (isPlaying ? 'Sonando' : 'Tocá para reproducir') : 'Música — doble tap'}
      </p>
    </div>
  )
}

/**
 * Panel de detalle de la tarjeta "Música": un link de YouTube + notas por
 * momento. El play/pause controla el reproductor global, que sigue
 * sonando aunque se cierre este panel — se puede pausar/cerrar desde la
 * barra fija de arriba (GlobalMusicPlayer).
 */
export default function SpotifyEmbed({ card, onUpdate, readOnly = false }) {
  const content = card.content || {}
  const m = useMusicPlayer()
  const videoId = getYoutubeId(content.url)
  const notes = content.ytNotes || []
  const isThis = Boolean(videoId) && m?.videoId === videoId
  const isPlaying = isThis && m.playing

  const [noteTime, setNoteTime] = useState('')
  const [noteText, setNoteText] = useState('')
  const [noteError, setNoteError] = useState('')

  function setContent(patch) {
    onUpdate(card.id, { content: { ...content, ...patch } })
  }

  function handlePlayToggle() {
    if (!videoId || !m) return
    if (isThis) m.togglePlay()
    else m.play(videoId, { title: card.title || 'Música' })
  }

  function seekTo(seconds) {
    if (!videoId || !m) return
    if (isThis) {
      m.seekTo(seconds)
      m.resume()
    } else {
      m.play(videoId, { title: card.title || 'Música', startSeconds: seconds })
    }
  }

  function useCurrentTime() {
    if (isThis) setNoteTime(formatTime(m.currentTime))
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
    setContent({ ytNotes: updated })
    setNoteTime('')
    setNoteText('')
  }

  function removeNote(id) {
    setContent({ ytNotes: notes.filter((n) => n.id !== id) })
  }

  return (
    <div className="spotify-panel">
      {videoId ? (
        <div className="music-now-playing">
          <button type="button" className="btn-primary music-play-btn" onClick={handlePlayToggle}>
            {isPlaying ? '⏸ Pausar' : '▶ Reproducir'}
          </button>
          {isThis && <span className="music-now-time">{formatTime(m.currentTime)}</span>}
          <p className="music-now-hint">
            La música sigue sonando aunque cierres esta tarjeta — controlala
            desde la barra de arriba.
          </p>
        </div>
      ) : (
        <p className="canvas-empty" style={{ margin: '8px 0' }}>
          Pegá un link de YouTube (canción, video o lista de reproducción).
        </p>
      )}

      {!readOnly && (
        <div className="field">
          <label>Link de YouTube</label>
          <input
            className="card-link-input"
            type="url"
            defaultValue={content.url || ''}
            placeholder="https://www.youtube.com/watch?v=..."
            onBlur={(e) => setContent({ url: e.target.value, source: 'youtube' })}
          />
        </div>
      )}

      {videoId && (
        <div className="video-notes">
          <h4 className="video-notes-title">Notas por momento</h4>

          {notes.length === 0 && (
            <p className="canvas-empty" style={{ margin: '0 0 8px', fontSize: '0.85rem' }}>
              {readOnly
                ? 'Sin notas todavía.'
                : 'Marcá momentos del video con una nota — útil para retomar dónde quedaron escuchando.'}
            </p>
          )}

          {notes.map((n) => (
            <div className="video-note-row" key={n.id}>
              <button
                type="button"
                className="video-note-time"
                onClick={() => seekTo(n.time)}
                title="Ir a este momento"
              >
                {formatTime(n.time)}
              </button>
              <span className="video-note-text">{n.text}</span>
              {!readOnly && (
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

          {!readOnly && (
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
                disabled={!isThis}
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
      )}
    </div>
  )
}
