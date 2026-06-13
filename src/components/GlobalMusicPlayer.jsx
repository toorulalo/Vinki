import { useMusicPlayer } from '../lib/MusicPlayerContext'

export default function GlobalMusicPlayer() {
  const m = useMusicPlayer()
  if (!m?.videoId) return null

  return (
    <div className="global-music-bar">
      <span className="global-music-icon">🎵</span>
      <span className="global-music-title">{m.title || 'Reproduciendo música'}</span>
      <button
        type="button"
        className="global-music-btn"
        onClick={m.togglePlay}
        aria-label={m.playing ? 'Pausar' : 'Reproducir'}
      >
        {m.playing ? '⏸' : '▶'}
      </button>
      <button type="button" className="global-music-btn" onClick={m.close} aria-label="Cerrar">
        ×
      </button>
    </div>
  )
}
