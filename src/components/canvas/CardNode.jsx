import { useRef, useState, useEffect, useCallback } from 'react'
import NoteCard from '../cards/NoteCard'
import LinkCard from '../cards/LinkCard'
import ImageCard from '../cards/ImageCard'
import PdfCard from '../cards/PdfCard'
import TimerCard from '../cards/TimerCard'
import DeckCard from '../cards/DeckCard'
import SelectionToolbar from './SelectionToolbar'

const DOUBLE_TAP_MS  = 300
const LONG_PRESS_MS  = 500
const MOVE_THRESHOLD = 6
const MIN_W = 160
const MIN_H = 120
const MAX_W = 600
const MAX_H = 500

const TYPE_LABEL = {
  note:  'Nota',
  link:  'Link',
  image: 'Imagen',
  pdf:   'PDF',
  timer: 'Temporizador',
  deck:  'Mazo',
}

const TYPE_ICON_EMOJI = {
  note:  '📝',
  link:  '🔗',
  image: '🖼️',
  pdf:   '📄',
  timer: '⏱️',
  deck:  '🃏',
}

export default function CardNode({
  card,
  isFocused,
  onFocus,
  onBlur,
  onEdit,
  onMove: onMoveProp,
  onResize,
  onRemove,
  viewScale = 1,
}) {
  const nodeRef        = useRef(null)
  const lastTapRef     = useRef(0)
  const longPressTimer = useRef(null)
  const [isMoving, setIsMoving]   = useState(false)
  const [localPos, setLocalPos]   = useState({ x: card.x, y: card.y })
  const [popped,   setPopped]     = useState(true)

  // Remove pop class after animation
  useEffect(() => {
    const t = setTimeout(() => setPopped(false), 500)
    return () => clearTimeout(t)
  }, [])

  // Sync local pos when card prop changes (e.g., remote update)
  useEffect(() => {
    if (!isMoving) {
      setLocalPos({ x: card.x, y: card.y })
    }
  }, [card.x, card.y, isMoving])

  const handlePointerDown = useCallback((e) => {
    // Ignore if interacting with resize handle or interactive children
    if (e.target.closest('.card-resize-handle, button, a, input, textarea, select')) return
    e.stopPropagation()

    const el      = nodeRef.current
    const startX  = e.clientX
    const startY  = e.clientY
    const origX   = card.x
    const origY   = card.y
    let moved     = false
    let dragging  = false

    // Long press → drag mode
    longPressTimer.current = setTimeout(() => {
      setIsMoving(true)
      el?.setPointerCapture?.(e.pointerId)
    }, LONG_PRESS_MS)

    function onMove(ev) {
      const dx = (ev.clientX - startX) / viewScale
      const dy = (ev.clientY - startY) / viewScale

      if (Math.abs(ev.clientX - startX) > MOVE_THRESHOLD || Math.abs(ev.clientY - startY) > MOVE_THRESHOLD) {
        moved = true
        clearTimeout(longPressTimer.current)
      }

      // Only drag if long press activated
      setIsMoving((currently) => {
        if (currently) {
          dragging = true
          const nx = origX + dx
          const ny = origY + dy
          setLocalPos({ x: nx, y: ny })
        }
        return currently
      })
    }

    function onUp(ev) {
      clearTimeout(longPressTimer.current)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)

      setIsMoving((currently) => {
        if (currently && dragging) {
          const dx = (ev.clientX - startX) / viewScale
          const dy = (ev.clientY - startY) / viewScale
          const nx = origX + dx
          const ny = origY + dy
          onMoveProp(nx, ny)
        }
        return false
      })

      if (!moved && !dragging) {
        // Tap logic
        const now = Date.now()
        if (now - lastTapRef.current < DOUBLE_TAP_MS) {
          lastTapRef.current = 0
          onEdit()
        } else {
          lastTapRef.current = now
          if (!isFocused) onFocus()
          else onBlur()
        }
      }
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }, [card.x, card.y, isFocused, onFocus, onBlur, onEdit, onMoveProp, viewScale])

  // Resize handle logic
  const handleResizeDown = useCallback((e) => {
    e.stopPropagation()
    e.preventDefault()

    const startX  = e.clientX
    const startY  = e.clientY
    const origW   = card.width  || 260
    const origH   = card.height || 180

    function onResizeMove(ev) {
      const dw = (ev.clientX - startX) / viewScale
      const dh = (ev.clientY - startY) / viewScale
      const nw = Math.min(MAX_W, Math.max(MIN_W, origW + dw))
      const nh = Math.min(MAX_H, Math.max(MIN_H, origH + dh))
      onResize(Math.round(nw), Math.round(nh))
    }

    function onResizeUp(ev) {
      window.removeEventListener('pointermove', onResizeMove)
      window.removeEventListener('pointerup', onResizeUp)
      const dw = (ev.clientX - startX) / viewScale
      const dh = (ev.clientY - startY) / viewScale
      const nw = Math.min(MAX_W, Math.max(MIN_W, origW + dw))
      const nh = Math.min(MAX_H, Math.max(MIN_H, origH + dh))
      onResize(Math.round(nw), Math.round(nh))
    }

    window.addEventListener('pointermove', onResizeMove)
    window.addEventListener('pointerup', onResizeUp)
  }, [card.width, card.height, onResize, viewScale])

  const classes = [
    'card-node',
    `card-type-${card.type}`,
    isFocused  ? 'is-focused' : '',
    isMoving   ? 'is-moving'  : '',
    popped     ? 'card-pop'   : '',
  ].filter(Boolean).join(' ')

  const style = {
    left:   localPos.x,
    top:    localPos.y,
    width:  card.width  || 260,
    height: card.height || 180,
    zIndex: isMoving ? 50 : isFocused ? 10 : 1,
  }

  function renderPreview() {
    const props = { card, isEditing: false }
    switch (card.type) {
      case 'note':  return <NoteCard  {...props} />
      case 'link':  return <LinkCard  {...props} />
      case 'image': return <ImageCard {...props} />
      case 'pdf':   return <PdfCard   {...props} />
      case 'timer': return <TimerCard {...props} />
      case 'deck':  return <DeckCard  {...props} />
      default:      return null
    }
  }

  return (
    <>
      {isFocused && (
        <SelectionToolbar
          card={card}
          onEdit={onEdit}
          onDelete={onRemove}
          onClose={onBlur}
        />
      )}

      <div
        ref={nodeRef}
        className={classes}
        style={style}
        onPointerDown={handlePointerDown}
      >
        <div className="card-header">
          <span className="card-type-label">
            <span style={{ fontSize: '0.8rem' }}>{TYPE_ICON_EMOJI[card.type]}</span>
            {TYPE_LABEL[card.type] || card.type}
          </span>
        </div>

        <div className="card-body">
          {card.title && (
            <div className="card-title">{card.title}</div>
          )}
          {renderPreview()}
        </div>

        {/* Resize handle */}
        <div
          className="card-resize-handle"
          onPointerDown={handleResizeDown}
          title="Redimensionar"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
            <path d="M8 2L2 8M5 2L2 5M8 5L5 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" />
          </svg>
        </div>
      </div>
    </>
  )
}
