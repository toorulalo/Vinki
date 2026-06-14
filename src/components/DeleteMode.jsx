import { IconNote, IconLinkCard, IconTrash, IconClose, IconX } from './icons/index.jsx'

const TYPE_ICON = { note: IconNote, link: IconLinkCard }

function cardSummary(card) {
  if (card.type === 'note') return card.content?.note?.slice(0, 50) || 'Nota vacía'
  return card.title || card.content?.url?.slice(0, 50) || 'Link vacío'
}

export default function DeleteMode({ cards, selected, onToggle, onConfirm, onCancel }) {
  return (
    <div className="delete-mode-panel">
      <div style={{ padding: '12px 12px 8px', borderBottom: '2px solid var(--paper-dot)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '0.9rem', color: 'var(--ink)' }}>
          Seleccionar para eliminar
        </span>
        <button type="button" className="btn-icon-sm" onClick={onCancel} aria-label="Cancelar">
          <IconClose size={16} />
        </button>
      </div>

      <div className="delete-mode-list">
        {cards.length === 0 && (
          <p style={{ color: 'var(--ink-faint)', fontSize: '0.85rem', textAlign: 'center', marginTop: 16 }}>
            El lienzo está vacío.
          </p>
        )}
        {cards.map((card) => {
          const Icon = TYPE_ICON[card.type] || IconNote
          const isSel = selected.includes(card.id)
          return (
            <div key={card.id} className={`delete-mode-row${isSel ? ' selected' : ''}`} onClick={() => onToggle(card.id)}>
              <Icon size={16} className="delete-mode-row-icon" />
              <span className="delete-mode-row-text">{cardSummary(card)}</span>
              {isSel && <IconX size={14} style={{ color: 'var(--terracota-d)', flexShrink: 0 }} />}
            </div>
          )
        })}
      </div>

      <div className="delete-mode-footer">
        <button type="button" className="btn-pill" style={{ flex: 1, background: selected.length ? 'var(--danger)' : 'var(--paper-dot)', color: selected.length ? 'var(--bone)' : 'var(--ink-soft)' }}
          onClick={onConfirm} disabled={selected.length === 0}>
          <IconTrash size={15} />
          Eliminar ({selected.length})
        </button>
        <button type="button" className="btn-pill btn-pill-ghost" onClick={onCancel}>Cancelar</button>
      </div>
    </div>
  )
}
