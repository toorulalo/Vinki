import { useState } from 'react'
import CanvasCard from './CanvasCard'
import FriendsPanel from './FriendsPanel'
import ReviewHub from './ReviewHub'
import Avatar from '../ui/Avatar'

export default function Dashboard({
  profile,
  canvases,
  loading,
  onOpenCanvas,
  onAddCanvas,
  onRemoveCanvas,
  onRenameCanvas,
  session,
  partner,
  onEnterSession,
  onCreateSession,
  onLeaveSession,
}) {
  const [showFriends, setShowFriends] = useState(false)
  const [addingCanvas, setAddingCanvas] = useState(false)
  const [newCanvasTitle, setNewCanvasTitle] = useState('')
  const [addError, setAddError] = useState('')

  async function handleAddCanvas(e) {
    e.preventDefault()
    const title = newCanvasTitle.trim() || 'Nuevo lienzo'
    const { error } = await onAddCanvas(title)
    if (error) {
      setAddError(error.message)
    } else {
      setNewCanvasTitle('')
      setAddingCanvas(false)
      setAddError('')
    }
  }

  function startAddCanvas() {
    if (canvases.length >= 5) return
    setAddingCanvas(true)
    setNewCanvasTitle('')
    setAddError('')
  }

  return (
    <>
      <div className="dashboard" style={{ paddingTop: 64 }}>
        {/* Greeting */}
        <p className="dashboard-greeting">
          Hola, {profile.display_name} 👋
        </p>
        <p className="dashboard-sub">¿Qué vas a estudiar hoy?</p>

        {/* Flashcards due today */}
        <ReviewHub profile={profile} />

        {/* Canvas grid */}
        <p className="dashboard-section-title">Mis lienzos</p>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}>
            <div className="spinner" />
          </div>
        ) : (
        <div className="canvas-grid">
          {canvases.map((canvas, i) => (
            <CanvasCard
              key={canvas.id}
              canvas={canvas}
              colorIndex={i}
              onOpen={() => onOpenCanvas(canvas.id)}
              onRemove={() => onRemoveCanvas(canvas.id)}
              onRename={(title) => onRenameCanvas(canvas.id, title)}
            />
          ))}

          {canvases.length < 5 && !addingCanvas && (
            <button
              type="button"
              className="canvas-card canvas-card-add"
              onClick={startAddCanvas}
              aria-label="Nuevo lienzo"
            >
              <span style={{ fontSize: 28, lineHeight: 1, color: 'var(--text-muted)' }}>+</span>
              <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', marginTop: 4 }}>
                Nuevo lienzo
              </span>
            </button>
          )}

          {addingCanvas && (
            <form
              onSubmit={handleAddCanvas}
              className="canvas-card"
              style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 12 }}
            >
              <input
                className="field-input"
                type="text"
                placeholder="Nombre del lienzo"
                value={newCanvasTitle}
                onChange={e => setNewCanvasTitle(e.target.value)}
                maxLength={60}
                autoFocus
                style={{ fontSize: 'var(--text-sm)' }}
              />
              {addError && (
                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-danger, #ef4444)', margin: 0 }}>
                  {addError}
                </p>
              )}
              <div style={{ display: 'flex', gap: 6 }}>
                <button type="submit" className="btn btn-primary btn-sm" style={{ flex: 1 }}>
                  Crear
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => { setAddingCanvas(false); setAddError('') }}
                >
                  Cancelar
                </button>
              </div>
            </form>
          )}
        </div>
        )}

        {/* Vinki-Vinki section */}
        <p className="dashboard-section-title">Vinki-Vinki</p>

        {session ? (
          <ActiveSession
            partner={partner}
            onEnter={onEnterSession}
            onLeave={onLeaveSession}
          />
        ) : (
          <div
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              padding: '20px 16px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 12,
              textAlign: 'center',
            }}
          >
            <p style={{ fontSize: 'var(--text-lg)', fontFamily: 'var(--font-display)', fontWeight: 700, margin: 0 }}>
              Estudia acompañado
            </p>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
              Crea una sesión Vinki-Vinki e invita a un amigo a estudiar juntos.
            </p>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setShowFriends(true)}
            >
              Estudiar con alguien
            </button>
          </div>
        )}
      </div>

      {showFriends && (
        <FriendsPanel
          profile={profile}
          session={session}
          onClose={() => setShowFriends(false)}
          onCreateSession={onCreateSession}
        />
      )}
    </>
  )
}

function ActiveSession({ partner, onEnter, onLeave }) {
  const partnerProfile = partner?.profile
  return (
    <div
      style={{
        background: 'var(--color-primary-soft)',
        border: '1px solid var(--color-primary)',
        borderRadius: 'var(--radius-lg)',
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span className="presence-dot online" />
        <span
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 700,
            fontSize: 'var(--text-sm)',
            color: 'var(--color-primary)',
          }}
        >
          Vinki-Vinki activo
        </span>
        {partnerProfile && (
          <Avatar
            displayName={partnerProfile.display_name}
            color={partnerProfile.avatar_color || '#E07240'}
            size="sm"
          />
        )}
      </div>
      <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', margin: 0 }}>
        {partnerProfile
          ? `Estás estudiando con ${partnerProfile.display_name}.`
          : 'Tienes una sesión activa de estudio compartido.'}
      </p>
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" className="btn btn-primary btn-sm" style={{ flex: 1 }} onClick={onEnter}>
          Entrar
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => {
            if (window.confirm('¿Salir de la sesión Vinki-Vinki?')) onLeave()
          }}
        >
          Salir
        </button>
      </div>
    </div>
  )
}
