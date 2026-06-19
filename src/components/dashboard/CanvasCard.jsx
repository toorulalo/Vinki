// Props: { canvas, colorIndex, onOpen, onRemove }

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

export default function CanvasCard({ canvas, colorIndex = 0, onOpen, onRemove }) {
  const colorClass = COLOR_CLASSES[colorIndex % COLOR_CLASSES.length]

  function handleRemove(e) {
    e.stopPropagation()
    if (window.confirm(`¿Eliminar "${canvas.title}" y todas sus tarjetas?`)) {
      onRemove()
    }
  }

  return (
    <div
      className="canvas-card"
      onClick={onOpen}
      role="button"
      tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && onOpen()}
      style={{ cursor: 'pointer', position: 'relative' }}
    >
      {/* Organic patterned preview */}
      <div className={`canvas-card-preview ${colorClass}`} />

      {/* Body */}
      <div className="canvas-card-body">
        <p className="canvas-card-title">{canvas.title}</p>
        <p className="canvas-card-meta">
          {relativeDate(canvas.updated_at || canvas.created_at)}
        </p>
      </div>

      {/* Remove button — appears on hover */}
      <button
        type="button"
        onClick={handleRemove}
        aria-label="Eliminar lienzo"
        className="canvas-card-delete-btn"
        style={{
          position: 'absolute',
          top: 7,
          right: 7,
          width: 26,
          height: 26,
          borderRadius: '50%',
          background: 'rgba(0,0,0,0.32)',
          border: 'none',
          color: '#fff',
          fontSize: 15,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: 0,
          transition: 'opacity 0.15s ease, transform 0.12s ease',
          padding: 0,
        }}
      >
        ×
      </button>

      <style>{`
        .canvas-card:hover .canvas-card-delete-btn { opacity: 1 !important; }
        .canvas-card-delete-btn:hover { transform: scale(1.12); }
      `}</style>
    </div>
  )
}
