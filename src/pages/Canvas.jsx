import { useState, useEffect, lazy, Suspense } from 'react'
import { useCanvases } from '../lib/useCanvases'
import { useCards } from '../lib/useCards'
import { useVinkiSession } from '../lib/useVinkiSession'
import { useSessionPresence } from '../lib/useSessionPresence'
import { useSessionChannel } from '../lib/useSessionChannel'
import Dashboard from '../components/dashboard/Dashboard'
import CanvasBoard from '../components/canvas/CanvasBoard'
import SessionView from '../components/session/SessionView'
import SessionInviteModal from '../components/session/SessionInviteModal'
import WaitingRoomModal from '../components/session/WaitingRoomModal'
import SettingsPanel from '../components/ui/SettingsPanel'
import { IconBack, IconSettings } from '../components/icons/index.jsx'
import { supabase } from '../lib/supabaseClient'

// Props: { session, profile }
export default function Canvas({ session, profile }) {
  const [localProfile, setLocalProfile] = useState(profile)
  const [activeCanvasId, setActiveCanvasId] = useState(null)
  const [showSettings, setShowSettings] = useState(false)
  const [pendingInvite, setPendingInvite] = useState(null)
  const [waitingForPartner, setWaitingForPartner] = useState(false)

  const { canvases, addCanvas, removeCanvas, renameCanvas } = useCanvases(localProfile)
  const { cards, loading: cardsLoading, addCard, updateCard, updateCardLocal, removeCard } = useCards(activeCanvasId)
  const { session: vSession, createSession, joinSession, leaveSession, updateActivity, getPendingInvitations } =
    useVinkiSession(localProfile, (invite) => setPendingInvite(invite))
  const { participants } = useSessionPresence(vSession?.id)
  const { send } = useSessionChannel(vSession?.id, handleSessionEvent)

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

  async function handleCreateSession(canvasId, friendId) {
    const result = await createSession(canvasId, friendId)
    if (!result.error) {
      setWaitingForPartner(true)
    }
    return result
  }

  function handleSessionEvent(payload) {
    // Handled inside SessionView
  }

  // If in session: determine partner
  const partner = participants.find(p => p.user_id !== localProfile.id)

  // ── Canvas board view ──
  if (activeCanvasId) {
    const canvas = canvases.find(c => c.id === activeCanvasId)

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
            session={vSession}
            partner={partner}
            profile={localProfile}
            myCanvasId={activeCanvasId}
            send={send}
            onLeave={leaveSession}
          >
            <CanvasBoard
              canvasId={activeCanvasId}
              cards={cards}
              onAddCard={addCard}
              onUpdateCard={updateCard}
              onRemoveCard={removeCard}
              profile={localProfile}
            />
          </SessionView>
        ) : (
          <CanvasBoard
            canvasId={activeCanvasId}
            cards={cards}
            onAddCard={addCard}
            onUpdateCard={updateCard}
            onRemoveCard={removeCard}
            profile={localProfile}
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
        onOpenCanvas={setActiveCanvasId}
        onAddCanvas={addCanvas}
        onRemoveCanvas={removeCanvas}
        session={vSession}
        onCreateSession={handleCreateSession}
        onJoinSession={joinSession}
        onLeaveSession={leaveSession}
      />

      {pendingInvite && !vSession && (
        <SessionInviteModal
          invite={pendingInvite}
          onAccept={async () => {
            const canvasId = canvases[0]?.id || null
            await joinSession(pendingInvite.sessionId, canvasId)
            setPendingInvite(null)
          }}
          onDecline={() => setPendingInvite(null)}
        />
      )}

      {waitingForPartner && vSession && (
        <WaitingRoomModal
          session={vSession}
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
