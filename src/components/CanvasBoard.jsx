import { useState, useRef, useEffect } from 'react'
import { useCards, MAX_CARDS } from '../lib/useCards'
import { useViewport, useViewportWheelBinding } from '../lib/useViewport'
import { burstConfetti, playChime, proximityVolume } from '../lib/effects'
import CardItem from './CardItem'
import CardEditPanel from './CardEditPanel'
import AddCardMenu from './AddCardMenu'

const TYPE_LABEL = {
  note: 'Nota',
  link: 'Link',
  image: 'Imagen',
  pdf: 'PDF',
  timer: 'Temporizador',
  spotify: 'Música'
}

const COACH_KEY = 'vinki-coach-seen'
const DOT_SIZE = 22
const CARD_W = 190
const CARD_H = 150

function cardSummary(card) {
  if (card.type === 'note') return card.content?.text?.slice(0, 60) || 'Nota vacía'
  return card.title || card.content?.url?.slice(0, 60) || `${TYPE_LABEL[card.type]} vacío`
}

// Busca un punto cercano al deseado donde la nueva tarjeta no se encime
// con ninguna otra (búsqueda en espiral alrededor del punto de partida).
function findFreeSpot(cards, startX, startY) {
  function overlaps(x, y) {
    return cards.some((c) => Math.abs(c.x - x) < CARD_W && Math.abs(c.y - y) < CARD_H)
  }
  if (!overlaps(startX, startY)) return { x: startX, y: startY }
  for (let r = 1; r <= 14; r++) {
    const step = r * 40
    const positions = [
      [startX + step, startY], [startX - step, startY],
      [startX, startY + step], [startX, startY - step],
      [startX + step, startY + step], [startX - step, startY - step],
      [startX + step, startY - step], [startX - step, startY + step]
    ]
    for (const [x, y] of positions) {
      if (!overlaps(x, y)) return { x, y }
    }
  }
  return { x: startX, y: startY }
}

export default function CanvasBoard({ canvasId, emptyLabel, readOnly = false, onSendToVrop, onCardOpened }) {
  const { cards, addCard, updateCard, updateCardLocal, removeCard } =
    useCards(canvasId)
  const containerRef = useRef(null)
  const vp = useViewport(containerRef)
  useViewportWheelBinding(containerRef, vp.onWheel)

  const [notice, setNotice] = useState('')
  const [openCard, setOpenCard] = useState(null)
  const [selectMode, setSelectMode] = useState(false)
  const [selected, setSelected] = useState([])
  const [focusedId, setFocusedId] = useState(null)
  const [justAddedId, setJustAddedId] = useState(null)
  const [showCoach, setShowCoach] = useState(false)
  const [moveMode, setMoveMode] = useState(false)

  // Coach-mark de uso único: aparece cuando ya hay al menos una tarjeta
  useEffect(() => {
    if (readOnly) return
    if (cards.length === 0) return
    if (localStorage.getItem(COACH_KEY)) return
    setShowCoach(true)
  }, [readOnly, cards.length])

  function dismissCoach() {
    localStorage.setItem(COACH_KEY, '1')
    setShowCoach(false)
  }

  function flash(msg) {
    setNotice(msg)
    setTimeout(() => setNotice(''), 3000)
  }

  // Centra la vista en el centro REAL (medido en pantalla) de la tarjeta,
  // así el zoom queda perfectamente centrado sin importar su tamaño actual.
  function centerOnCard(card, rect) {
    if (rect && containerRef.current) {
      const containerRect = containerRef.current.getBoundingClientRect()
      const screenCx = rect.left - containerRect.left + rect.width / 2
      const screenCy = rect.top - containerRect.top + rect.height / 2
      const world = vp.screenToWorld(screenCx, screenCy)
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
    // Crear la tarjeta cerca del centro visible actual, sin encimarse con
    // tarjetas existentes (búsqueda en espiral).
    const rect = containerRef.current.getBoundingClientRect()
    const center = vp.screenToWorld(rect.width / 2, rect.height / 2)
    const spot = findFreeSpot(cards, Math.round(center.x - 90), Math.round(center.y - 60))
    const { data, error } = await addCard(type, spot)
    if (error) {
      flash(error.message)
      return
    }
    if (data) {
      setJustAddedId(data.id)
      setTimeout(() => setJustAddedId((id) => (id === data.id ? null : id)), 500)
      openAndCenter(data)
    }
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

  function handleTimerComplete(goalMinutes, card) {
    burstConfetti()
    const rect = containerRef.current?.getBoundingClientRect()
    if (rect) {
      const cardScreenX = view.x + (card.x + 90) * view.scale
      const cardScreenY = view.y + (card.y + 70) * view.scale
      const dist = Math.hypot(
        cardScreenX - rect.width / 2,
        cardScreenY - rect.height / 2
      )
      playChime(proximityVolume(dist))
    } else {
      playChime(1)
    }
  }

  function handleContainerPointerDown(e) {
    // Tocar el fondo (no una tarjeta) quita el foco actual
    if (focusedId && !e.target.closest('.card-item')) {
      setFocusedId(null)
    }
    vp.onPointerDown(e)
  }

  const focusedCard = cards.find((c) => c.id === focusedId) || null

  return (
    <div className="board-wrapper">
      {notice && <div className="toast">{notice}</div>}

      {!readOnly && cards.length > 0 && !moveMode && (
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
        onPointerDown={handleContainerPointerDown}
        onPointerMove={vp.onPointerMove}
        onPointerUp={vp.onPointerUp}
        onPointerCancel={vp.onPointerUp}
        style={{
          backgroundPosition: `${view.x}px ${view.y}px`,
          backgroundSize: `${DOT_SIZE * view.scale}px ${DOT_SIZE * view.scale}px`
        }}
      >
        {cards.length === 0 && (
          <p className="canvas-empty canvas-empty-board">
            {emptyLabel || 'Este lienzo está vacío.'}
          </p>
        )}

        <div
          className={`canvas-world${vp.animating ? ' world-animate' : ''}`}
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
              onFocus={handleFocus}
              focused={card.id === focusedId}
              isNew={card.id === justAddedId}
              onTimerComplete={handleTimerComplete}
              readOnly={readOnly}
              globalMoveMode={moveMode}
              onRequestMoveMode={() => setMoveMode(true)}
            />
          ))}
        </div>
      </div>

      {!readOnly && !moveMode && (
        <AddCardMenu onAdd={handleAdd} disabled={cards.length >= MAX_CARDS} />
      )}

      {focusedCard && !openCard && !moveMode && (
        <div className="focus-bar">
          <span className="card-type-tag" style={{ paddingLeft: 10 }}>
            {TYPE_LABEL[focusedCard.type]}
          </span>
          <button
            type="button"
            className="btn-primary focus-open-btn"
            onClick={() => openAndCenter(focusedCard)}
          >
            Abrir
          </button>
        </div>
      )}

      {moveMode && (
        <div className="global-move-bar">
          <span>✋ Modo mover: arrastrá las tarjetas que quieras acomodar</span>
          <button type="button" className="global-move-accept" onClick={() => setMoveMode(false)}>
            Listo
          </button>
        </div>
      )}

      {showCoach && !moveMode && (
        <div className="coach-mark">
          <span>
            💡 Mantené presionada una tarjeta para mover. Doble tap la enfoca
            y te deja abrirla.
          </span>
          <button type="button" className="coach-mark-close" onClick={dismissCoach}>
            Entendido
          </button>
        </div>
      )}

      {openCard && (
        <CardEditPanel
          card={cards.find((c) => c.id === openCard.id) || openCard}
          onUpdate={readOnly ? undefined : updateCard}
          onRemove={
            readOnly
              ? undefined
              : (id) => {
                  removeCard(id)
                  setOpenCard(null)
                }
          }
          onSendToVrop={readOnly ? undefined : onSendToVrop}
          onClose={() => setOpenCard(null)}
          readOnly={readOnly}
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
