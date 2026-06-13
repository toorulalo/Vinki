import { useState, useEffect, useRef } from 'react'
import { getYoutubeId } from '../lib/linkPreview'
import { loadYouTubeAPI } from '../lib/youtubeApi'

function getSpotifyEmbed(url) {
  if (!url) return null
  try {
    const u = new URL(url)
    if (!u.hostname.includes('spotify.com')) return null
    // Formatos: /playlist/ID, /album/ID, /track/ID, /show/ID, /episode/ID
    const parts = u.pathname.split('/').filter(Boolean)
    if (parts.length < 2) return null
    const [kind, id] = parts
    return `https://open.spotify.com/embed/${kind}/${id}`
  } catch {
    return null
  }
}

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
    return (Number(ms[1] || 0) * 60) + Number(ms[2] || 0)
  }
  return null
}

/**
 * Vista compacta en el lienzo: la "torre" con vibraciones.
 * Sirve tanto para Spotify como para YouTube.
 */
export function SpotifyTower({ card }) {
  const source = card.content?.source || 'spotify'
  const hasUrl = Boolean(card.content?.url)
  const icon = source === 'youtube' ? '📺' : '🎵'

  return (
    <div className="spotify-tower">
      <div className="spotify-waves">
        <span></span>
        <span></span>
        <span></span>
      </div>
      <div className="spotify-disc">{icon}</div>
      <p className="spotify-tower-label">
        {hasUrl
          ? source === 'youtube'
            ? 'Música — YouTube'
            : 'Sonando'
          : 'Música — doble tap'}
      </p>
    </div>
  )
}

/**
 * Reproductor completo (en el panel de detalles).
 * - source: 'spotify' (embed normal de Spotify)
 * - source: 'youtube' (reproductor de YouTube con notas por timestamp)
 */
export default function SpotifyEmbed({ card, onUpdate }) {
  const content = card.content || {}
  const source = content.source || 'spotify'
  const playback = content.playback || 'local'

  function setContent(patch) {
    onUpdate(card.id, { content: { ...content, ...patch } })
  }

  function switchSource(next) {
    if (next === source) return
    setContent({ source: next })
  }

  return (
    <div className="spotify-panel">
      <div className="field">
        <label>Fuente</label>
        <div className="mode-options">
          <label className="mode-option">
            <input
              type="radio"
              name={`src-${card.id}`}
              checked={source === 'spotify'}
              onChange={() => switchSource('spotify')}
            />
            Spotify
          </label>
          <label className="mode-option">
            <input
              type="radio"
              name={`src-${card.id}`}
              checked={source === 'youtube'}
              onChange={() => switchSource('youtube')}
            />
            YouTube (en vivo, con notas)
          </label>
        </div>
      </div>

      {source === 'spotify' ? (
        <SpotifyMode
          content={content}
          playback={playback}
          cardId={card.id}
          onUpdate={onUpdate}
        />
      ) : (
        <YouTubeMusicMode
          content={content}
          cardId={card.id}
          setContent={setContent}
        />
      )}
    </div>
  )
}

function SpotifyMode({ content, playback, cardId, onUpdate }) {
  const embedUrl = getSpotifyEmbed(content.url)

  return (
    <>
      {embedUrl ? (
        <iframe
          className="spotify-iframe"
          src={embedUrl}
          title="Spotify"
          allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
          loading="lazy"
        />
      ) : (
        <p className="canvas-empty" style={{ margin: '8px 0' }}>
          Pegá un link de playlist, álbum o canción de Spotify.
        </p>
      )}

      <div className="field">
        <label>Link de Spotify</label>
        <input
          className="card-link-input"
          type="url"
          defaultValue={content.url || ''}
          placeholder="https://open.spotify.com/playlist/..."
          onBlur={(e) =>
            onUpdate(cardId, {
              content: { ...content, url: e.target.value }
            })
          }
        />
      </div>

      <div className="field">
        <label>Cómo se escucha</label>
        <div className="mode-options">
          <label className="mode-option">
            <input
              type="radio"
              name={`pb-${cardId}`}
              checked={playback === 'local'}
              onChange={() =>
                onUpdate(cardId, {
                  content: { ...content, playback: 'local' }
                })
              }
            />
            Normal (suena parejo)
          </label>
          <label className="mode-option">
            <input
              type="radio"
              name={`pb-${cardId}`}
              checked={playback === 'spatial'}
              onChange={() =>
                onUpdate(cardId, {
                  content: { ...content, playback: 'spatial' }
                })
              }
            />
            En el lienzo (se aleja al alejarte)
          </label>
        </div>
      </div>
    </>
  )
}

function YouTubeMusicMode({ content, cardId, setContent }) {
  const videoId = getYoutubeId(content.url)
  const notes = content.ytNotes || []

  const playerRef = useRef(null)
  const playerInstanceRef = useRef(null)
  const containerId = `yt-music-${cardId}`

  const [ready, setReady] = useState(false)
  const [noteTime, setNoteTime] = useState('')
  const [noteText, setNoteText] = useState('')
  const [noteError, setNoteError] = useState('')

  // Crear / recrear el player de YouTube cuando cambia el video
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
        playerVars: {
          rel: 0,
          modestbranding: 1
        },
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
    const newNote = {
      id: `${Date.now()}`,
      time: parsed,
      text: noteText.trim()
    }
    const updated = [...notes, newNote].sort((a, b) => a.time - b.time)
    setContent({ ytNotes: updated })
    setNoteTime('')
    setNoteText('')
  }

  function removeNote(id) {
    setContent({ ytNotes: notes.filter((n) => n.id !== id) })
  }

  function useCurrentTime() {
    const player = playerInstanceRef.current
    if (player && ready) {
      const t = player.getCurrentTime?.()
      if (typeof t === 'number') {
        setNoteTime(formatTime(t))
      }
    }
  }

  return (
    <>
      {videoId ? (
        <div className="music-player-wrap" style={{ aspectRatio: '16 / 9' }}>
          <div id={containerId} ref={playerRef} style={{ width: '100%', height: '100%' }} />
        </div>
      ) : (
        <p className="canvas-empty" style={{ margin: '8px 0' }}>
          Pegá un link de YouTube (canción, video o lista de reproducción).
        </p>
      )}

      <div className="field">
        <label>Link de YouTube</label>
        <input
          className="card-link-input"
          type="url"
          defaultValue={content.url || ''}
          placeholder="https://www.youtube.com/watch?v=..."
          onBlur={(e) => setContent({ url: e.target.value })}
        />
      </div>

      {videoId && (
        <div className="video-notes">
          <h4 className="video-notes-title">Notas por momento</h4>

          {notes.length === 0 && (
            <p className="canvas-empty" style={{ margin: '0 0 8px', fontSize: '0.85rem' }}>
              Marcá momentos del video con una nota — útil para retomar dónde
              quedaron escuchando.
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
              <button
                type="button"
                className="card-control-btn video-note-del"
                onClick={() => removeNote(n.id)}
                aria-label="Eliminar nota"
              >
                ×
              </button>
            </div>
          ))}

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
            <button type="button" className="btn-pill btn-pill-muted" onClick={useCurrentTime} disabled={!ready}>
              Ahora
            </button>
            <button type="button" className="btn-pill" onClick={addNote}>
              Agregar
            </button>
          </div>
          {noteError && <p className="message error">{noteError}</p>}
        </div>
      )}
    </>
  )
}
