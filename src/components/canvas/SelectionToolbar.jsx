export default function SelectionToolbar({ card, onEdit, onDelete, onClose }) {
  return (
    <div className="selection-toolbar">
      <button
        type="button"
        className="selection-toolbar-btn"
        onClick={(e) => { e.stopPropagation(); onEdit() }}
        aria-label="Editar tarjeta"
      >
        ✏️ Editar
      </button>

      <div className="selection-toolbar-divider" />

      <button
        type="button"
        className="selection-toolbar-btn danger"
        onClick={(e) => {
          e.stopPropagation()
          if (window.confirm('¿Eliminar esta tarjeta?')) {
            onDelete()
          }
        }}
        aria-label="Eliminar tarjeta"
      >
        🗑 Eliminar
      </button>
    </div>
  )
}
