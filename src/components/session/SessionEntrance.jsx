import { useEffect } from 'react'
import Avatar from '../ui/Avatar'

// Props: { myProfile, partnerProfile, onReady }
// Shows animated entrance screen for ~2.5 seconds then calls onReady()
export default function SessionEntrance({ myProfile, partnerProfile, onReady }) {
  useEffect(() => {
    const timer = setTimeout(() => onReady(), 2500)
    return () => clearTimeout(timer)
  }, [onReady])

  const partnerName = partnerProfile?.display_name || 'tu compañero'

  return (
    <div className="session-entrance">
      <h1 className="session-entrance-title">Vinki-Vinki</h1>
      <p className="session-entrance-subtitle">
        Estudias en tu mundo. {partnerName} en el suyo. Los dos juntos.
      </p>

      <div className="session-entrance-avatars">
        <div className="session-entrance-avatar-left">
          <Avatar
            displayName={myProfile?.display_name || '?'}
            color={myProfile?.avatar_color || '#2E7D52'}
            size="lg"
          />
        </div>

        <div className="session-entrance-connector" />

        <div className="session-entrance-avatar-right">
          <Avatar
            displayName={partnerProfile?.display_name || '?'}
            color={partnerProfile?.avatar_color || '#E07240'}
            size="lg"
          />
        </div>
      </div>

      <div className="session-entrance-loading">
        <div className="spinner" />
        Entrando...
      </div>
    </div>
  )
}
