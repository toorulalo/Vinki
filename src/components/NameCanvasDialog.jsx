import { useState } from 'react'
import { IconClose } from './icons/index.jsx'

export default function NameCanvasDialog({ title, defaultName, onCreate, onClose }) {
  const [name, setName] = useState(defaultName || '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setBusy(true); setError('')
    const { error: err } = await onCreate(name.trim() || defaultName)
    setBusy(false)
    if (err) setError(err.message)
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit}>
        <div className="modal-header">
          <h3 className="modal-title">{title}</h3>
          {onClose && (
            <button type="button" className="btn-icon" onClick={onClose} aria-label="Cerrar">
              <IconClose size={18} />
            </button>
          )}
        </div>
        <div className="field">
          <label className="field-label">Nombre del lienzo</label>
          <input className="field-input" type="text" value={name} placeholder={defaultName}
            autoFocus onChange={(e) => setName(e.target.value)} />
        </div>
        <button className="btn-primary" type="submit" disabled={busy}>
          {busy ? 'Creando...' : 'Crear lienzo'}
        </button>
        {error && <p className="msg msg-error">{error}</p>}
      </form>
    </div>
  )
}
