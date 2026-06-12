import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useProfile } from '../lib/useProfile'
import { useCanvases } from '../lib/useCanvases'
import { useVinkiSessions } from '../lib/useVinkiSessions'
import { useVropThreads } from '../lib/useVropThreads'
import CanvasBoard from '../components/CanvasBoard'
import VinkiPanel from '../components/VinkiPanel'
import SessionView from '../components/SessionView'
import VropPanel from '../components/VropPanel'
import VropThreadView from '../components/VropThreadView'
import NameCanvasDialog from '../components/NameCanvasDialog'
import Onboarding from '../components/Onboarding'
import Dashboard from '../components/Dashboard'
import SettingsPanel, { getAnimationsEnabled } from '../components/SettingsPanel'

export default function Canvas({ session }) {
  const { profile, error: profileError } = useProfile(session)
  const vinki = useVinkiSessions(profile)
  const vrop = useVropThreads(profile)

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

  const [openCanvasId, setOpenCanvasId] = useState(null)
  const [displayName, setDisplayName] = useState('')
  const [notice, setNotice] = useState('')
  const [showVinkiPanel, setShowVinkiPanel] = useState(false)
  const [openSessionId, setOpenSessionId] = useState(null)
  const [showVropPanel, setShowVropPanel] = useState(false)
  const [openVropThread, setOpenVropThread] = useState(null)
  const [showNewCanvasDialog, setShowNewCanvasDialog] = useState(false)
  const [showSettings, setShowSettings] = useState(false)

  useEffect(() => {
    if (profile?.name) setDisplayName(profile.name)
  }, [profile])

  useEffect(() => {
    document.body.classList.toggle('no-animations', !getAnimationsEnabled())
  }, [])

  async function handleCreateCanvas(name) {
    const { data, error } = await addCanvas(name)
    if (!error) {
      setShowNewCanvasDialog(false)
      if (data) setOpenCanvasId(data.id)
    }
    return { error }
  }

  function handleRemoveCanvas(id) {
    if (!window.confirm('¿Eliminar este lienzo y todas sus tarjetas?')) return
    if (openCanvasId === id) setOpenCanvasId(null)
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

  const openCanvas = canvases.find((c) => c.id === openCanvasId)
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
          <h2 className="brand-title" style={{ fontSize: '1.6rem' }}>Ups</h2>
          <p className="canvas-empty" style={{ margin: '12px 0' }}>
            No pudimos cargar tu perfil.
          </p>
          {profileError && <p className="message error">{profileError}</p>}
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

  // Primera vez: intro + nombre + primer lienzo
  if (canvases.length === 0) {
    return <Onboarding profile={profile} onCreateCanvas={handleCreateCanvas} />
  }

  const inBoard = Boolean(openCanvas) || Boolean(openSession)

  return (
    <div>
      <header className="topbar">
        <div className="topbar-left">
          {inBoard ? (
            <button
              type="button"
              className="card-control-btn topbar-back"
              onClick={() => {
                setOpenCanvasId(null)
                setOpenSessionId(null)
              }}
              aria-label="Volver al inicio"
            >
              ‹
            </button>
          ) : null}
          <h2 className="topbar-title">
            {openSession ? 'VINKI-VINKI' : openCanvas ? openCanvas.name : 'VINKI'}
          </h2>
        </div>

        <div className="topbar-actions">
          <button
            type="button"
            className="btn-pill"
            onClick={() => setShowVropPanel(true)}
          >
            Vrop It{vrop.threads.length > 0 ? ` (${vrop.threads.length})` : ''}
          </button>
          <button
            type="button"
            className="btn-pill"
            onClick={() => setShowVinkiPanel(true)}
          >
            VINKI-VINKI{vinki.sessions.length > 0 ? ` (${vinki.sessions.length})` : ''}
          </button>
          <button
            type="button"
            className="btn-pill btn-pill-muted"
            onClick={() => setShowSettings(true)}
            aria-label="Configuración"
          >
            ⚙
          </button>
          <button
            className="btn-pill btn-pill-muted"
            onClick={handleLogout}
          >
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
          vinki={vinki}
          onClose={() => setOpenSessionId(null)}
        />
      ) : openCanvas ? (
        <CanvasBoard
          canvasId={openCanvas.id}
          emptyLabel={`${openCanvas.name} está vacío. Tocá el botón "+" para agregar tu primera nota, link o imagen.`}
        />
      ) : (
        <Dashboard
          profile={{ ...profile, name: displayName || profile.name }}
          canvases={canvases}
          onOpen={setOpenCanvasId}
          onAdd={() => setShowNewCanvasDialog(true)}
          onRemove={handleRemoveCanvas}
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

      {showSettings && (
        <SettingsPanel
          profile={profile}
          onNameChanged={setDisplayName}
          onClose={() => setShowSettings(false)}
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
