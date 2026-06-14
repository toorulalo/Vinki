import { useVropItems, MAX_VROP_ITEMS } from '../lib/useVropItems'
import { IconBack, IconClose } from './icons/index.jsx'

function fmt(iso) {
  const d = new Date(iso)
  return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export default function VropThreadView({ thread, profile, onBack, onClose }) {
  const { items, loading } = useVropItems(thread.id)

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button type="button" className="btn-icon" onClick={onBack} aria-label="Volver">
              <IconBack size={18} />
            </button>
            <h3 className="modal-title">{thread.partner?.name || 'Vrop'}</h3>
          </div>
          <button type="button" className="btn-icon" onClick={onClose} aria-label="Cerrar">
            <IconClose size={18} />
          </button>
        </div>
        <p className="vrop-hint">Últimos {MAX_VROP_ITEMS} recursos compartidos.</p>
        {!loading && items.length === 0 && (
          <p className="vrop-hint">Todavía no se compartieron recursos acá.</p>
        )}
        {items.map((item) => {
          const isMine = item.sender_id === profile.id
          return (
            <div key={item.id} className={`vrop-item${isMine ? ' mine' : ''}`}>
              <div className="vrop-item-header">
                <span className="vrop-item-type-badge">{item.type}</span>
                <span className="vrop-item-sender">{isMine ? 'Vos' : item.sender?.name || 'Compañero/a'}</span>
                <span className="vrop-item-time">{fmt(item.created_at)}</span>
              </div>
              {item.type === 'image' ? (
                <img src={item.url} alt="" style={{ width: '100%', borderRadius: 8, maxHeight: 200, objectFit: 'cover' }} />
              ) : (
                <a className="vrop-item-url" href={item.url} target="_blank" rel="noreferrer">{item.url}</a>
              )}
              {item.note && <p className="vrop-item-note">"{item.note}"</p>}
            </div>
          )
        })}
      </div>
    </div>
  )
}
