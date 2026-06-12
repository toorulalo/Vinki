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

/**
 * Vista compacta en el lienzo: la "torre" con vibraciones.
 */
export function SpotifyTower({ card }) {
  const hasUrl = Boolean(card.content?.url)
  return (
    <div className="spotify-tower">
      <div className="spotify-waves">
        <span></span>
        <span></span>
        <span></span>
      </div>
      <div className="spotify-disc">🎵</div>
      <p className="spotify-tower-label">
        {hasUrl ? 'Sonando' : 'Spotify — doble tap'}
      </p>
    </div>
  )
}

/**
 * Reproductor completo (en el panel de detalles).
 */
export default function SpotifyEmbed({ card, onUpdate }) {
  const embedUrl = getSpotifyEmbed(card.content?.url)
  const playback = card.content?.playback || 'local'

  return (
    <div className="spotify-panel">
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
          defaultValue={card.content?.url || ''}
          placeholder="https://open.spotify.com/playlist/..."
          onBlur={(e) =>
            onUpdate(card.id, {
              content: { ...card.content, url: e.target.value }
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
              name={`pb-${card.id}`}
              checked={playback === 'local'}
              onChange={() =>
                onUpdate(card.id, {
                  content: { ...card.content, playback: 'local' }
                })
              }
            />
            Normal (suena parejo)
          </label>
          <label className="mode-option">
            <input
              type="radio"
              name={`pb-${card.id}`}
              checked={playback === 'spatial'}
              onChange={() =>
                onUpdate(card.id, {
                  content: { ...card.content, playback: 'spatial' }
                })
              }
            />
            En el lienzo (se aleja al alejarte)
          </label>
        </div>
      </div>
    </div>
  )
}
