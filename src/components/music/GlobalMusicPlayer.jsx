import { useState, useRef, useEffect } from 'react'
import { useMusicPlayer } from '../../lib/MusicPlayerContext'
import { getYoutubeId } from '../../lib/linkPreview'

export default function GlobalMusicPlayer() {
  const { url, setUrl, isPlaying, setIsPlaying, volume, setVolume } = useMusicPlayer()
  const [inputValue, setInputValue] = useState('')
  const [open, setOpen] = useState(false)
  const iframeRef = useRef(null)

  const ytId = getYoutubeId(url)

  // Sync input with current URL
  useEffect(() => {
    setInputValue(url)
  }, [url])

  // Control the embedded player via the YouTube iframe API — never remount the
  // iframe on play/pause (a remount restarts the track from the beginning).
  function postCommand(func, args = []) {
    iframeRef.current?.contentWindow?.postMessage(
      JSON.stringify({ event: 'command', func, args }),
      '*'
    )
  }

  useEffect(() => {
    if (ytId) postCommand('setVolume', [Math.round(volume * 100)])
  }, [volume, ytId])

  function handleIframeLoad() {
    // Apply current volume/pause state once the player is ready.
    setTimeout(() => {
      postCommand('setVolume', [Math.round(volume * 100)])
      if (!isPlaying) postCommand('pauseVideo')
    }, 600)
  }

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
    const next = !isPlaying
    postCommand(next ? 'playVideo' : 'pauseVideo')
    setIsPlaying(next)
  }

  function handleClear() {
    setUrl('')
    setInputValue('')
    setIsPlaying(false)
  }

  // Build iframe src — autoplay on mount; play/pause afterwards go through postMessage
  function iframeSrc() {
    if (!ytId) return ''
    return `https://www.youtube.com/embed/${ytId}?enablejsapi=1&loop=1&playlist=${ytId}&autoplay=1`
  }

  return (
    <>
      {/* Collapsed pill button — always visible */}
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          title="Abrir reproductor de música"
          style={{
            position: 'fixed',
            bottom: 16,
            right: 16,
            zIndex: 40,
            width: 44,
            height: 44,
            borderRadius: '50%',
            background: 'var(--bg-surface)',
            border: '1px solid var(--border)',
            boxShadow: 'var(--shadow-md)',
            fontSize: 20,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
          aria-label="Abrir reproductor de música"
        >
          🎵
        </button>
      )}

      {/* Expanded player panel */}
      {open && (
        <div
          style={{
            position: 'fixed',
            bottom: 16,
            right: 16,
            zIndex: 40,
            background: 'var(--bg-surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            boxShadow: 'var(--shadow-md)',
            padding: '10px 12px',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            minWidth: 280,
          }}
          className="music-player-bar"
        >
          {/* Music icon — click to collapse */}
          <span
            style={{ fontSize: 18, flexShrink: 0, cursor: 'pointer', userSelect: 'none' }}
            onClick={() => setOpen(false)}
            title="Cerrar reproductor"
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
        </div>
      )}

      {/* Hidden YouTube iframe — only mounted when a URL is set */}
      {ytId && (
        <iframe
          ref={iframeRef}
          key={ytId}
          onLoad={handleIframeLoad}
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
    </>
  )
}
