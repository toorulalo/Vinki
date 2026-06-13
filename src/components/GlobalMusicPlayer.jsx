import { useMusicPlayer } from '../lib/MusicPlayerContext';

export default function GlobalMusicPlayer() {
  const player = useMusicPlayer();
  if (!player?.videoId) return null;
  return (
    <div className="global-music-bar">
      <span className="global-music-icon">🎵</span>
      <span className="global-music-title">{player.title || 'Reproduciendo música'}</span>
      <button
        type="button"
        className="global-music-btn"
        onClick={player.togglePlay}
        aria-label={player.playing ? 'Pausar' : 'Reproducir'}
      >
        {player.playing ? '⏸' : '▶'}
      </button>
      <button type="button" className="global-music-btn" onClick={player.close} aria-label="Cerrar">×</button>
    </div>
  );
}
