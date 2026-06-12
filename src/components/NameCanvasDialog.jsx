import { useState } from 'react'

export default function NameCanvasDialog({
  title,
  defaultName,
  onCreate,
  onClose
}) {
  const [name, setName] = useState(defaultName || '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    const { error: err } = await onCreate(name.trim() || defaultName)
    setBusy(false)
    if (err) setError(err.message)
  }

  return (
    <div className="modal-overlay">
      <form
        className="modal"
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
      >
        <div className="modal-header">
          <h3 className="font-display">{title}</h3>
          {onClose && (
            <button
              type="button"
              className="card-control-btn"
              onClick={onClose}
              aria-label="Cerrar"
            >
              ×
            </button>
          )}
        </div>

        <div className="field">
          <label htmlFor="canvas-name">Nombre del lienzo</label>
          <input
            id="canvas-name"
            type="text"
            value={name}
            placeholder={defaultName}
            autoFocus
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <button className="btn-primary" type="submit" disabled={busy}>
          {busy ? 'Creando...' : 'Crear lienzo'}
        </button>

        {error && <p className="message error">{error}</p>}
      </form>
    </div>
  )
}
