import { useRef, useState } from 'react'
import { useViewport, useViewportWheelBinding } from '../../lib/useViewport'
import { useToast } from '../ui/Toast'
import CardNode from './CardNode'
import AddBlockMenu from './AddBlockMenu'
import CardEditPanel from './CardEditPanel'

export default function CanvasBoard({
  canvasId,
  cards,
  loading,
  onAddCard,
  onUpdateCard,
  onRemoveCard,
  onCardOpen,
  profile,
}) {
  const containerRef = useRef(null)
  const {
    view,
    animating,
    onWheel,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    centerOn,
    screenToWorld,
  } = useViewport(containerRef)
  useViewportWheelBinding(containerRef, onWheel)

  const [editingId, setEditingId] = useState(null)
  const { showToast } = useToast()

  function openCard(id) {
    setEditingId(id)
    onCardOpen?.(id)
  }

  async function handleAddCard(type) {
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    const worldPos = screenToWorld(rect.width / 2, rect.height / 2)
    const newX = Math.round(worldPos.x - 130)
    const newY = Math.round(worldPos.y - 90)
    const { data, error } = await onAddCard(type, { x: newX, y: newY })
    if (error) {
      showToast(error.message || 'No se pudo crear la tarjeta.', 'error')
      return
    }
    if (data) {
      openCard(data.id)
      centerOn(data.x + (data.width || 260) / 2, data.y + (data.height || 180) / 2, view.scale)
    }
  }

  const worldStyle = {
    transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`,
    transformOrigin: '0 0',
    willChange: 'transform',
    width: '10000px',
    height: '10000px',
    position: 'absolute',
    top: 0,
    left: 0,
  }

  if (animating) {
    worldStyle.transition = 'transform 400ms var(--ease-out)'
  }

  const boardStyle = {
    backgroundPosition: `${view.x % 28}px ${view.y % 28}px`,
  }

  const editingCard = editingId ? cards.find((c) => c.id === editingId) : null

  return (
    <div className="board-wrapper">
      <div
        ref={containerRef}
        className="canvas-board"
        style={boardStyle}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div className="canvas-world" style={worldStyle}>
          {cards.map((card) => (
            <CardNode
              key={card.id}
              card={card}
              onEdit={() => openCard(card.id)}
              onMove={(x, y) => onUpdateCard(card.id, { x, y })}
              onResize={(w, h) => onUpdateCard(card.id, { width: w, height: h })}
              onRemove={() => onRemoveCard(card.id)}
              viewScale={view.scale}
            />
          ))}
        </div>

        {loading && (
          <div className="canvas-empty-hint">
            <div className="spinner" />
          </div>
        )}

        {!loading && cards.length === 0 && (
          <div className="canvas-empty-hint">
            <div className="canvas-empty-hint-icon">✦</div>
            <p>Toca el botón + para agregar tu primera tarjeta</p>
          </div>
        )}
      </div>

      <AddBlockMenu onAdd={handleAddCard} />

      {editingId && editingCard && (
        <>
          <div
            className="overlay-backdrop"
            onClick={() => setEditingId(null)}
            style={{ zIndex: 59 }}
          />
          <CardEditPanel
            card={editingCard}
            onUpdate={(patch) => onUpdateCard(editingId, patch)}
            onRemove={() => { onRemoveCard(editingId); setEditingId(null) }}
            onClose={() => setEditingId(null)}
            profile={profile}
          />
        </>
      )}
    </div>
  )
}
