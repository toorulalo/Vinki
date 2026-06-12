import { useVropItems, MAX_VROP_ITEMS } from '../lib/useVropItems'

const TYPE_LABEL = {
  note: 'Nota',
  link: 'Link',
  image: 'Imagen'
}

function formatTime(iso) {
  const d = new Date(iso)
  return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit'
  })
}

export default function VropThreadView({ thread, profile, onBack, onClose }) {
  const { items, loading } = useVropItems(thread.id)

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              type="button"
              className="card-control-btn"
              onClick={onBack}
              aria-label="Volver"
            >
              ‹
            </button>
            <h3 className="font-display">{thread.partner?.name || 'Vrop'}</h3>
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

        <p className="vrop-thread-hint">
          Últimos {MAX_VROP_ITEMS} ítems compartidos entre vos y{' '}
          {thread.partner?.name || 'esta persona'}.
        </p>

        {!loading && items.length === 0 && (
          <p className="canvas-empty" style={{ margin: '12px 0' }}>
            Todavía no se mandaron nada acá. Desde una sesión VINKI-VINKI,
            tocá el ícono ➤ en una tarjeta para enviarla.
          </p>
        )}

        {items.map((item) => {
          const isMine = item.sender_id === profile.id
          const preview =
            item.type === 'note'
              ? item.content?.text
              : item.content?.url

          return (
            <div
              className={`vrop-item${isMine ? ' mine' : ''}`}
              key={item.id}
            >
              <div className="vrop-item-header">
                <span className="session-mode-badge">
                  {TYPE_LABEL[item.type]}
                </span>
                <span className="vrop-item-sender">
                  {isMine ? 'Vos' : item.sender?.name || 'Compañero/a'}
                </span>
                <span className="vrop-item-time">
                  {formatTime(item.created_at)}
                </span>
              </div>

              {item.type === 'image' && preview ? (
                <img className="card-image-preview" src={preview} alt="" />
              ) : item.type === 'link' && preview ? (
                <a
                  className="card-link-preview"
                  href={preview}
                  target="_blank"
                  rel="noreferrer"
                >
                  {preview}
                </a>
              ) : (
                <p className="vrop-item-content">
                  {preview || '(vacío)'}
                </p>
              )}

              {item.note && <p className="vrop-item-note">"{item.note}"</p>}
            </div>
          )
        })}
      </div>
    </div>
  )
}
