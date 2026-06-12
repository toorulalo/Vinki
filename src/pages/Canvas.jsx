import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useProfile } from '../lib/useProfile'
import { useCanvases } from '../lib/useCanvases'
import { useVinkiSessions } from '../lib/useVinkiSessions'
import { useVropThreads } from '../lib/useVropThreads'
import CanvasBoard from '../components/CanvasBoard'
import CanvasTabs from '../components/CanvasTabs'
import VinkiPanel from '../components/VinkiPanel'
import SessionView from '../components/SessionView'
import VropPanel from '../components/VropPanel'
import VropThreadView from '../components/VropThreadView'

export default function Canvas({ session }) {
  const profile = useProfile(session)
  const vinki = useVinkiSessions(profile)
  const vrop = useVropThreads(profile)

  // Los lienzos creados automáticamente para sesiones tipo "Proyecto" son
  // técnicamente del usuario, pero no deben aparecer como un lienzo personal
  // más ni contar contra el límite de 5.
  const projectCanvasIds = vinki.sessions
    .filter((s) => s.mode === 'proyecto' && s.shared_canvas_id)
    .map((s) => s.shared_canvas_id)

  const {
    canvases: allCanvases,
    loading: loadingCanvases,
    addCanvas,
    removeCanvas
  } = useCanvases(profile, projectCanvasIds)

  const canvases = allCanvases.filter((c) => !projectCanvasIds.includes(c.id))

  const [activeId, setActiveId] = useState(null)
  const [notice, setNotice] = useState('')
  const [showVinkiPanel, setShowVinkiPanel] = useState(false)
  const [openSessionId, setOpenSessionId] = useState(null)
  const [showVropPanel, setShowVropPanel] = useState(false)
  const [openVropThread, setOpenVropThread] = useState(null)

  useEffect(() => {
    if (canvases.length > 0 && !canvases.some((c) => c.id === activeId)) {
      setActiveId(canvases[0].id)
    }
  }, [canvases, activeId])

  async function handleAddCanvas() {
    const { error } = await addCanvas()
    if (error) {
      setNotice(error.message)
      setTimeout(() => setNotice(''), 3000)
    }
  }

  function handleRemoveCanvas(id) {
    if (!window.confirm('¿Eliminar este lienzo y todas sus tarjetas?')) return
    removeCanvas(id)
  }

  async function handleLogout() {
    await supabase.auth.signOut()
  }

  function handleOpenSession(s) {
    setOpenSessionId(s.id)
    setShowVinkiPanel(false)
  }

  async function handleLeaveSession(sessionId) {
    if (openSessionId === sessionId) setOpenSessionId(null)
    await vinki.leaveSession(sessionId)
  }

  const activeCanvas = canvases.find((c) => c.id === activeId)
  const openSession = vinki.sessions.find((s) => s.id === openSessionId)

  if (profile === undefined || loadingCanvases) {
    return (
      <div className="page">
        <p className="canvas-empty">Cargando...</p>
      </div>
    )
  }

  return (
    <div>
      <header className="topbar">
        <h2 className="topbar-title">VINKI</h2>

        {!openSession && (
          <CanvasTabs
            canvases={canvases}
            activeId={activeId}
            onSelect={setActiveId}
            onAdd={handleAddCanvas}
            onRemove={handleRemoveCanvas}
          />
        )}

        <div className="topbar-actions">
          <button
            type="button"
            className="btn-link"
            onClick={() => setShowVropPanel(true)}
          >
            Vrop It
            {vrop.threads.length > 0 ? ` (${vrop.threads.length})` : ''}
          </button>
          <button
            type="button"
            className="btn-link"
            onClick={() => setShowVinkiPanel(true)}
          >
            VINKI-VINKI
            {vinki.sessions.length > 0 ? ` (${vinki.sessions.length})` : ''}
          </button>
          <button className="btn-link" onClick={handleLogout}>
            Salir
          </button>
        </div>
      </header>

      {notice && <div className="toast">{notice}</div>}

      {openSession ? (
        <SessionView
          session={openSession}
          profile={profile}
          vrop={vrop}
          onClose={() => setOpenSessionId(null)}
        />
      ) : (
        <CanvasBoard
          canvasId={activeId}
          emptyLabel={`${
            activeCanvas?.name || 'Tu lienzo'
          } está vacío. Tocá el botón “+” para agregar tu primera nota, link o imagen.`}
        />
      )}

      {showVinkiPanel && (
        <VinkiPanel
          profile={profile}
          canvases={canvases}
          sessions={vinki.sessions}
          normalCount={vinki.normalCount}
          proyectoCount={vinki.proyectoCount}
          onCreate={vinki.createSession}
          onJoin={vinki.joinSession}
          onLeave={handleLeaveSession}
          onOpenSession={handleOpenSession}
          onClose={() => setShowVinkiPanel(false)}
        />
      )}

      {showVropPanel && !openVropThread && (
        <VropPanel
          threads={vrop.threads}
          loading={vrop.loading}
          onOpenThread={setOpenVropThread}
          onClose={() => setShowVropPanel(false)}
        />
      )}

      {openVropThread && (
        <VropThreadView
          thread={openVropThread}
          profile={profile}
          onBack={() => setOpenVropThread(null)}
          onClose={() => {
            setOpenVropThread(null)
            setShowVropPanel(false)
          }}
        />
      )}
    </div>
  )
}
