import { useState, useRef } from 'react'
import { useCards, MAX_CARDS } from '../lib/useCards'
import { useViewport, useViewportWheelBinding } from '../lib/useViewport'
import CardItem from './CardItem'
import CardEditPanel from './CardEditPanel'
import AddCardMenu from './AddCardMenu'

const TYPE_LABEL = { note: 'Nota', link: 'Link', image: 'Imagen' }

function cardSummary(card) {
  if (card.type === 'note') return card.content?.text?.slice(0, 60) || 'Nota vacía'
  return card.title || card.content?.url?.slice(0, 60) || `${TYPE_LABEL[card.type]} vacío`
}

export default function CanvasBoard({ canvasId, emptyLabel, readOnly = false, onSendToVrop }) {
  const { cards, addCard, updateCard, updateCardLocal, removeCard } =
    useCards(canvasId)
  const containerRef = useRef(null)
  const vp = useViewport(containerRef)
  useViewportWheelBinding(containerRef, vp.onWheel)

  const [notice, setNotice] = useState('')
  const [openCard, setOpenCard] = useState(null)
  const [selectMode, setSelectMode] = useState(false)
  const [selected, setSelected] = useState([])

  function flash(msg) {
    setNotice(msg)
    setTimeout(() => setNotice(''), 3000)
  }

  function openAndCenter(card) {
    // Centrar la vista en la tarjeta (su centro aproximado) con zoom
    vp.centerOn(card.x + 90, card.y + 70, 1.4)
    setOpenCard(card)
  }

  async function handleAdd(type) {
    // Crear la tarjeta cerca del centro visible actual
    const rect = containerRef.current.getBoundingClientRect()
    const center = vp.screenToWorld(rect.width / 2, rect.height / 2)
    const { data, error } = await addCard(type, {
      x: Math.round(center.x - 90),
      y: Math.round(center.y - 60)
    })
    if (error) {
      flash(error.message)
      return
    }
    if (data) openAndCenter(data)
  }

  function toggleSelected(id) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    )
  }

  async function deleteSelected() {
    if (selected.length === 0) return
    if (!window.confirm(`¿Eliminar ${selected.length} elemento(s)?`)) return
    for (const id of selected) await removeCard(id)
    setSelected([])
    setSelectMode(false)
  }

  const { view } = vp

  return (
    <div className="board-wrapper">
      {notice && <div className="toast">{notice}</div>}

      {!readOnly && cards.length > 0 && (
        <button
          type="button"
          className="btn-pill btn-pill-muted board-select-btn"
          onClick={() => {
            setSelectMode(true)
            setSelected([])
          }}
        >
          Seleccionar
        </button>
      )}

      <div
        className="canvas-map"
        ref={containerRef}
        onPointerDown={vp.onPointerDown}
        onPointerMove={vp.onPointerMove}
        onPointerUp={vp.onPointerUp}
        onPointerCancel={vp.onPointerUp}
      >
        {cards.length === 0 && (
          <p className="canvas-empty canvas-empty-board">
            {emptyLabel || 'Este lienzo está vacío.'}
          </p>
        )}

        <div
          className="canvas-world"
          style={{
            transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`
          }}
        >
          {cards.map((card) => (
            <CardItem
              key={card.id}
              card={card}
              scale={view.scale}
              onUpdate={updateCard}
              onUpdateLocal={updateCardLocal}
              onOpen={openAndCenter}
              readOnly={readOnly}
            />
          ))}
        </div>
      </div>

      {!readOnly && (
        <AddCardMenu onAdd={handleAdd} disabled={cards.length >= MAX_CARDS} />
      )}

      {openCard && (
        <CardEditPanel
          card={cards.find((c) => c.id === openCard.id) || openCard}
          onUpdate={updateCard}
          onRemove={(id) => {
            removeCard(id)
            setOpenCard(null)
          }}
          onSendToVrop={onSendToVrop}
          onClose={() => setOpenCard(null)}
        />
      )}

      {selectMode && (
        <div className="modal-overlay" onClick={() => setSelectMode(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="font-display">Seleccionar elementos</h3>
              <button
                type="button"
                className="card-control-btn"
                onClick={() => setSelectMode(false)}
                aria-label="Cerrar"
              >
                ×
              </button>
            </div>

            {cards.map((card) => (
              <label className="select-row" key={card.id}>
                <input
                  type="checkbox"
                  checked={selected.includes(card.id)}
                  onChange={() => toggleSelected(card.id)}
                />
                <span className="session-mode-badge">{TYPE_LABEL[card.type]}</span>
                <span className="select-row-text">{cardSummary(card)}</span>
              </label>
            ))}

            <button
              type="button"
              className="btn-primary btn-delete"
              onClick={deleteSelected}
              disabled={selected.length === 0}
            >
              Eliminar seleccionados ({selected.length})
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
