import { useState, useEffect } from 'react'
import CanvasBoard from './CanvasBoard'
import SendToVropDialog from './SendToVropDialog'
import LiveMusicPlayer from './LiveMusicPlayer'
import { getYoutubeId } from '../lib/linkPreview'
import { useSessionPresence, setLastOpenedCard } from '../lib/useSessionPresence'
import { useSessionChannel } from '../lib/useSessionChannel'

const REACTIONS = ['👍', '❤️', '🎉', '🤝']

function cardSummary(card) {
  if (!card) return null
  if (card.type === 'note') return card.content?.text?.slice(0, 40) || 'una nota'
  if (card.type === 'pdf') return card.title || card.content?.filename || 'un PDF'
  if (card.type === 'spotify') return 'Música'
  if (card.type === 'timer') return 'el temporizador'
  return card.title || card.content?.url?.slice(0, 40) || `un ${card.type}`
}

// Si la última tarjeta abierta por alguien es una tarjeta de Música con
// fuente YouTube y tiene link, devuelve el videoId para poder escucharla
// en vivo entre los dos.
function musicVideoIdFromCard(card) {
  if (!card || card.type !== 'spotify') return null
  if (card.content?.source !== 'youtube') return null
  return getYoutubeId(card.content?.url)
}

export default function SessionView({ session, profile, vrop, vinki, onClose }) {
  const [vropCard, setVropCard] = useState(null)
  const { participants, reload: reloadPresence } = useSessionPresence(session.id)
  const [viewingPartnerId, setViewingPartnerId] = useState(null)
  const [toast, setToast] = useState(null)
  const [invite, setInvite] = useState(null) // invitación entrante {fromName}
  const [askCopy, setAskCopy] = useState(null) // {sharedCanvasId, myCanvasId}
  const [showMenu, setShowMenu] = useState(false)
  const [showLiveMusic, setShowLiveMusic] = useState(false)
  const [musicVideoId, setMusicVideoId] = useState(null)
  const [musicSync, setMusicSync] = useState(null)

  const me = participants.find((p) => p.user_id === profile.id)
  const partners = participants.filter((p) => p.user_id !== profile.id)
  const partner = partners[0]

  function showToast(text, ms = 3500) {
    setToast(text)
    setTimeout(() => setToast((t) => (t === text ? null : t)), ms)
  }

  const { send } = useSessionChannel(session.id, (payload) => {
    if (payload.type === 'reaction') {
      showToast(`${payload.emoji} ${payload.fromName}`)
    } else if (payload.type === 'project_invite') {
      setInvite({ fromName: payload.fromName })
    } else if (payload.type === 'project_invite_response') {
      if (payload.accepted) {
        showToast(`${payload.fromName} aceptó — ahora es un Proyecto`)
        vinki.reload().then(() => {
          setAskCopy({
            myCanvasId: me?.individual_canvas_id || session.my_individual_canvas_id
          })
        })
      } else {
        showToast(`${payload.fromName} declinó la invitación`)
      }
    } else if (payload.type === 'music_sync') {
      setMusicSync({ ...payload, ts: Date.now() })
    } else if (payload.type === 'left') {
      showToast(`${payload.fromName} cerró la sesión VINKI`)
      vinki.leaveSession(session.id).then(onClose)
    }
  })

  useEffect(() => {
    if (partners.length === 0) setViewingPartnerId(null)
  }, [partners.length])

  // Detectar si alguien (yo o mi compañero/a) está con una tarjeta de
  // Música/YouTube abierta, para ofrecer "Escuchar juntos".
  const detectedVideoId =
    musicVideoIdFromCard(partner?.last_opened_card) ||
    musicVideoIdFromCard(me?.last_opened_card)

  useEffect(() => {
    // Si cambia el video detectado y no hay sesión de escucha abierta,
    // actualizamos el candidato. Si ya está abierta, no la interrumpimos.
    if (!showLiveMusic) setMusicVideoId(detectedVideoId)
  }, [detectedVideoId, showLiveMusic])

  function handleCardOpened(card) {
    if (!viewingPartnerId) {
      setLastOpenedCard(session.id, profile.id, card.id).then(reloadPresence)
    }
  }

  function sendReaction(emoji) {
    send({ type: 'reaction', emoji, fromName: profile.name })
    showToast(`Enviaste ${emoji}`, 1500)
  }

  function handleLeave() {
    send({ type: 'left', fromName: profile.name })
    vinki.leaveSession(session.id)
    onClose()
  }

  function handleInviteToProject() {
    send({ type: 'project_invite', fromName: profile.name })
    showToast('Invitación enviada, esperando respuesta...')
    setShowMenu(false)
  }

  async function respondInvite(accepted) {
    const fromName = invite.fromName
    setInvite(null)

    if (!accepted) {
      send({
        type: 'project_invite_response',
        accepted: false,
        fromName: profile.name
      })
      return
    }

    const { data, error } = await vinki.convertToProject(session.id)
    if (error) {
      showToast('No se pudo crear el proyecto.')
      return
    }
    send({
      type: 'project_invite_response',
      accepted: true,
      fromName: profile.name
    })
    setAskCopy({
      sharedCanvasId: data.shared_canvas_id,
      myCanvasId: me?.individual_canvas_id || session.my_individual_canvas_id
    })
  }

  async function handleCopyChoice(copy) {
    if (copy && askCopy?.myCanvasId) {
      const sharedId = askCopy.sharedCanvasId || session.shared_canvas_id
      if (sharedId) {
        await vinki.copyCardsToCanvas(askCopy.myCanvasId, sharedId)
      }
    }
    setAskCopy(null)
    await vinki.reload()
  }

  const sendProps = partners.length > 0 ? { onSendToVrop: setVropCard } : {}

  function openLiveMusic() {
    setMusicVideoId(detectedVideoId)
    setShowLiveMusic(true)
  }

  function closeLiveMusic() {
    setShowLiveMusic(false)
  }

  const liveMusicElement = showLiveMusic && musicVideoId && (
    <LiveMusicPlayer
      videoId={musicVideoId}
      send={send}
      incomingSync={musicSync}
      onClose={closeLiveMusic}
    />
  )

  const listenButton = detectedVideoId && !showLiveMusic && (
    <button type="button" className="btn-primary live-listen-btn" onClick={openLiveMusic}>
      🎧 Escuchar juntos
    </button>
  )

  // --- Modo Proyecto: lienzo compartido único (sin cambios respecto a antes) ---
  if (session.mode === 'proyecto') {
    return (
      <div className="session-view">
        <div className="session-bar">
          <span className="session-mode-badge">Proyecto compartido</span>
          <button type="button" className="btn-link" onClick={onClose}>
            Volver a mi lienzo
          </button>
        </div>
        {session.shared_canvas_id ? (
          <CanvasBoard
            canvasId={session.shared_canvas_id}
            emptyLabel="Este proyecto está vacío. Agreguen la primera tarjeta."
            onCardOpened={handleCardOpened}
            {...sendProps}
          />
        ) : (
          <p className="canvas-empty" style={{ marginTop: 24, textAlign: 'center' }}>
            Preparando el lienzo del proyecto...
          </p>
        )}
        {listenButton}
        {liveMusicElement}
        {toast && <div className="vinki-toast">{toast}</div>}
        {vropCard && (
          <SendToVropDialog
            card={vropCard}
            partners={partners}
            profile={profile}
            getOrCreateThread={vrop.getOrCreateThread}
            onClose={() => setVropCard(null)}
          />
        )}
        {askCopy && (
          <CopyChoiceDialog onChoose={handleCopyChoice} />
        )}
      </div>
    )
  }

  // --- Modo VINKI-VINKI: sala de espera ---
  if (partners.length === 0) {
    return (
      <div className="modal-overlay">
        <div className="modal waiting-room">
          <div className="onboarding-icon">🔗</div>
          <h3 className="font-display" style={{ color: 'var(--accent)' }}>
            Esperando vínculo VINKI...
          </h3>
          <p className="canvas-empty" style={{ margin: '8px 0 16px' }}>
            Compartí el código de esta sesión. Apenas la otra persona se una,
            van a poder verse en vivo.
          </p>
          <div className="waiting-spinner" />
          <button type="button" className="btn-link btn-danger" onClick={handleLeave}>
            Cancelar
          </button>
        </div>
      </div>
    )
  }

  // --- Modo VINKI-VINKI: lienzo propio o del compañero (switch) ---
  const viewing = viewingPartnerId
    ? partners.find((p) => p.user_id === viewingPartnerId)
    : null
  const readOnly = Boolean(viewing)
  const canvasId = viewing
    ? viewing.individual_canvas_id
    : me?.individual_canvas_id || session.my_individual_canvas_id
  const whoLabel = viewing ? viewing.users?.name || 'Compañero/a' : 'Tu lienzo'
  const lastCard = viewing ? viewing.last_opened_card : me?.last_opened_card
  const summary = cardSummary(lastCard)

  return (
    <div className="session-view">
      <CanvasBoard
        canvasId={canvasId}
        readOnly={readOnly}
        emptyLabel={
          readOnly
            ? 'Este lienzo está vacío por ahora.'
            : 'Tu lienzo está vacío. Tocá "+" para agregar algo.'
        }
        onCardOpened={handleCardOpened}
        {...(!readOnly ? sendProps : {})}
      />

      {/* Switch arriba a la derecha */}
      {partners.length > 0 && (
        <button
          type="button"
          className="session-switch"
          onClick={() =>
            setViewingPartnerId((v) => (v ? null : partner.user_id))
          }
        >
          {viewing ? '↩ Mi lienzo' : `👁 ${partner.users?.name || 'Compañero/a'}`}
        </button>
      )}

      {/* Etiqueta + menú abajo a la derecha */}
      <div className="session-presence">
        <button
          type="button"
          className="session-presence-menu-btn"
          onClick={() => setShowMenu((s) => !s)}
          aria-label="Opciones"
        >
          ⋮
        </button>
        <div className="session-presence-text">
          <strong>{whoLabel}</strong>
          {summary && <span> · último: {summary}</span>}
        </div>
      </div>

      {showMenu && (
        <div className="session-menu" onClick={() => setShowMenu(false)}>
          <button type="button" onClick={handleInviteToProject}>
            ✨ Invitar a {partner?.users?.name || 'compañero/a'} a Proyecto
          </button>
          <button type="button" className="btn-danger" onClick={handleLeave}>
            🚪 Salir de la sesión
          </button>
          <button type="button" onClick={onClose}>
            ↩ Volver a mi inicio
          </button>
        </div>
      )}

      {/* Reacciones al ver el lienzo del compañero */}
      {readOnly && (
        <div className="session-reactions">
          {REACTIONS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              className="session-reaction-btn"
              onClick={() => sendReaction(emoji)}
            >
              {emoji}
            </button>
          ))}
        </div>
      )}

      {listenButton}
      {liveMusicElement}

      {toast && (
        <div className="vinki-toast">
          {toast}
          <button
            type="button"
            className="vinki-toast-close"
            onClick={() => setToast(null)}
          >
            ×
          </button>
        </div>
      )}

      {invite && (
        <div className="modal-overlay">
          <div className="modal" style={{ textAlign: 'center' }}>
            <h3 className="font-display">✨ Invitación a Proyecto</h3>
            <p className="canvas-empty" style={{ margin: '8px 0 16px' }}>
              {invite.fromName} quiere transformar esta sesión en un Proyecto
              compartido con un solo lienzo.
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button className="btn-primary" onClick={() => respondInvite(true)}>
                Aceptar
              </button>
              <button
                className="btn-pill btn-pill-muted"
                onClick={() => respondInvite(false)}
              >
                Declinar
              </button>
            </div>
          </div>
        </div>
      )}

      {askCopy && <CopyChoiceDialog onChoose={handleCopyChoice} />}

      {vropCard && (
        <SendToVropDialog
          card={vropCard}
          partners={partners.map((p) => ({ user_id: p.user_id, users: p.users }))}
          profile={profile}
          getOrCreateThread={vrop.getOrCreateThread}
          onClose={() => setVropCard(null)}
        />
      )}
    </div>
  )
}

function CopyChoiceDialog({ onChoose }) {
  return (
    <div className="modal-overlay">
      <div className="modal" style={{ textAlign: 'center' }}>
        <h3 className="font-display">¡Ahora es un Proyecto! 🎉</h3>
        <p className="canvas-empty" style={{ margin: '8px 0 16px' }}>
          ¿Querés copiar tus tarjetas actuales al lienzo del proyecto? Tu
          lienzo individual no se borra.
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
          <button className="btn-primary" onClick={() => onChoose(true)}>
            Sí, copiarlas
          </button>
          <button className="btn-pill btn-pill-muted" onClick={() => onChoose(false)}>
            No, dejarlas
          </button>
        </div>
      </div>
    </div>
  )
}
