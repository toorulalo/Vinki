import { useState, lazy, Suspense } from 'react'
import { useCanvases } from '../lib/useCanvases'
import { useCards } from '../lib/useCards'
import { useVinkiSession } from '../lib/useVinkiSession'
import { useSessionPresence } from '../lib/useSessionPresence'
import { useSessionChannel } from '../lib/useSessionChannel'
import Dashboard from '../components/dashboard/Dashboard'
import CanvasBoard from '../components/canvas/CanvasBoard'
import SessionView from '../components/session/SessionView'
import GlobalMusicPlayer from '../components/music/GlobalMusicPlayer'
import SettingsPanel from '../components/ui/SettingsPanel'
import { IconBack, IconSettings } from '../components/icons/index.jsx'

// Props: { session, profile }
export default function Canvas({ session, profile }) {
  const [localProfile, setLocalProfile] = useState(profile)
  const [activeCanvasId, setActiveCanvasId] = useState(null)
  const [showSettings, setShowSettings] = useState(false)

  const { canvases, addCanvas, removeCanvas, renameCanvas } = useCanvases(localProfile)
  const { cards, loading: cardsLoading, addCard, updateCard, updateCardLocal, removeCard } = useCards(activeCanvasId)
  const { session: vSession, createSession, joinSession, leaveSession, updateActivity } = useVinkiSession(localProfile)
  const { participants } = useSessionPresence(vSession?.id)
  const { send } = useSessionChannel(vSession?.id, handleSessionEvent)

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
        onOpenCanvas={setActiveCanvasId}
        onAddCanvas={addCanvas}
        onRemoveCanvas={removeCanvas}
        session={vSession}
        onCreateSession={createSession}
        onJoinSession={joinSession}
        onLeaveSession={leaveSession}
      />

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
