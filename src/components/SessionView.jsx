import { useState, useEffect } from 'react'
import CanvasBoard from './CanvasBoard'
import ReactionsBar from './ReactionsBar'
import SendToVropDialog from './SendToVropDialog'
import { useSessionPresence, setLastOpenedCard } from '../lib/useSessionPresence'
import { useSessionChannel } from '../lib/useSessionChannel'
import { IconEyeOn, IconBack, IconMoreVertical, IconLeaveSession } from './icons/index.jsx'

const REACTION_LABELS = { approve: 'aprobó', heart: 'mandó un corazón', celebrate: 'festejó', highfive: 'chocó los cinco' }

function cardSummary(card) {
  if (!card) return null
  if (card.type === 'note') return card.content?.note?.slice(0, 40) || 'una nota'
  return card.title || card.content?.url?.slice(0, 40) || `un ${card.type}`
}

export default function SessionView({ session, profile, vrop, sessions, onClose }) {
  const [vropCard, setVropCard] = useState(null)
  const { participants, reload: reloadPresence } = useSessionPresence(session.id)
  const [viewingPartnerId, setViewingPartnerId] = useState(null)
  const [toast, setToast] = useState(null)
  const [showMenu, setShowMenu] = useState(false)

  const me      = participants.find((p) => p.user_id === profile.id)
  const partner = participants.find((p) => p.user_id !== profile.id)

  function showToast(text, ms = 3500) {
    setToast(text); setTimeout(() => setToast((t) => t === text ? null : t), ms)
  }

  const { send } = useSessionChannel(session.id, (payload) => {
    if (payload.type === 'reaction') {
      const label = REACTION_LABELS[payload.reactionId] || 'reaccionó'
      showToast(`${payload.fromName} ${label}`)
    } else if (payload.type === 'left') {
      showToast(`${payload.fromName} salió de la sesión`)
      sessions.leaveSession(session.id).then(onClose)
    }
  })

  useEffect(() => { if (!partner) setViewingPartnerId(null) }, [partner])

  function handleCardOpened(card) {
    if (!viewingPartnerId) setLastOpenedCard(session.id, profile.id, card.id).then(reloadPresence)
  }

  function handleReact(reactionId) {
    send({ type: 'reaction', reactionId, fromName: profile.name })
  }

  function handleLeave() {
    send({ type: 'left', fromName: profile.name })
    sessions.leaveSession(session.id)
    onClose()
  }

  // Sala de espera
  if (!partner) return (
    <div className="session-view" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="waiting-room">
        <h2 className="waiting-title">Esperando a tu compañero/a</h2>
        <p style={{ color: 'var(--ink-soft)', maxWidth: 280, textAlign: 'center' }}>
          Compartí el código de la sesión para que se una.
        </p>
        <div className="waiting-code-box">
          <span className="waiting-code-label">Código</span>
          <span className="waiting-code-value">{session.join_code}</span>
        </div>
        <div className="waiting-spinner" />
        <button type="button" className="btn-pill btn-pill-danger" onClick={handleLeave}>Cancelar</button>
      </div>
    </div>
  )

  const viewing = viewingPartnerId ? partner : null
  const readOnly = Boolean(viewing)
  const canvasId = viewing ? viewing.individual_canvas_id : me?.individual_canvas_id || session.my_individual_canvas_id
  const whoLabel = viewing ? (partner?.users?.name || 'Compañero/a') : 'Tu lienzo'
  const lastCard = viewing ? partner?.last_opened_card : me?.last_opened_card
  const summary  = cardSummary(lastCard)

  return (
    <div className="session-view">
      <CanvasBoard
        canvasId={canvasId}
        readOnly={readOnly}
        emptyLabel={readOnly ? 'Este lienzo está vacío.' : 'Tocá + para agregar algo.'}
        onCardOpened={handleCardOpened}
        onSendToVrop={!readOnly ? setVropCard : undefined}
      />

      {/* Switch ver lienzo */}
      <button type="button" className="session-switch"
        onClick={() => setViewingPartnerId((v) => v ? null : partner.user_id)}>
        {viewing ? <><IconBack size={14} /> Mi lienzo</> : <><IconEyeOn size={14} /> {partner?.users?.name || 'Compañero/a'}</>}
      </button>

      {/* Presencia + menú */}
      <div className="session-presence">
        <button type="button" className="session-presence-menu-btn"
          onClick={() => setShowMenu((s) => !s)} aria-label="Opciones">
          <IconMoreVertical size={16} />
        </button>
        <div className="session-presence-text">
          <strong>{whoLabel}</strong>
          {summary && <span> · {summary}</span>}
        </div>
      </div>

      {showMenu && (
        <div className="session-menu" onClick={() => setShowMenu(false)}>
          <button type="button" className="session-menu-item danger" onClick={handleLeave}>
            <IconLeaveSession size={16} /> Salir de Vinki-Vinki
          </button>
        </div>
      )}

      {/* Reacciones (solo cuando ves al compañero) */}
      {readOnly && <ReactionsBar onReact={handleReact} />}

      {toast && (
        <div className="session-toast">
          {toast}
          <button type="button" className="session-toast-close" onClick={() => setToast(null)}>×</button>
        </div>
      )}

      {vropCard && (
        <SendToVropDialog
          card={vropCard}
          partner={partner}
          profile={profile}
          getOrCreateThread={vrop.getOrCreateThread}
          onClose={() => setVropCard(null)}
        />
      )}
    </div>
  )
}
