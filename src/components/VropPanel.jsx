import { IconClose, IconInbox } from './icons/index.jsx'

export default function VropPanel({ threads, loading, onOpenThread, onClose }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <IconInbox size={18} /> Vrop It
          </h3>
          <button type="button" className="btn-icon" onClick={onClose} aria-label="Cerrar">
            <IconClose size={18} />
          </button>
        </div>
        {!loading && threads.length === 0 && (
          <p className="vrop-hint">
            Todavía no tenés ningún Vrop. Entrá a una sesión Vinki-Vinki y compartí una tarjeta — eso crea tu primer Vrop con esa persona.
          </p>
        )}
        {threads.map((t) => (
          <button type="button" key={t.id} className="vrop-thread-row" onClick={() => onOpenThread(t)}>
            <span className="vrop-thread-avatar">{(t.partner?.name || '?').slice(0, 1).toUpperCase()}</span>
            <span className="vrop-thread-name">{t.partner?.name || 'Sin nombre'}</span>
            <span style={{ color: 'var(--ink-soft)', fontSize: '1.1rem' }}>›</span>
          </button>
        ))}
      </div>
    </div>
  )
}
