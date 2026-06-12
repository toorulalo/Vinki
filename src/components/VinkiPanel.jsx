import { useState } from 'react'
import {
  MAX_NORMAL_SESSIONS,
  MAX_PROYECTO_SESSIONS
} from '../lib/useVinkiSessions'

const MODE_LABEL = {
  normal: 'VINKI-VINKI',
  proyecto: 'Proyecto'
}

export default function VinkiPanel({
  profile,
  canvases,
  sessions,
  normalCount,
  proyectoCount,
  onCreate,
  onJoin,
  onLeave,
  onOpenSession,
  onClose
}) {
  // step: 'home' | 'create' | 'join'
  const [step, setStep] = useState('home')
  const [mode, setMode] = useState('normal')
  const [canvasForCreate, setCanvasForCreate] = useState(canvases[0]?.id || '')
  const [canvasForJoin, setCanvasForJoin] = useState(canvases[0]?.id || '')
  const [joinCode, setJoinCode] = useState('')
  const [createdCode, setCreatedCode] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const canCreate =
    mode === 'normal'
      ? normalCount < MAX_NORMAL_SESSIONS
      : proyectoCount < MAX_PROYECTO_SESSIONS

  async function handleCreate() {
    setError('')
    setBusy(true)
    const { data, error: err } = await onCreate(mode, canvasForCreate || null)
    setBusy(false)
    if (err) {
      setError(err.message)
      return
    }
    setCreatedCode(data.id)
  }

  async function handleJoin() {
    setError('')
    if (!joinCode.trim()) {
      setError('Pegá el código que te compartieron.')
      return
    }
    setBusy(true)
    const { error: err } = await onJoin(joinCode, canvasForJoin || null)
    setBusy(false)
    if (err) {
      setError(err.message)
      return
    }
    setJoinCode('')
    setStep('home')
  }

  function copyCode(code) {
    navigator.clipboard?.writeText(code)
  }

  function goBack() {
    setStep('home')
    setError('')
    setCreatedCode('')
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {step !== 'home' && (
              <button
                type="button"
                className="card-control-btn"
                onClick={goBack}
                aria-label="Volver"
              >
                ‹
              </button>
            )}
            <h3 className="font-display">VINKI-VINKI</h3>
          </div>
          <button
            type="button"
            className="card-control-btn"
            onClick={onClose}
            aria-label="Cerrar"
          >
            ×
          </button>
        </div>

        {step === 'home' && (
          <>
            {sessions.length > 0 && (
              <section className="vinki-section">
                <h4>Tus sesiones</h4>
                {sessions.map((s) => {
                  const partners = s.participants.filter(
                    (p) => p.user_id !== profile.id
                  )
                  const partnerNames =
                    partners.length > 0
                      ? partners.map((p) => p.users?.name || '...').join(', ')
                      : 'Esperando a alguien más...'

                  return (
                    <div className="vinki-session-row" key={s.id}>
                      <div>
                        <span className="session-mode-badge">
                          {MODE_LABEL[s.mode]}
                        </span>
                        <p className="session-partners">{partnerNames}</p>
                      </div>
                      <div className="vinki-session-actions">
                        <button
                          type="button"
                          className="btn-link"
                          onClick={() => onOpenSession(s)}
                        >
                          Abrir
                        </button>
                        <button
                          type="button"
                          className="btn-link btn-danger"
                          onClick={() => onLeave(s.id)}
                        >
                          Salir
                        </button>
                      </div>
                    </div>
                  )
                })}
              </section>
            )}

            <div className="vinki-choice">
              <button
                type="button"
                className="vinki-choice-btn"
                onClick={() => setStep('create')}
              >
                <span className="vinki-choice-icon">✨</span>
                Crear sesión
              </button>
              <button
                type="button"
                className="vinki-choice-btn"
                onClick={() => setStep('join')}
              >
                <span className="vinki-choice-icon">🔗</span>
                Unirme con código
              </button>
            </div>
          </>
        )}

        {step === 'create' && (
          <section className="vinki-section">
            <h4>Crear nueva sesión</h4>
            <div className="field">
              <label>Tipo</label>
              <div className="mode-options">
                <label className="mode-option">
                  <input
                    type="radio"
                    name="mode"
                    value="normal"
                    checked={mode === 'normal'}
                    onChange={() => setMode('normal')}
                  />
                  VINKI-VINKI (en vivo, 1 a la vez)
                </label>
                <label className="mode-option">
                  <input
                    type="radio"
                    name="mode"
                    value="proyecto"
                    checked={mode === 'proyecto'}
                    onChange={() => setMode('proyecto')}
                  />
                  Proyecto (hasta {MAX_PROYECTO_SESSIONS} activos)
                </label>
              </div>
            </div>

            {canvases.length > 0 && (
              <div className="field">
                <label htmlFor="canvas-create">Lienzo que vas a traer</label>
                <select
                  id="canvas-create"
                  value={canvasForCreate}
                  onChange={(e) => setCanvasForCreate(e.target.value)}
                >
                  {canvases.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <button
              type="button"
              className="btn-primary"
              onClick={handleCreate}
              disabled={!canCreate || busy}
            >
              {canCreate ? (busy ? 'Creando...' : 'Crear sesión') : 'Límite alcanzado'}
            </button>

            {createdCode && (
              <div className="code-box">
                <p>Compartí este código con tu compañero/a:</p>
                <div className="code-value">
                  <code>{createdCode}</code>
                  <button
                    type="button"
                    className="btn-link"
                    onClick={() => copyCode(createdCode)}
                  >
                    Copiar
                  </button>
                </div>
              </div>
            )}

            {error && <p className="message error">{error}</p>}
          </section>
        )}

        {step === 'join' && (
          <section className="vinki-section">
            <h4>Unirse con código</h4>
            <div className="field">
              <label htmlFor="join-code">Código de invitación</label>
              <input
                id="join-code"
                type="text"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value)}
                placeholder="Pegá el código acá"
              />
            </div>

            {canvases.length > 0 && (
              <div className="field">
                <label htmlFor="canvas-join">Lienzo que vas a traer</label>
                <select
                  id="canvas-join"
                  value={canvasForJoin}
                  onChange={(e) => setCanvasForJoin(e.target.value)}
                >
                  {canvases.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <button
              type="button"
              className="btn-primary"
              onClick={handleJoin}
              disabled={busy}
            >
              {busy ? 'Uniéndome...' : 'Unirme'}
            </button>

            {error && <p className="message error">{error}</p>}
          </section>
        )}
      </div>
    </div>
  )
}
