import { MAX_CANVASES } from '../lib/useCanvases'

export default function CanvasTabs({
  canvases,
  activeId,
  onSelect,
  onAdd,
  onRemove
}) {
  const canAdd = canvases.length < MAX_CANVASES

  return (
    <div className="canvas-tabs">
      {canvases.map((c) => (
        <div
          key={c.id}
          className={`canvas-tab${c.id === activeId ? ' active' : ''}`}
        >
          <button
            type="button"
            className="canvas-tab-btn"
            onClick={() => onSelect(c.id)}
          >
            {c.name}
          </button>
          {canvases.length > 1 && (
            <button
              type="button"
              className="canvas-tab-remove"
              onClick={() => onRemove(c.id)}
              aria-label={`Eliminar ${c.name}`}
              title={`Eliminar ${c.name}`}
            >
              ×
            </button>
          )}
        </div>
      ))}

      {canAdd && (
        <button
          type="button"
          className="canvas-tab-add"
          onClick={onAdd}
          title="Nuevo lienzo"
          aria-label="Nuevo lienzo"
        >
          +
        </button>
      )}
    </div>
  )
}
