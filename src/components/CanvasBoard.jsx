import { useState, useRef, useEffect } from 'react'
import { useCards, MAX_CARDS } from '../lib/useCards'
import { useViewport, useViewportWheelBinding } from '../lib/useViewport'
import CardItem from './CardItem'
import CardEditPanel from './CardEditPanel'
import AddCardMenu from './AddCardMenu'
import DeleteMode from './DeleteMode'

const COACH_KEY = 'vinki-v4-coach'
const DOT_SIZE  = 22
const CARD_W    = 190
const CARD_H    = 150

function findFreeSpot(cards, sx, sy) {
  function overlaps(x, y) { return cards.some((c) => Math.abs(c.x - x) < CARD_W && Math.abs(c.y - y) < CARD_H) }
  if (!overlaps(sx, sy)) return { x: sx, y: sy }
  for (let r = 1; r <= 14; r++) {
    const s = r * 44
    for (const [x, y] of [[sx+s,sy],[sx-s,sy],[sx,sy+s],[sx,sy-s],[sx+s,sy+s],[sx-s,sy-s],[sx+s,sy-s],[sx-s,sy+s]])
      if (!overlaps(x, y)) return { x, y }
  }
  return { x: sx, y: sy }
}

export default function CanvasBoard({ canvasId, emptyLabel, readOnly = false, onSendToVrop, onCardOpened, history }) {
  const { cards, addCard, updateCard, updateCardLocal, removeCard, removeCards } = useCards(canvasId)
  const containerRef = useRef(null)
  const vp = useViewport(containerRef)
  useViewportWheelBinding(containerRef, vp.onWheel)

  const [openCard,    setOpenCard]    = useState(null)
  const [focusedId,   setFocusedId]   = useState(null)
  const [justAddedId, setJustAddedId] = useState(null)
  const [showCoach,   setShowCoach]   = useState(false)
  const [deleteMode,  setDeleteMode]  = useState(false)
  const [selected,    setSelected]    = useState([])

  useEffect(() => {
    if (readOnly || cards.length === 0 || localStorage.getItem(COACH_KEY)) return
    setShowCoach(true)
  }, [readOnly, cards.length])

  function dismissCoach() { localStorage.setItem(COACH_KEY, '1'); setShowCoach(false) }

  function centerOnCard(card, rect) {
    if (rect && containerRef.current) {
      const cr = containerRef.current.getBoundingClientRect()
      const world = vp.screenToWorld(rect.left - cr.left + rect.width / 2, rect.top - cr.top + rect.height / 2)
      vp.centerOn(world.x, world.y, 1.4)
    } else {
      vp.centerOn(card.x + 90, card.y + 70, 1.4)
    }
  }

  function openAndCenter(card, rect) {
    centerOnCard(card, rect)
    setOpenCard(card)
    setFocusedId(null)
    onCardOpened?.(card)
  }

  function handleFocus(card, rect) {
    if (showCoach) dismissCoach()
    centerOnCard(card, rect)
    setFocusedId(card.id)
  }

  async function handleAdd(type) {
    const rect = containerRef.current.getBoundingClientRect()
    const center = vp.screenToWorld(rect.width / 2, rect.height / 2)
    const spot = findFreeSpot(cards, Math.round(center.x - 90), Math.round(center.y - 60))
    const { data, error } = await addCard(type, spot)
    if (error || !data) return
    setJustAddedId(data.id)
    setTimeout(() => setJustAddedId((id) => id === data.id ? null : id), 500)

    // historial: deshacer = borrar la tarjeta creada
    history?.push({
      label: `Crear ${type}`,
      do:   async () => {},
      undo: async () => removeCard(data.id),
    })

    openAndCenter(data)
  }

  async function handleMove(id, newX, newY) {
    const prev = cards.find((c) => c.id === id)
    if (!prev) return
    await updateCard(id, { x: newX, y: newY })
    history?.push({
      label: 'Mover tarjeta',
      do:   async () => updateCard(id, { x: newX, y: newY }),
      undo: async () => updateCard(id, { x: prev.x, y: prev.y }),
    })
  }

  async function handleUpdate(id, patch) {
    const prev = cards.find((c) => c.id === id)
    if (!prev) return
    await updateCard(id, patch)
    history?.push({
      label: 'Editar tarjeta',
      do:   async () => updateCard(id, patch),
      undo: async () => updateCard(id, { content: prev.content, title: prev.title }),
    })
  }

  async function handleRemove(id) {
    const prev = cards.find((c) => c.id === id)
    if (openCard?.id === id) setOpenCard(null)
    await removeCard(id)
    history?.push({
      label: 'Eliminar tarjeta',
      do:   async () => removeCard(id),
      undo: async () => addCard(prev.type, { x: prev.x, y: prev.y }),
    })
  }

  async function handleDeleteSelected() {
    if (selected.length === 0) return
    if (!window.confirm(`¿Eliminar ${selected.length} tarjeta(s)?`)) return
    await removeCards(selected)
    setSelected([])
    setDeleteMode(false)
  }

  function toggleSelected(id) {
    setSelected((prev) => prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id])
  }

  const { view } = vp
  const focusedCard = cards.find((c) => c.id === focusedId) || null

  return (
    <div className="board-wrapper">
      <div
        className="canvas-map"
        ref={containerRef}
        onPointerDown={(e) => { if (focusedId && !e.target.closest('.card-item')) setFocusedId(null); vp.onPointerDown(e) }}
        onPointerMove={vp.onPointerMove}
        onPointerUp={vp.onPointerUp}
        onPointerCancel={vp.onPointerUp}
        style={{
          backgroundPosition: `${view.x}px ${view.y}px`,
          backgroundSize: `${DOT_SIZE * view.scale}px ${DOT_SIZE * view.scale}px`
        }}
      >
        {cards.length === 0 && (
          <p className="canvas-empty-hint">{emptyLabel || 'El lienzo está vacío.'}</p>
        )}
        <div className={`canvas-world${vp.animating ? ' world-animate' : ''}`}
          style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})` }}>
          {cards.map((card) => (
            <CardItem
              key={card.id}
              card={card}
              scale={view.scale}
              onUpdate={handleUpdate}
              onUpdateLocal={updateCardLocal}
              onOpen={openAndCenter}
              onFocus={handleFocus}
              focused={card.id === focusedId}
              isNew={card.id === justAddedId}
              readOnly={readOnly}
              deleteMode={deleteMode}
              selected={selected.includes(card.id)}
              onToggleSelect={() => toggleSelected(card.id)}
            />
          ))}
        </div>
      </div>

      {!readOnly && !deleteMode && <AddCardMenu onAdd={handleAdd} disabled={cards.length >= MAX_CARDS} />}

      {!readOnly && deleteMode && (
        <DeleteMode
          cards={cards}
          selected={selected}
          onToggle={toggleSelected}
          onConfirm={handleDeleteSelected}
          onCancel={() => { setDeleteMode(false); setSelected([]) }}
        />
      )}

      {focusedCard && !openCard && !deleteMode && (
        <div className="focus-bar">
          <span className="focus-bar-label">{focusedCard.type === 'note' ? 'Nota' : 'Link'}</span>
          <button type="button" className="btn-primary focus-open-btn" onClick={() => openAndCenter(focusedCard)}>
            Abrir
          </button>
        </div>
      )}

      {showCoach && (
        <div className="coach-mark">
          <span>Mantené presionada una tarjeta para moverla. Doble tap para enfocar.</span>
          <button type="button" className="coach-mark-close" onClick={dismissCoach}>Entendido</button>
        </div>
      )}

      {openCard && (
        <CardEditPanel
          card={cards.find((c) => c.id === openCard.id) || openCard}
          onUpdate={readOnly ? undefined : handleUpdate}
          onRemove={readOnly ? undefined : handleRemove}
          onSendToVrop={readOnly ? undefined : onSendToVrop}
          onClose={() => setOpenCard(null)}
          readOnly={readOnly}
        />
      )}

      {/* Expose deleteMode setter via ref trick not needed — parent passes prop if needed */}
      <div style={{ display: 'none' }} data-delete-mode-trigger
        onClick={() => setDeleteMode(true)} />
    </div>
  )
}

// Export trigger helper for CanvasTopBar
export function triggerDeleteMode(boardRef) {
  boardRef?.current?.querySelector('[data-delete-mode-trigger]')?.click()
}
