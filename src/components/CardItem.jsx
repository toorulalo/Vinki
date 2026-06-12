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
  spotify: 'Spotify'
}

const DOUBLE_TAP_MS = 320
const HOLD_MS = 450
const MOVE_CANCEL = 8

/**
 * Tarjeta dentro del lienzo-mapa. Coordenadas en "mundo"; el zoom/pan lo
 * aplica el contenedor. Interacciones:
 *  - doble tap  -> abrir detalles (y centrar con zoom)
 *  - mantener   -> entrar en "modo mover" (arrastrar y luego Aceptar)
 */
export default function CardItem({
  card,
  scale,
  onUpdate,
  onUpdateLocal,
  onOpen,
  onTimerComplete,
  readOnly = false
}) {
  const [moveMode, setMoveMode] = useState(false)
  const lastTapRef = useRef(0)
  const holdTimer = useRef(null)
  const dragRef = useRef(null)

  useEffect(() => () => clearTimeout(holdTimer.current), [])

  function handlePointerDown(e) {
    if (e.target.closest('.card-controls, .move-bar, button, a, input, iframe')) return
    e.stopPropagation()

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
          onOpen?.(card)
        } else {
          lastTapRef.current = now
        }
      }
      window.addEventListener('pointerup', onUpReadOnly)
      return
    }

    if (moveMode) {
      const origX = card.x
      const origY = card.y
      dragRef.current = { startX, startY, origX, origY, lastX: origX, lastY: origY }

      function onMove(ev) {
        const dx = (ev.clientX - startX) / scale
        const dy = (ev.clientY - startY) / scale
        const nx = dragRef.current.origX + dx
        const ny = dragRef.current.origY + dy
        dragRef.current.lastX = nx
        dragRef.current.lastY = ny
        onUpdateLocal(card.id, { x: nx, y: ny })
      }
      function onUp() {
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)
      }
      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
      return
    }

    // No estamos en modo mover: detectar hold (para entrar) y doble tap
    holdTimer.current = setTimeout(() => {
      setMoveMode(true)
    }, HOLD_MS)

    function onMoveDetect(ev) {
      if (
        Math.abs(ev.clientX - startX) > MOVE_CANCEL ||
        Math.abs(ev.clientY - startY) > MOVE_CANCEL
      ) {
        clearTimeout(holdTimer.current)
        cleanup()
      }
    }
    function onUpDetect() {
      clearTimeout(holdTimer.current)
      cleanup()
      const now = Date.now()
      if (now - lastTapRef.current < DOUBLE_TAP_MS) {
        lastTapRef.current = 0
        onOpen?.(card)
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

  function acceptMove() {
    setMoveMode(false)
    onUpdate(card.id, { x: card.x, y: card.y })
  }

  return (
    <div
      className={`card-item embed-item card-${card.type}${
        moveMode ? ' move-mode' : ''
      }`}
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

      {moveMode && (
        <div className="move-bar">
          <span className="move-hint">Arrastrá y tocá Aceptar</span>
          <button type="button" className="move-accept" onClick={acceptMove}>
            Aceptar
          </button>
        </div>
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
