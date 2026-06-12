export default function VropPanel({ threads, loading, onOpenThread, onClose }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="font-display">Vrop It</h3>
          <button
            type="button"
            className="card-control-btn"
            onClick={onClose}
            aria-label="Cerrar"
          >
            ×
          </button>
        </div>

        {!loading && threads.length === 0 && (
          <p className="canvas-empty" style={{ margin: '12px 0' }}>
            Todavía no tenés ningún Vrop. Iniciá una sesión VINKI-VINKI con
            alguien y desde ahí vas a poder enviarle tarjetas — eso crea tu
            primer Vrop con esa persona.
          </p>
        )}

        {threads.map((t) => (
          <button
            type="button"
            key={t.id}
            className="vrop-thread-row"
            onClick={() => onOpenThread(t)}
          >
            <span className="vrop-thread-avatar">
              {(t.partner?.name || '?').slice(0, 1).toUpperCase()}
            </span>
            <span className="vrop-thread-name">
              {t.partner?.name || 'Sin nombre'}
            </span>
            <span className="vrop-thread-arrow">›</span>
          </button>
        ))}
      </div>
    </div>
  )
}
