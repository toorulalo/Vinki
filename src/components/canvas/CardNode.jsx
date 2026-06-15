import { useRef, useState, useEffect, useCallback } from 'react'
import NoteCard from '../cards/NoteCard'
import LinkCard from '../cards/LinkCard'
import ImageCard from '../cards/ImageCard'
import PdfCard from '../cards/PdfCard'
import TimerCard from '../cards/TimerCard'
import DeckCard from '../cards/DeckCard'

const DOUBLE_TAP_MS  = 300
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
  onEdit,
  onMove: onMoveProp,
  onResize,
  onRemove,
  viewScale = 1,
}) {
  const nodeRef      = useRef(null)
  const isDragging   = useRef(false)
  const lastTapTime  = useRef(0)
  const localPos     = useRef({ x: card.x, y: card.y })

  const [localPosState, setLocalPosState] = useState({ x: card.x, y: card.y })
  const [isMoving, setIsMoving]           = useState(false)
  const [popped,   setPopped]             = useState(true)

  // Helper: update both the ref and state together
  function setLocalPos(v) {
    localPos.current = v
    setLocalPosState(v)
  }

  // Remove pop class after animation
  useEffect(() => {
    const t = setTimeout(() => setPopped(false), 500)
    return () => clearTimeout(t)
  }, [])

  // Sync local pos when card prop changes (e.g., remote update) — but not while dragging
  useEffect(() => {
    if (!isDragging.current) {
      setLocalPos({ x: card.x, y: card.y })
    }
  }, [card.x, card.y])

  const handlePointerDown = useCallback((e) => {
    if (e.target.closest('.card-resize-handle, button, a, input, textarea, select')) return
    e.stopPropagation()

    const startX = e.clientX
    const startY = e.clientY
    const origX  = localPos.current.x
    const origY  = localPos.current.y
    let didMove  = false

    function onMove(ev) {
      const dx = ev.clientX - startX
      const dy = ev.clientY - startY
      if (!didMove && (Math.abs(dx) > MOVE_THRESHOLD || Math.abs(dy) > MOVE_THRESHOLD)) {
        didMove = true
        isDragging.current = true
        setIsMoving(true)
      }
      if (isDragging.current) {
        setLocalPos({ x: origX + dx / viewScale, y: origY + dy / viewScale })
      }
    }

    function onUp(ev) {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      if (isDragging.current) {
        const dx = ev.clientX - startX
        const dy = ev.clientY - startY
        onMoveProp(origX + dx / viewScale, origY + dy / viewScale)
        isDragging.current = false
        setIsMoving(false)
      } else if (!didMove) {
        // tap — check double tap
        const now = Date.now()
        if (now - lastTapTime.current < DOUBLE_TAP_MS) {
          onEdit()
          lastTapTime.current = 0
        } else {
          lastTapTime.current = now
        }
      }
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }, [onEdit, onMoveProp, viewScale])

  // Resize handle logic
  const handleResizeDown = useCallback((e) => {
    e.stopPropagation()
    e.preventDefault()

    const startX = e.clientX
    const startY = e.clientY
    const origW  = card.width  || 260
    const origH  = card.height || 180

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
    isMoving ? 'is-moving' : '',
    popped   ? 'card-pop'  : '',
  ].filter(Boolean).join(' ')

  const style = {
    left:   localPosState.x,
    top:    localPosState.y,
    width:  card.width  || 260,
    height: card.height || 180,
    zIndex: isMoving ? 50 : 1,
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
  )
}
