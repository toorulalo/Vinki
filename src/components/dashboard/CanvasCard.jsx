import { useState, useRef, useEffect } from 'react'

// Props: { canvas, colorIndex, onOpen, onRemove, onRename }

const COLOR_CLASSES = ['color-0', 'color-1', 'color-2', 'color-3', 'color-4']

function relativeDate(dateStr) {
  if (!dateStr) return ''
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins  = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days  = Math.floor(diff / 86400000)
  if (mins < 1)   return 'ahora mismo'
  if (mins < 60)  return `hace ${mins} min`
  if (hours < 24) return `hace ${hours}h`
  if (days === 1) return 'ayer'
  if (days < 7)   return `hace ${days} días`
  return new Date(dateStr).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })
}

export default function CanvasCard({ canvas, colorIndex = 0, onOpen, onRemove, onRename }) {
  const colorClass = COLOR_CLASSES[colorIndex % COLOR_CLASSES.length]
  const [renaming, setRenaming] = useState(false)
  const [title, setTitle] = useState(canvas.title)
  const inputRef = useRef(null)

  useEffect(() => {
    if (renaming) inputRef.current?.select()
  }, [renaming])

  function handleRemove(e) {
    e.stopPropagation()
    if (window.confirm(`¿Eliminar "${canvas.title}" y todas sus tarjetas?`)) {
      onRemove()
    }
  }

  function startRename(e) {
    e.stopPropagation()
    setTitle(canvas.title)
    setRenaming(true)
  }

  function commitRename() {
    setRenaming(false)
    const t = title.trim()
    if (t && t !== canvas.title) onRename?.(t)
    else setTitle(canvas.title)
  }

  return (
    <div
      className="canvas-card"
      onClick={() => { if (!renaming) onOpen() }}
      role="button"
      tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && !renaming && onOpen()}
      style={{ cursor: 'pointer', position: 'relative' }}
    >
      {/* Organic patterned preview */}
      <div className={`canvas-card-preview ${colorClass}`} />

      {/* Body */}
      <div className="canvas-card-body">
        {renaming ? (
          <input
            ref={inputRef}
            className="field-input"
            value={title}
            maxLength={60}
            onClick={e => e.stopPropagation()}
            onChange={e => setTitle(e.target.value)}
            onBlur={commitRename}
            onKeyDown={e => {
              if (e.key === 'Enter') e.currentTarget.blur()
              if (e.key === 'Escape') { setTitle(canvas.title); setRenaming(false) }
            }}
            style={{ fontSize: 'var(--text-sm)', padding: '4px 8px' }}
          />
        ) : (
          <p className="canvas-card-title">{canvas.title}</p>
        )}
        <p className="canvas-card-meta">
          {relativeDate(canvas.updated_at || canvas.created_at)}
        </p>
      </div>

      {/* Action buttons — on hover for pointers, always visible on touch */}
      <div className="canvas-card-actions" style={{ position: 'absolute', top: 7, right: 7, display: 'flex', gap: 4 }}>
        {onRename && (
          <button
            type="button"
            onClick={startRename}
            aria-label="Renombrar lienzo"
            className="canvas-card-action-btn"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
            </svg>
          </button>
        )}
        <button
          type="button"
          onClick={handleRemove}
          aria-label="Eliminar lienzo"
          className="canvas-card-action-btn"
          style={{ fontSize: 15 }}
        >
          ×
        </button>
      </div>

      <style>{`
        .canvas-card-action-btn {
          width: 26px;
          height: 26px;
          border-radius: 50%;
          background: rgba(0,0,0,0.32);
          border: none;
          color: #fff;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          opacity: 0;
          transition: opacity 0.15s ease, transform 0.12s ease;
          padding: 0;
        }
        .canvas-card:hover .canvas-card-action-btn,
        .canvas-card:focus-within .canvas-card-action-btn { opacity: 1; }
        .canvas-card-action-btn:hover { transform: scale(1.12); }
        @media (hover: none) {
          .canvas-card-action-btn { opacity: 0.85; }
        }
      `}</style>
    </div>
  )
}
