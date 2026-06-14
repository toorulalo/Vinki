import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useProfile } from '../lib/useProfile'
import { useCanvases } from '../lib/useCanvases'
import { useSessions } from '../lib/useSessions'
import { useVropThreads } from '../lib/useVropThreads'
import { useHistory } from '../lib/useHistory'
import CanvasBoard from '../components/CanvasBoard'
import CanvasTopBar from '../components/CanvasTopBar'
import SessionEntry from '../components/SessionEntry'
import SessionView from '../components/SessionView'
import VropPanel from '../components/VropPanel'
import VropThreadView from '../components/VropThreadView'
import NameCanvasDialog from '../components/NameCanvasDialog'
import Onboarding from '../components/Onboarding'
import Dashboard from '../components/Dashboard'
import SettingsPanel, { getAnimationsEnabled } from '../components/SettingsPanel'
import { IconSettings, IconInbox, IconVinki, IconBack } from '../components/icons/index.jsx'

export default function Canvas({ session }) {
  const { profile, error: profileError } = useProfile(session)
  const { canvases, loading: loadingCanvases, addCanvas, removeCanvas, renameCanvas } = useCanvases(profile)
  const sessions = useSessions(profile)
  const vrop     = useVropThreads(profile)
  const history  = useHistory()

  const [openCanvasId,   setOpenCanvasId]   = useState(null)
  const [displayName,    setDisplayName]    = useState('')
  const [notice,         setNotice]         = useState('')
  const [showVinkiEntry, setShowVinkiEntry] = useState(false)
  const [openSessionId,  setOpenSessionId]  = useState(null)
  const [showVropPanel,  setShowVropPanel]  = useState(false)
  const [openVropThread, setOpenVropThread] = useState(null)
  const [showNewCanvas,  setShowNewCanvas]  = useState(false)
  const [showSettings,   setShowSettings]   = useState(false)

  const boardDeleteRef = useRef(null)

  useEffect(() => { if (profile?.name) setDisplayName(profile.name) }, [profile])
  useEffect(() => { document.body.classList.toggle('no-animations', !getAnimationsEnabled()) }, [])

  // Cuando se une alguien a la sesión creada, abrir la sesión automáticamente
  const activeSession = sessions.sessions[0]
  useEffect(() => {
    if (activeSession && activeSession.participants.length >= 2 && !openSessionId && showVinkiEntry) {
      setOpenSessionId(activeSession.id)
      setShowVinkiEntry(false)
    }
  }, [activeSession, openSessionId, showVinkiEntry])

  async function handleCreateCanvas(name) {
    const { data, error } = await addCanvas(name)
    if (!error) { setShowNewCanvas(false); if (data) { setOpenCanvasId(data.id); history.clear() } }
    return { error }
  }

  async function handleRemoveCanvas(id) {
    if (!window.confirm('¿Eliminar este lienzo y todas sus tarjetas?')) return
    if (openCanvasId === id) setOpenCanvasId(null)
    const { error } = await removeCanvas(id)
    if (error) { setNotice('No se pudo eliminar. Intentá de nuevo.'); setTimeout(() => setNotice(''), 4000) }
  }

  function handleOpenCanvas(id) { setOpenCanvasId(id); history.clear() }
  function handleCloseCanvas()  { setOpenCanvasId(null); history.clear() }

  const openCanvas  = canvases.find((c) => c.id === openCanvasId)
  const openSession = sessions.sessions.find((s) => s.id === openSessionId)
  const inBoard     = Boolean(openCanvas) || Boolean(openSession) || showVinkiEntry

  // Guards de carga
  if (profile === undefined) return <div className="page"><p className="text-muted">Cargando...</p></div>
  if (profileError || !profile) return (
    <div className="page">
      <div className="paper-card" style={{ textAlign: 'center' }}>
        <h2 style={{ color: 'var(--terracota)', marginBottom: 12 }}>Algo salió mal</h2>
        {profileError && <p className="msg msg-error">{profileError}</p>}
        <button className="btn-primary" style={{ marginTop: 12 }} onClick={() => supabase.auth.signOut()}>
          Salir e intentar de nuevo
        </button>
      </div>
    </div>
  )
  if (loadingCanvases || sessions.loading) return <div className="page"><p className="text-muted">Cargando...</p></div>
  if (canvases.length === 0) return <Onboarding profile={profile} onCreateCanvas={handleCreateCanvas} />

  return (
    <div>
      {/* Topbar */}
      <header className="topbar">
        {openCanvas ? (
          <CanvasTopBar
            title={openCanvas.name}
            onBack={handleCloseCanvas}
            onRename={(name) => renameCanvas(openCanvasId, name)}
            onUndo={history.undo}
            onRedo={history.redo}
            onDeleteMode={() => boardDeleteRef.current?.click()}
            canUndo={history.canUndo}
            canRedo={history.canRedo}
          />
        ) : (
          <>
            <div className="topbar-left">
              {(openSession || showVinkiEntry) && (
                <button type="button" className="btn-icon" onClick={() => { setOpenSessionId(null); setShowVinkiEntry(false) }} aria-label="Volver">
                  <IconBack size={20} />
                </button>
              )}
              <span className="topbar-title">
                {openSession ? 'Vinki-Vinki' : showVinkiEntry ? 'Vinki-Vinki' : 'VINKI'}
              </span>
            </div>
            {!inBoard && (
              <div className="topbar-actions">
                <button type="button" className="btn-pill btn-pill-ghost" onClick={() => setShowVropPanel(true)}>
                  <IconInbox size={15} /> Vrop It
                </button>
                <button type="button" className="btn-pill btn-pill-ghost" onClick={() => setShowVinkiEntry(true)}>
                  <IconVinki size={15} /> Vinki-Vinki
                </button>
                <button type="button" className="btn-icon" onClick={() => setShowSettings(true)} aria-label="Ajustes">
                  <IconSettings size={20} />
                </button>
              </div>
            )}
          </>
        )}
      </header>

      {notice && <div className="toast">{notice}</div>}

      {/* Contenido principal */}
      {openSession ? (
        <SessionView
          session={openSession}
          profile={profile}
          vrop={vrop}
          sessions={sessions}
          onClose={() => setOpenSessionId(null)}
        />
      ) : openCanvas ? (
        <>
          <CanvasBoard
            canvasId={openCanvas.id}
            emptyLabel={`${openCanvas.name} está vacío. Tocá + para agregar tu primera nota o link.`}
            history={history}
          />
          {/* Trigger oculto para DeleteMode desde CanvasTopBar */}
          <div ref={boardDeleteRef} style={{ display: 'none' }} />
        </>
      ) : showVinkiEntry ? (
        <div style={{ paddingTop: 56 }}>
          <SessionEntry
            canvases={canvases}
            sessions={sessions.sessions}
            onCreate={sessions.createSession}
            onJoin={async (code, canvasId) => {
              const result = await sessions.joinSession(code, canvasId)
              if (!result.error) {
                await sessions.reload()
                setOpenSessionId(sessions.sessions[0]?.id)
                setShowVinkiEntry(false)
              }
              return result
            }}
            onClose={() => setShowVinkiEntry(false)}
          />
        </div>
      ) : (
        <Dashboard
          profile={{ ...profile, name: displayName || profile.name }}
          canvases={canvases}
          onOpen={handleOpenCanvas}
          onAdd={() => setShowNewCanvas(true)}
          onRemove={handleRemoveCanvas}
        />
      )}

      {/* Modales globales */}
      {showNewCanvas && (
        <NameCanvasDialog title="Nuevo lienzo" defaultName="Nuevo lienzo"
          onCreate={handleCreateCanvas} onClose={() => setShowNewCanvas(false)} />
      )}
      {showSettings && (
        <SettingsPanel profile={profile} onNameChanged={setDisplayName} onClose={() => setShowSettings(false)} />
      )}
      {showVropPanel && !openVropThread && (
        <VropPanel threads={vrop.threads} loading={vrop.loading}
          onOpenThread={setOpenVropThread} onClose={() => setShowVropPanel(false)} />
      )}
      {openVropThread && (
        <VropThreadView thread={openVropThread} profile={profile}
          onBack={() => setOpenVropThread(null)}
          onClose={() => { setOpenVropThread(null); setShowVropPanel(false) }} />
      )}
    </div>
  )
}
