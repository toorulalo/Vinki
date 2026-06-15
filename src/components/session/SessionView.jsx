import { useState, useCallback } from 'react'
import { useCards } from '../../lib/useCards'
import PresenceBar from './PresenceBar'
import ReactionBubble from './ReactionBubble'
import Avatar from '../ui/Avatar'

const REACTION_EMOJIS = ['👍', '❤️', '🎉', '🤯']
const REACTION_COOLDOWN_MS = 3000

// Props: { session, partner, profile, myCanvasId, send, onLeave, children }
// children = <CanvasBoard /> for my canvas
export default function SessionView({ session, partner, profile, myCanvasId, send, onLeave, children }) {
  const [viewingPartner, setViewingPartner] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const [reactionCooldown, setReactionCooldown] = useState(false)
  const [incomingReaction, setIncomingReaction] = useState(null)

  // Partner's canvas cards (for read-only view)
  const partnerCanvasId = partner?.individual_canvas_id || null
  const { cards: partnerCards } = useCards(viewingPartner ? partnerCanvasId : null)

  // Partner focus card title
  const partnerFocusCardId = partner?.last_opened_card_id
  const partnerFocusTitle = partnerFocusCardId
    ? (partnerCards.find(c => c.id === partnerFocusCardId)?.title || 'algo')
    : null

  const partnerProfile = partner?.profile || null
  const partnerName = partnerProfile?.display_name || 'tu compañero'

  // Handle incoming events from channel
  // Note: this component uses send but receives events via Canvas.jsx's handleSessionEvent.
  // To receive reactions here we store a callback on the send ref — instead we use a local
  // handler that Canvas passes through. For simplicity, wire reactions by wrapping send.

  function handleSendReaction(emoji) {
    if (reactionCooldown) return
    send({ type: 'reaction', emoji, from: profile.display_name })
    // Show own reaction briefly as confirmation
    setReactionCooldown(true)
    setTimeout(() => setReactionCooldown(false), REACTION_COOLDOWN_MS)
  }

  function handleLeave() {
    setShowMenu(false)
    if (window.confirm('¿Salir de la sesión Vinki-Vinki?')) {
      onLeave()
    }
  }

  // Top padding so content sits below our 48px session topbar
  const contentStyle = { paddingTop: 48 }

  return (
    <div style={{ position: 'relative', minHeight: '100dvh' }}>
      {/* Session topbar */}
      <div className="session-topbar">
        {/* Left: presence indicator + label + partner avatar */}
        <div className="session-topbar-left">
          <span className="presence-dot online" />
          <span className="session-label">Vinki-Vinki</span>
          {partnerProfile && (
            <Avatar
              displayName={partnerProfile.display_name}
              color={partnerProfile.avatar_color || '#E07240'}
              size="sm"
            />
          )}
        </div>

        {/* Center: partner focus */}
        <div className="session-topbar-center">
          <PresenceBar partner={partner} partnerFocusTitle={partnerFocusTitle} />
        </div>

        {/* Right: view toggle + menu */}
        <div className="session-topbar-right">
          <button
            type="button"
            className={`view-switch-btn${partnerFocusTitle ? ' has-update' : ''}`}
            onClick={() => setViewingPartner(v => !v)}
            title={viewingPartner ? 'Ver mi mundo' : 'Ver su mundo'}
          >
            {viewingPartner ? '👁 Mi mundo' : `👁 ${partnerName}`}
          </button>

          <button
            type="button"
            className="btn btn-icon"
            onClick={() => setShowMenu(m => !m)}
            aria-label="Opciones de sesión"
            style={{ fontSize: 20 }}
          >
            ⋮
          </button>
        </div>
      </div>

      {/* Session kebab menu */}
      {showMenu && (
        <>
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 54 }}
            onClick={() => setShowMenu(false)}
          />
          <div className="session-menu">
            <button
              type="button"
              className="session-menu-item danger"
              onClick={handleLeave}
            >
              🚪 Salir de Vinki-Vinki
            </button>
          </div>
        </>
      )}

      {/* Main content */}
      <div style={contentStyle}>
        {viewingPartner ? (
          <ReadonlyPartnerView
            partnerName={partnerName}
            partnerCards={partnerCards}
          />
        ) : (
          children
        )}
      </div>

      {/* Reactions bar */}
      <div className="reactions-bar">
        {REACTION_EMOJIS.map(emoji => (
          <button
            key={emoji}
            type="button"
            className="reaction-btn"
            onClick={() => handleSendReaction(emoji)}
            disabled={reactionCooldown}
            title={`Enviar ${emoji}`}
          >
            {emoji}
          </button>
        ))}
      </div>

      {/* Incoming reaction bubble */}
      {incomingReaction && (
        <ReactionBubble
          emoji={incomingReaction.emoji}
          senderName={incomingReaction.from}
          onDone={() => setIncomingReaction(null)}
        />
      )}
    </div>
  )
}

// Read-only view of partner's canvas
function ReadonlyPartnerView({ partnerName, partnerCards }) {
  if (!partnerCards.length) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 'calc(100dvh - 48px)',
          gap: 12,
          color: 'var(--text-muted)',
        }}
      >
        <span style={{ fontSize: 40 }}>📚</span>
        <p style={{ fontSize: 'var(--text-sm)', margin: 0 }}>
          {partnerName} aún no tiene tarjetas en su lienzo.
        </p>
      </div>
    )
  }

  return (
    <div style={{ padding: 16, position: 'relative' }}>
      {/* Readonly banner */}
      <div className="readonly-overlay">
        <div className="readonly-banner">
          👁 Estás viendo el mundo de {partnerName} — solo lectura
        </div>
      </div>

      {/* Simple card list for partner's canvas */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
          gap: 12,
          marginTop: 48,
        }}
      >
        {partnerCards.map(card => (
          <div
            key={card.id}
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              padding: 12,
              pointerEvents: 'none',
              userSelect: 'none',
            }}
          >
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', margin: '0 0 4px' }}>
              {card.type}
            </p>
            <p style={{ fontSize: 'var(--text-sm)', fontWeight: 600, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {card.title || card.content?.note || card.content?.url || '(sin título)'}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}
