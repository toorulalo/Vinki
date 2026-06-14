import { useState } from 'react'
import { IconCreate, IconJoin, IconClose, IconCopy } from './icons/index.jsx'

export default function SessionEntry({ canvases, sessions, onCreate, onJoin, onClose }) {
  const [step, setStep] = useState('home') // 'home' | 'create' | 'join' | 'waiting'
  const [canvasId, setCanvasId] = useState(canvases[0]?.id || '')
  const [joinCode, setJoinCode] = useState('')
  const [createdCode, setCreatedCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function handleCreate() {
    setError(''); setBusy(true)
    const { data, error: err } = await onCreate(canvasId || null)
    setBusy(false)
    if (err) { setError(err.message); return }
    setCreatedCode(data.join_code)
    setStep('waiting')
  }

  async function handleJoin() {
    setError('')
    if (!joinCode.trim()) { setError('Escribí el código de invitación.'); return }
    setBusy(true)
    const { error: err } = await onJoin(joinCode, canvasId || null)
    setBusy(false)
    if (err) { setError(err.message); return }
    onClose()
  }

  function copyCode() { navigator.clipboard?.writeText(createdCode) }

  if (step === 'waiting') return (
    <div className="waiting-room">
      <h2 className="waiting-title">Esperando a tu compañero/a</h2>
      <p style={{ color: 'var(--ink-soft)', maxWidth: 280, textAlign: 'center' }}>
        Compartí este código. Cuando se una, la sesión empieza automáticamente.
      </p>
      <div className="waiting-code-box">
        <span className="waiting-code-label">Código de sesión</span>
        <span className="waiting-code-value">{createdCode}</span>
        <button type="button" className="btn-pill btn-pill-ghost" style={{ marginTop: 4 }} onClick={copyCode}>
          <IconCopy size={14} /> Copiar
        </button>
      </div>
      <div className="waiting-spinner" />
      <button type="button" className="btn-pill btn-pill-danger" onClick={onClose}>Cancelar</button>
    </div>
  )

  return (
    <div className="session-entry">
      <h2 className="session-entry-title">Vinki-Vinki</h2>
      <p className="session-entry-sub">Conectate en vivo con otra persona. Cada quien ve su lienzo y el del otro.</p>

      {step === 'home' && (
        <div className="session-entry-actions">
          <button type="button" className="session-entry-btn" onClick={() => setStep('create')}>
            <IconCreate size={24} /> Crear sesión
          </button>
          <button type="button" className="session-entry-btn" onClick={() => setStep('join')}>
            <IconJoin size={24} /> Unirme con código
          </button>
          <button type="button" className="btn-link" style={{ marginTop: 8 }} onClick={onClose}>Cancelar</button>
        </div>
      )}

      {(step === 'create' || step === 'join') && (
        <div className="session-entry-actions">
          {canvases.length > 0 && (
            <div className="field" style={{ width: '100%', textAlign: 'left' }}>
              <label className="field-label">Lienzo que traés</label>
              <select className="field-select" value={canvasId} onChange={(e) => setCanvasId(e.target.value)}>
                {canvases.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          )}

          {step === 'join' && (
            <div className="field" style={{ width: '100%', textAlign: 'left' }}>
              <label className="field-label">Código de invitación</label>
              <input className="field-input" type="text" value={joinCode} placeholder="Ej: AB3X7K"
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())} maxLength={8}
                style={{ textTransform: 'uppercase', letterSpacing: '0.1em', fontSize: '1.1rem' }} />
            </div>
          )}

          {error && <p className="msg msg-error" style={{ width: '100%' }}>{error}</p>}

          <button type="button" className="btn-primary" disabled={busy}
            onClick={step === 'create' ? handleCreate : handleJoin}>
            {busy ? 'Un momento...' : step === 'create' ? 'Crear sesión' : 'Unirme'}
          </button>
          <button type="button" className="btn-link" onClick={() => { setStep('home'); setError('') }}>Volver</button>
        </div>
      )}
    </div>
  )
}
