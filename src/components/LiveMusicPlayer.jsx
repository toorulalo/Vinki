import { useEffect, useRef, useState } from 'react'
import { loadYouTubeAPI } from '../lib/youtubeApi'

const DRIFT_TOLERANCE = 2 // segundos de diferencia tolerados antes de re-sincronizar
const BROADCAST_INTERVAL = 5000 // ms

/**
 * Reproductor de música compartido para la sesión VINKI-VINKI.
 *
 * Cualquiera de los participantes que tenga este panel abierto reproduce
 * el mismo video y transmite (broadcast) su posición/estado cada pocos
 * segundos y ante cada play/pausa/salto. El resto de los que lo tengan
 * abierto ajustan su reproductor para mantenerse "en vivo" juntos.
 *
 * - videoId: id del video de YouTube a reproducir
 * - send(payload): función para emitir por el canal de broadcast de la sesión
 * - incomingSync: último payload recibido con type === 'music_sync' (o null)
 * - onClose: cerrar el panel
 */
export default function LiveMusicPlayer({ videoId, send, incomingSync, onClose }) {
  const playerRef = useRef(null)
  const [ready, setReady] = useState(false)
  const applyingRemoteRef = useRef(false)
  const lastAppliedRef = useRef(0)

  useEffect(() => {
    if (!videoId) return
    let cancelled = false
    setReady(false)

    loadYouTubeAPI().then((YT) => {
      if (cancelled) return
      if (playerRef.current) {
        playerRef.current.destroy()
        playerRef.current = null
      }
      playerRef.current = new YT.Player('live-music-player', {
        videoId,
        width: '100%',
        height: '100%',
        playerVars: { rel: 0, modestbranding: 1, playsinline: 1 },
        events: {
          onReady: () => {
            if (cancelled) return
            setReady(true)
          },
          onStateChange: (e) => {
            if (applyingRemoteRef.current) return
            // 1 = playing, 2 = paused
            if (e.data === 1 || e.data === 2) {
              broadcastState(e.data === 1 ? 'play' : 'pause')
            }
          }
        }
      })
    })

    return () => {
      cancelled = true
      if (playerRef.current) {
        playerRef.current.destroy()
        playerRef.current = null
      }
    }
  }, [videoId])

  // Emitir mi estado periódicamente
  useEffect(() => {
    if (!ready) return
    const interval = setInterval(() => {
      if (!applyingRemoteRef.current) broadcastState('sync')
    }, BROADCAST_INTERVAL)
    return () => clearInterval(interval)
  }, [ready])

  function broadcastState(action) {
    const player = playerRef.current
    if (!player) return
    const time = player.getCurrentTime?.() || 0
    const playing = player.getPlayerState?.() === 1
    send({
      type: 'music_sync',
      action,
      time,
      playing,
      videoId
    })
  }

  // Aplicar lo que llega de la otra persona
  useEffect(() => {
    if (!incomingSync || !ready) return
    if (incomingSync.videoId !== videoId) return
    const player = playerRef.current
    if (!player) return
    if (incomingSync.ts && incomingSync.ts === lastAppliedRef.current) return
    lastAppliedRef.current = incomingSync.ts || Date.now()

    const myTime = player.getCurrentTime?.() || 0
    const drift = Math.abs(myTime - incomingSync.time)

    applyingRemoteRef.current = true
    if (drift > DRIFT_TOLERANCE) {
      player.seekTo(incomingSync.time, true)
    }
    if (incomingSync.playing) {
      player.playVideo?.()
    } else {
      player.pauseVideo?.()
    }
    setTimeout(() => {
      applyingRemoteRef.current = false
    }, 400)
  }, [incomingSync, ready, videoId])

  return (
    <div className="live-music">
      <div className="live-music-header">
        <span>🎧 Música en vivo</span>
        <button
          type="button"
          className="card-control-btn"
          onClick={onClose}
          aria-label="Cerrar"
        >
          ×
        </button>
      </div>
      <div className="music-player-wrap" style={{ aspectRatio: '16 / 9' }}>
        <div id="live-music-player" style={{ width: '100%', height: '100%' }} />
      </div>
    </div>
  )
}
