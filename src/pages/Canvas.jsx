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
import NameCanvasDialog from '../components/NameCanvasDialog'

export default function Canvas({ session }) {
  const { profile, error: profileError } = useProfile(session)
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
  const [showNewCanvasDialog, setShowNewCanvasDialog] = useState(false)

  useEffect(() => {
    if (canvases.length > 0 && !canvases.some((c) => c.id === activeId)) {
      setActiveId(canvases[0].id)
    }
  }, [canvases, activeId])

  function handleAddCanvas() {
    setShowNewCanvasDialog(true)
  }

  async function handleCreateCanvas(name) {
    const { data, error } = await addCanvas(name)
    if (!error) {
      setShowNewCanvasDialog(false)
      if (data) setActiveId(data.id)
    }
    return { error }
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

  if (profile === undefined) {
    return (
      <div className="page">
        <p className="canvas-empty">Cargando...</p>
      </div>
    )
  }

  if (profileError || !profile) {
    return (
      <div className="page">
        <div className="pinned-card" style={{ textAlign: 'center' }}>
          <h2 className="brand-title" style={{ fontSize: '1.6rem' }}>
            Ups
          </h2>
          <p className="canvas-empty" style={{ margin: '12px 0' }}>
            No pudimos cargar tu perfil.
          </p>
          {profileError && (
            <p className="message error">{profileError}</p>
          )}
          <button className="btn-primary" onClick={handleLogout}>
            Salir e intentar de nuevo
          </button>
        </div>
      </div>
    )
  }

  if (loadingCanvases) {
    return (
      <div className="page">
        <p className="canvas-empty">Cargando...</p>
      </div>
    )
  }

  if (canvases.length === 0) {
    return (
      <NameCanvasDialog
        title="Creá tu primer lienzo"
        defaultName="Mi lienzo"
        onCreate={handleCreateCanvas}
      />
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
            className="btn-pill"
            onClick={() => setShowVropPanel(true)}
          >
            Vrop It
            {vrop.threads.length > 0 ? ` (${vrop.threads.length})` : ''}
          </button>
          <button
            type="button"
            className="btn-pill"
            onClick={() => setShowVinkiPanel(true)}
          >
            VINKI-VINKI
            {vinki.sessions.length > 0 ? ` (${vinki.sessions.length})` : ''}
          </button>
          <button className="btn-pill btn-pill-muted" onClick={handleLogout}>
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

      {showNewCanvasDialog && (
        <NameCanvasDialog
          title="Nuevo lienzo"
          defaultName="Nuevo lienzo"
          onCreate={handleCreateCanvas}
          onClose={() => setShowNewCanvasDialog(false)}
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
