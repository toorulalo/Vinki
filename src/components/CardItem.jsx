import { useRef, useState, useEffect } from 'react'
import { getYoutubeId, getDomain } from '../lib/linkPreview'
import TimerEmbed from './TimerEmbed'
import { SpotifyTower } from './SpotifyEmbed'

const TYPE_LABEL = {
  note: 'Nota',
  link: 'Link',
  image: 'Imagen',
  pdf: 'PDF',
  timer: 'Temporizador',
  spotify: 'Música'
}

const DOUBLE_TAP_MS = 320
const HOLD_MS = 420
const MOVE_CANCEL = 8

/**
 * Tarjeta dentro del lienzo-mapa. Coordenadas en "mundo"; el zoom/pan lo
 * aplica el contenedor. Interacciones:
 *  - doble tap   -> enfocar (zoom centrado + outline). El lienzo muestra
 *    una barra "Abrir" para entrar al detalle.
 *  - mantener    -> aparece un botón flotante "✋ Mover" sobre la tarjeta.
 *    Al tocarlo se activa el modo mover GLOBAL (todas las tarjetas quedan
 *    arrastrables) hasta que el usuario toque "Listo" en la barra inferior.
 */
export default function CardItem({
  card,
  scale,
  onUpdate,
  onUpdateLocal,
  onOpen,
  onFocus,
  focused = false,
  isNew = false,
  onTimerComplete,
  readOnly = false,
  globalMoveMode = false,
  onRequestMoveMode
}) {
  const [showMoveHint, setShowMoveHint] = useState(false)
  const lastTapRef = useRef(0)
  const holdTimer = useRef(null)
  const movedRef = useRef(false)

  useEffect(() => () => clearTimeout(holdTimer.current), [])

  function triggerFocus(el) {
    const rect = el?.getBoundingClientRect?.()
    if (onFocus) onFocus(card, rect)
    else onOpen?.(card, rect)
  }

  function handlePointerDown(e) {
    if (e.target.closest('.card-controls, .move-hint-btn, .global-move-bar, button, a, input, iframe')) return
    e.stopPropagation()

    const cardEl = e.currentTarget
    const startX = e.clientX
    const startY = e.clientY

    if (readOnly) {
      function onUpReadOnly(ev) {
        window.removeEventListener('pointerup', onUpReadOnly)
        if (
          Math.abs(ev.clientX - startX) > MOVE_CANCEL ||
          Math.abs(ev.clientY - startY) > MOVE_CANCEL
        ) {
          return
        }
        const now = Date.now()
        if (now - lastTapRef.current < DOUBLE_TAP_MS) {
          lastTapRef.current = 0
          triggerFocus(cardEl)
        } else {
          lastTapRef.current = now
        }
      }
      window.addEventListener('pointerup', onUpReadOnly)
      return
    }

    if (globalMoveMode) {
      // Guardar coordenadas originales en una ref mutable para evitar
      // el closure stale: onUpdateLocal modifica el estado de CanvasBoard
      // pero el prop 'card' en este closure queda congelado al valor inicial.
      const origX = card.x
      const origY = card.y
      // Ref para rastrear la posición actual del drag sin depender de props stale
      const currentPos = { x: origX, y: origY }

      function onMove(ev) {
        const dx = (ev.clientX - startX) / scale
        const dy = (ev.clientY - startY) / scale
        currentPos.x = origX + dx
        currentPos.y = origY + dy
        onUpdateLocal(card.id, { x: currentPos.x, y: currentPos.y })
      }
      function onUp() {
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)
        // Usamos currentPos (actualizado en el closure de onMove) en lugar
        // de card.x/card.y que estarían desactualizados por ser el prop inicial.
        onUpdate(card.id, { x: currentPos.x, y: currentPos.y })
      }
      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
      return
    }

    // No estamos en modo mover: detectar "mantener presionado" (muestra el
    // botón "Mover") y doble tap (enfocar)
    movedRef.current = false
    holdTimer.current = setTimeout(() => {
      if (!movedRef.current) setShowMoveHint(true)
    }, HOLD_MS)

    function onMoveDetect(ev) {
      if (
        Math.abs(ev.clientX - startX) > MOVE_CANCEL ||
        Math.abs(ev.clientY - startY) > MOVE_CANCEL
      ) {
        movedRef.current = true
        clearTimeout(holdTimer.current)
        cleanup()
      }
    }
    function onUpDetect() {
      clearTimeout(holdTimer.current)
      cleanup()
      if (movedRef.current) return
      const now = Date.now()
      if (now - lastTapRef.current < DOUBLE_TAP_MS) {
        lastTapRef.current = 0
        triggerFocus(cardEl)
      } else {
        lastTapRef.current = now
      }
    }
    function cleanup() {
      window.removeEventListener('pointermove', onMoveDetect)
      window.removeEventListener('pointerup', onUpDetect)
    }
    window.addEventListener('pointermove', onMoveDetect)
    window.addEventListener('pointerup', onUpDetect)
  }

  function handleRequestMove(e) {
    e.stopPropagation()
    setShowMoveHint(false)
    onRequestMoveMode?.()
  }

  return (
    <div
      className={`card-item embed-item card-${card.type}${
        globalMoveMode ? ' move-mode' : ''
      }${focused ? ' focused' : ''}${isNew ? ' card-pop' : ''}`}
      style={{ left: card.x, top: card.y }}
      onPointerDown={handlePointerDown}
    >
      <div className="card-header">
        <span className="card-type-tag">{TYPE_LABEL[card.type]}</span>
        {!readOnly && (
          <div className="card-controls">
            <button
              type="button"
              className="card-control-btn"
              onClick={(e) => {
                e.stopPropagation()
                onUpdate(card.id, { minimized: !card.minimized })
              }}
              aria-label={card.minimized ? 'Expandir' : 'Minimizar'}
            >
              {card.minimized ? '▢' : '—'}
            </button>
          </div>
        )}
      </div>

      {!card.minimized && (
        <div className="card-preview">
          <CardPreview card={card} onTimerComplete={onTimerComplete} />
        </div>
      )}

      {showMoveHint && !globalMoveMode && (
        <button type="button" className="move-hint-btn" onClick={handleRequestMove}>
          ✋ Mover
        </button>
      )}
    </div>
  )
}

function CardPreview({ card, onTimerComplete }) {
  if (card.type === 'note') {
    const text = card.content?.text?.trim()
    return (
      <p className="preview-note">{text || 'Nota vacía — doble tap'}</p>
    )
  }

  if (card.type === 'timer') {
    return <TimerEmbed card={card} onComplete={onTimerComplete} />
  }

  if (card.type === 'spotify') {
    return <SpotifyTower card={card} />
  }

  if (card.type === 'pdf') {
    return (
      <div className="preview-pdf">
        <span className="preview-pdf-icon">📄</span>
        <span className="preview-pdf-name">
          {card.title || card.content?.filename || 'Sin archivo — doble tap'}
        </span>
      </div>
    )
  }

  if (card.type === 'link') {
    const youtubeId = getYoutubeId(card.content?.url)
    const domain = getDomain(card.content?.url)
    const noteCount = card.content?.ytNotes?.length || 0
    return (
      <div className="preview-link">
        {youtubeId ? (
          <img
            className="preview-thumb"
            src={`https://img.youtube.com/vi/${youtubeId}/mqdefault.jpg`}
            alt=""
            loading="lazy"
          />
        ) : card.content?.url ? (
          <div className="preview-chip">
            <img
              className="card-link-favicon"
              src={`https://www.google.com/s2/favicons?domain=${domain}&sz=32`}
              alt=""
            />
            <span className="card-link-domain">{domain}</span>
          </div>
        ) : (
          <p className="preview-empty">Sin link — doble tap</p>
        )}
        {card.title && <p className="preview-title">{card.title}</p>}
        {youtubeId && noteCount > 0 && (
          <p className="preview-title" style={{ color: 'var(--ink-soft)', fontWeight: 400 }}>
            📝 {noteCount} {noteCount === 1 ? 'nota' : 'notas'}
          </p>
        )}
      </div>
    )
  }

  if (card.type === 'image') {
    return card.content?.url ? (
      <img
        className="preview-thumb"
        src={card.content.url}
        alt=""
        loading="lazy"
        style={card.content?.size ? { height: card.content.size } : undefined}
      />
    ) : (
      <p className="preview-empty">Sin imagen — doble tap</p>
    )
  }

  return null
}
