// Props: { canvas, colorIndex, onOpen, onRemove }

const CARD_GRADIENTS = [
  'linear-gradient(135deg, #2E7D52 0%, #4CAF76 100%)',
  'linear-gradient(135deg, #E07240 0%, #F0A070 100%)',
  'linear-gradient(135deg, #3D8FA6 0%, #5EB5CE 100%)',
  'linear-gradient(135deg, #8B5CF6 0%, #A78BFA 100%)',
  'linear-gradient(135deg, #F0B429 0%, #FBBF24 100%)',
]

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
  const gradient = CARD_GRADIENTS[colorIndex % CARD_GRADIENTS.length]

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
      {/* Preview area */}
      <div
        className="canvas-card-preview"
        style={{ background: gradient, height: 80 }}
      />

      {/* Body */}
      <div className="canvas-card-body">
        <p className="canvas-card-title">{canvas.title}</p>
        <p className="canvas-card-meta">
          {relativeDate(canvas.updated_at || canvas.created_at)}
        </p>
      </div>

      {/* Remove button — appears on hover via CSS */}
      <button
        type="button"
        onClick={handleRemove}
        aria-label="Eliminar lienzo"
        className="canvas-card-delete-btn"
        style={{
          position: 'absolute',
          top: 6,
          right: 6,
          width: 24,
          height: 24,
          borderRadius: '50%',
          background: 'rgba(0,0,0,0.35)',
          border: 'none',
          color: '#fff',
          fontSize: 14,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: 0,
          transition: 'opacity 0.15s ease',
          padding: 0,
        }}
      >
        ×
      </button>

      <style>{`
        .canvas-card:hover .canvas-card-delete-btn { opacity: 1 !important; }
      `}</style>
    </div>
  )
}
