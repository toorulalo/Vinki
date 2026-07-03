import { useState, useEffect, useRef } from 'react'
import { useCanvases } from '../lib/useCanvases'
import { useCards } from '../lib/useCards'
import { useVinkiSession } from '../lib/useVinkiSession'
import { useSessionPresence, setLastOpenedCard } from '../lib/useSessionPresence'
import { useSessionChannel } from '../lib/useSessionChannel'
import { useToast } from '../components/ui/Toast'
import Dashboard from '../components/dashboard/Dashboard'
import CanvasBoard from '../components/canvas/CanvasBoard'
import SessionView from '../components/session/SessionView'
import SessionInviteModal from '../components/session/SessionInviteModal'
import WaitingRoomModal from '../components/session/WaitingRoomModal'
import GlobalMusicPlayer from '../components/music/GlobalMusicPlayer'
import ShareCapture from '../components/ShareCapture'
import SettingsPanel from '../components/ui/SettingsPanel'
import { IconBack, IconSettings } from '../components/icons/index.jsx'
import { supabase } from '../lib/supabaseClient'

const ACTIVITY_PING_MS = 10 * 60 * 1000

// Props: { session, profile }
export default function Canvas({ session, profile }) {
  const [localProfile, setLocalProfile] = useState(profile)
  const [activeCanvasId, setActiveCanvasId] = useState(null)
  const [showSettings, setShowSettings] = useState(false)
  const [pendingInvite, setPendingInvite] = useState(null)
  const [waitingForPartner, setWaitingForPartner] = useState(false)
  const [sessionEvent, setSessionEvent] = useState(null)

  const { showToast } = useToast()
  const { canvases, loading: canvasesLoading, error: canvasesError, addCanvas, removeCanvas, renameCanvas } =
    useCanvases(localProfile)
  const { cards, loading: cardsLoading, error: cardsError, addCard, updateCard, removeCard } =
    useCards(activeCanvasId)
  const {
    session: vSession, loading: vSessionLoading,
    createSession, joinSession, leaveSession, setMyCanvas, updateActivity, getPendingInvitations,
  } = useVinkiSession(localProfile, (invite) => setPendingInvite(invite))
  const { participants } = useSessionPresence(vSession?.id)
  const { send } = useSessionChannel(vSession?.id, (payload) => {
    // Re-wrap so identical consecutive events still retrigger effects downstream.
    setSessionEvent({ ...payload, _ts: Date.now() })
  })

  // Surface data-layer failures instead of rendering silently-empty views
  useEffect(() => { if (canvasesError) showToast(canvasesError, 'error') }, [canvasesError])
  useEffect(() => { if (cardsError) showToast(cardsError, 'error') }, [cardsError])

  // Recover session invites sent while we were offline (broadcast is ephemeral)
  const invitesChecked = useRef(false)
  useEffect(() => {
    if (invitesChecked.current || vSessionLoading || vSession || !localProfile?.id) return
    invitesChecked.current = true
    getPendingInvitations().then((invites) => {
      const inv = invites[0]
      if (!inv) return
      setPendingInvite({
        sessionId: inv.id,
        hostId: inv.host_id,
        hostName: inv.profiles?.display_name || 'Alguien',
        hostColor: inv.profiles?.avatar_color,
      })
    })
  }, [vSessionLoading, vSession, localProfile?.id])

  // Keep my session participant row pointing at the canvas I'm actually using,
  // so my partner's "ver su mundo" view shows the right cards.
  useEffect(() => {
    if (!vSession || !activeCanvasId) return
    if (vSession.my_individual_canvas_id !== activeCanvasId) setMyCanvas(activeCanvasId)
  }, [vSession?.id, activeCanvasId])

  // Keep the session alive while it's actually in use (expiry is based on last_activity_at)
  useEffect(() => {
    if (!vSession?.id) return
    updateActivity()
    const timer = setInterval(updateActivity, ACTIVITY_PING_MS)
    return () => clearInterval(timer)
  }, [vSession?.id])

  // When waiting for partner, subscribe to session_participants to detect when they join
  useEffect(() => {
    if (!waitingForPartner || !vSession?.id || !localProfile?.id) return
    const ch = supabase.channel(`wait-${vSession.id}`)
    ch.on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'session_participants',
      filter: `session_id=eq.${vSession.id}`,
    }, (payload) => {
      if (payload.new.user_id !== localProfile.id) {
        setWaitingForPartner(false)
      }
    })
    ch.subscribe()
    return () => supabase.removeChannel(ch)
  }, [waitingForPartner, vSession?.id, localProfile?.id])

  // Fallback for the race where the partner joins before the channel above is live
  useEffect(() => {
    if (waitingForPartner && participants.length > 1) setWaitingForPartner(false)
  }, [waitingForPartner, participants.length])

  async function handleCreateSession(canvasId, friendId) {
    const myCanvasId = canvasId ?? canvases[0]?.id ?? null
    const result = await createSession(myCanvasId, friendId)
    if (!result.error) {
      setWaitingForPartner(true)
    }
    return result
  }

  async function handleAcceptInvite() {
    const canvasId = canvases[0]?.id || null
    const { error } = await joinSession(pendingInvite.sessionId, canvasId)
    setPendingInvite(null)
    if (error) {
      showToast(error.message, 'error')
    } else {
      showToast('¡Sesión Vinki-Vinki iniciada!', 'success')
    }
  }

  function enterSession() {
    const target = vSession?.my_individual_canvas_id || canvases[0]?.id || null
    if (target) setActiveCanvasId(target)
    else showToast('Crea un lienzo primero para entrar a la sesión.', 'info')
  }

  function handleCardOpen(cardId) {
    if (vSession?.id && localProfile?.id) {
      setLastOpenedCard(vSession.id, localProfile.id, cardId)
    }
  }

  // If in session: determine partner
  const partner = participants.find(p => p.user_id !== localProfile.id)

  // ── Canvas board view ──
  if (activeCanvasId) {
    const canvas = canvases.find(c => c.id === activeCanvasId)

    const board = (
      <CanvasBoard
        canvasId={activeCanvasId}
        cards={cards}
        loading={cardsLoading}
        onAddCard={addCard}
        onUpdateCard={updateCard}
        onRemoveCard={removeCard}
        onCardOpen={handleCardOpen}
        profile={localProfile}
      />
    )

    return (
      <>
        <header className="topbar">
          <div className="topbar-left">
            <button
              type="button"
              className="btn btn-icon"
              onClick={() => setActiveCanvasId(null)}
              aria-label="Volver"
            >
              <IconBack size={20} />
            </button>
            <span className="topbar-title">{canvas?.title || 'Lienzo'}</span>
          </div>
          <div className="topbar-actions">
            {vSession && (
              <span
                className="badge badge-primary"
                style={{ fontSize: 'var(--text-xs)', display: 'flex', alignItems: 'center', gap: 4 }}
              >
                <span className="presence-dot online" style={{ width: 7, height: 7 }} />
                Vinki-Vinki
              </span>
            )}
            <button
              type="button"
              className="btn btn-icon"
              onClick={() => setShowSettings(true)}
              aria-label="Ajustes"
            >
              <IconSettings size={20} />
            </button>
          </div>
        </header>

        {vSession ? (
          <SessionView
            partner={partner}
            profile={localProfile}
            incomingEvent={sessionEvent}
            send={send}
            onLeave={leaveSession}
          >
            {board}
          </SessionView>
        ) : (
          board
        )}

        <GlobalMusicPlayer />

        {showSettings && (
          <SettingsPanel
            profile={localProfile}
            onClose={() => setShowSettings(false)}
            onProfileUpdate={setLocalProfile}
          />
        )}
      </>
    )
  }

  // ── Dashboard view ──
  return (
    <>
      <header className="topbar">
        <span className="topbar-brand">Vinki</span>
        <div className="topbar-actions">
          <button
            type="button"
            className="btn btn-icon"
            onClick={() => setShowSettings(true)}
            aria-label="Ajustes"
          >
            <IconSettings size={20} />
          </button>
        </div>
      </header>

      <Dashboard
        profile={localProfile}
        canvases={canvases}
        loading={canvasesLoading || vSessionLoading}
        onOpenCanvas={setActiveCanvasId}
        onAddCanvas={addCanvas}
        onRemoveCanvas={removeCanvas}
        onRenameCanvas={renameCanvas}
        session={vSession}
        partner={partner}
        onEnterSession={enterSession}
        onCreateSession={handleCreateSession}
        onLeaveSession={leaveSession}
      />

      <GlobalMusicPlayer />

      <ShareCapture
        profile={localProfile}
        canvases={canvases}
        onOpenCanvas={setActiveCanvasId}
      />

      {pendingInvite && !vSession && (
        <SessionInviteModal
          invite={pendingInvite}
          onAccept={handleAcceptInvite}
          onDecline={() => setPendingInvite(null)}
        />
      )}

      {waitingForPartner && vSession && (
        <WaitingRoomModal
          onCancel={() => { leaveSession(); setWaitingForPartner(false) }}
        />
      )}

      {showSettings && (
        <SettingsPanel
          profile={localProfile}
          onClose={() => setShowSettings(false)}
          onProfileUpdate={setLocalProfile}
        />
      )}
    </>
  )
}
