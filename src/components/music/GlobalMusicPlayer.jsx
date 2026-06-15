import { useState, useRef, useEffect } from 'react'
import { useMusicPlayer } from '../../lib/MusicPlayerContext'
import { getYoutubeId } from '../../lib/linkPreview'

export default function GlobalMusicPlayer() {
  const { url, setUrl, isPlaying, setIsPlaying, volume, setVolume } = useMusicPlayer()
  const [inputValue, setInputValue] = useState('')
  const [expanded, setExpanded] = useState(false)
  const iframeRef = useRef(null)

  const ytId = getYoutubeId(url)

  // Sync input with current URL
  useEffect(() => {
    setInputValue(url)
  }, [url])

  function handleInputChange(e) {
    const val = e.target.value
    setInputValue(val)
    const id = getYoutubeId(val)
    if (id) {
      setUrl(val)
      setIsPlaying(true)
    } else if (!val) {
      setUrl('')
      setIsPlaying(false)
    }
  }

  function handleInputPaste(e) {
    // Give the paste a tick to land before reading value
    setTimeout(() => {
      const val = e.target.value
      setInputValue(val)
      const id = getYoutubeId(val)
      if (id) {
        setUrl(val)
        setIsPlaying(true)
      }
    }, 0)
  }

  function togglePlay() {
    if (!ytId) return
    setIsPlaying(p => !p)
  }

  function handleClear() {
    setUrl('')
    setInputValue('')
    setIsPlaying(false)
  }

  // Build iframe src
  function iframeSrc() {
    if (!ytId) return ''
    const base = `https://www.youtube.com/embed/${ytId}?enablejsapi=1&loop=1&playlist=${ytId}`
    return isPlaying ? `${base}&autoplay=1` : base
  }

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        height: expanded ? 64 : 48,
        background: 'var(--bg-surface)',
        borderTop: '1px solid var(--border)',
        zIndex: 40,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '0 12px',
        transition: 'height 0.2s ease',
        boxShadow: 'var(--shadow-md)',
      }}
      className="music-player-bar"
    >
      {/* Music icon + label */}
      <span
        style={{ fontSize: 18, flexShrink: 0, cursor: 'pointer', userSelect: 'none' }}
        onClick={() => setExpanded(e => !e)}
        title="Música"
      >
        🎵
      </span>

      {/* URL input */}
      <input
        type="text"
        placeholder="URL de YouTube..."
        value={inputValue}
        onChange={handleInputChange}
        onPaste={handleInputPaste}
        style={{
          flex: 1,
          background: 'var(--bg-surface-2)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)',
          padding: '5px 10px',
          fontSize: 'var(--text-xs)',
          color: 'var(--text-primary)',
          outline: 'none',
          minWidth: 0,
        }}
        aria-label="URL de YouTube"
      />

      {/* Clear button — only when URL is set */}
      {url && (
        <button
          type="button"
          className="btn btn-ghost btn-sm btn-icon"
          onClick={handleClear}
          aria-label="Limpiar"
          style={{ flexShrink: 0, fontSize: 14 }}
        >
          ✕
        </button>
      )}

      {/* Play/Pause toggle */}
      <button
        type="button"
        className="btn btn-ghost btn-sm btn-icon"
        onClick={togglePlay}
        disabled={!ytId}
        aria-label={isPlaying ? 'Pausar' : 'Reproducir'}
        style={{ flexShrink: 0, fontSize: 16, opacity: ytId ? 1 : 0.4 }}
      >
        {isPlaying ? '⏸' : '▶️'}
      </button>

      {/* Volume slider */}
      <input
        type="range"
        min={0}
        max={1}
        step={0.05}
        value={volume}
        onChange={e => setVolume(parseFloat(e.target.value))}
        aria-label="Volumen"
        style={{ width: 64, flexShrink: 0, accentColor: 'var(--color-primary)', cursor: 'pointer' }}
      />

      {/* Hidden YouTube iframe — always mounted when URL is set so audio continues */}
      {ytId && (
        <iframe
          ref={iframeRef}
          key={`${ytId}-${isPlaying}`}
          src={iframeSrc()}
          allow="autoplay; encrypted-media"
          allowFullScreen={false}
          title="Reproductor de música"
          style={{
            position: 'fixed',
            width: 1,
            height: 1,
            bottom: 0,
            right: 0,
            opacity: 0,
            pointerEvents: 'none',
            border: 'none',
          }}
        />
      )}
    </div>
  )
}
