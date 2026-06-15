import { useRef, useEffect } from 'react'
import { getDomain, getYoutubeId } from '../lib/linkPreview'
import {
  IconNote, IconLinkCard, IconImage, IconPdf, IconDeck,
  IconMinimize, IconExpand
} from './icons/index.jsx'

export const TYPE_LABEL = {
  note:  'Nota',
  link:  'Link',
  image: 'Imagen',
  pdf:   'PDF',
  deck:  'Mazo',
}
export const TYPE_ICON = {
  note:  IconNote,
  link:  IconLinkCard,
  image: IconImage,
  pdf:   IconPdf,
  deck:  IconDeck,
}

const DOUBLE_TAP_MS  = 300
const HOLD_MS        = 400
const MOVE_THRESHOLD = 8

export default function CardItem({
  card,
  scale,
  onUpdate,
  onUpdateLocal,
  onOpen,
  onFocus,
  focused    = false,
  isNew      = false,
  readOnly   = false,
  deleteMode = false,
  selected   = false,
  onToggleSelect,
}) {
  const lastTapRef = useRef(0)
  const holdTimer  = useRef(null)
  useEffect(() => () => clearTimeout(holdTimer.current), [])

  const TypeIcon = TYPE_ICON[card.type] || IconNote

  function triggerFocus(el) {
    const rect = el?.getBoundingClientRect?.()
    if (onFocus) onFocus(card, rect)
    else onOpen?.(card, rect)
  }

  function handlePointerDown(e) {
    if (e.target.closest('.card-controls, button, a, input, textarea')) return
    e.stopPropagation()

    if (deleteMode) { onToggleSelect?.(); return }

    const cardEl = e.currentTarget
    const startX = e.clientX, startY = e.clientY
    const origX  = card.x,    origY  = card.y
    const pos    = { x: origX, y: origY }
    let dragging = false, held = false

    if (readOnly) {
      function onUpRO(ev) {
        window.removeEventListener('pointerup', onUpRO)
        if (Math.abs(ev.clientX - startX) > MOVE_THRESHOLD || Math.abs(ev.clientY - startY) > MOVE_THRESHOLD) return
        const now = Date.now()
        if (now - lastTapRef.current < DOUBLE_TAP_MS) { lastTapRef.current = 0; triggerFocus(cardEl) }
        else lastTapRef.current = now
      }
      window.addEventListener('pointerup', onUpRO)
      return
    }

    holdTimer.current = setTimeout(() => { held = true; cardEl.classList.add('card-held') }, HOLD_MS)

    function onMove(ev) {
      const dx = ev.clientX - startX, dy = ev.clientY - startY
      if (held) {
        dragging = true
        pos.x = origX + dx / scale
        pos.y = origY + dy / scale
        onUpdateLocal(card.id, { x: pos.x, y: pos.y })
      } else if (Math.abs(dx) > MOVE_THRESHOLD || Math.abs(dy) > MOVE_THRESHOLD) {
        clearTimeout(holdTimer.current); cleanup()
      }
    }

    function onUp(ev) {
      clearTimeout(holdTimer.current)
      cardEl.classList.remove('card-held')
      cleanup()
      if (dragging) { onUpdate(card.id, { x: pos.x, y: pos.y }); return }
      const moved = Math.abs(ev.clientX - startX) > MOVE_THRESHOLD || Math.abs(ev.clientY - startY) > MOVE_THRESHOLD
      if (moved) return
      const now = Date.now()
      if (now - lastTapRef.current < DOUBLE_TAP_MS) { lastTapRef.current = 0; triggerFocus(cardEl) }
      else lastTapRef.current = now
    }

    function cleanup() {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  const cardWidth = card.type === 'image' ? (card.width || 220) : (card.width || 182)

  return (
    <div
      className={[
        'card-item',
        `card-${card.type}`,
        focused  ? 'focused'   : '',
        isNew    ? 'card-pop'  : '',
        selected ? 'focused'   : '',
      ].filter(Boolean).join(' ')}
      style={{ left: card.x, top: card.y, width: cardWidth }}
      onPointerDown={handlePointerDown}
    >
      <div className="card-header">
        <span className="card-type-badge">
          <TypeIcon size={13} />
          {TYPE_LABEL[card.type]}
        </span>
        {!readOnly && !deleteMode && (
          <div className="card-controls">
            <button
              type="button"
              className="btn-icon-sm"
              onClick={(e) => { e.stopPropagation(); onUpdate(card.id, { minimized: !card.minimized }) }}
              aria-label={card.minimized ? 'Expandir' : 'Minimizar'}
            >
              {card.minimized ? <IconExpand size={14} /> : <IconMinimize size={14} />}
            </button>
          </div>
        )}
      </div>

      {!card.minimized && (
        <div className="card-preview">
          <CardPreview card={card} />
        </div>
      )}

      {deleteMode && (
        <div className={`card-delete-overlay${selected ? ' selected' : ''}`}>
          {selected && (
            <div className="card-delete-x">
              <IconExpand size={22} style={{ color: 'var(--bone)' }} />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function CardPreview({ card }) {
  if (card.type === 'note') {
    const text = card.content?.note?.trim()
    return <p className={`preview-note${text ? '' : ' empty'}`}>{text || 'Nota vacía — doble tap'}</p>
  }

  if (card.type === 'link') {
    const youtubeId = getYoutubeId(card.content?.url)
    const domain    = getDomain(card.content?.url)
    return (
      <div className="preview-link">
        {youtubeId
          ? <img className="preview-thumb" src={`https://img.youtube.com/vi/${youtubeId}/mqdefault.jpg`} alt="" loading="lazy" />
          : card.content?.url
            ? <div className="preview-chip">
                <img className="preview-favicon" src={`https://www.google.com/s2/favicons?domain=${domain}&sz=32`} alt="" />
                <span className="preview-domain">{domain}</span>
              </div>
            : <p className="preview-note empty">Sin link — doble tap</p>
        }
        {card.title && <p className="preview-title">{card.title}</p>}
      </div>
    )
  }

  if (card.type === 'image') {
    return card.content?.url
      ? <img className="preview-image-full" src={card.content.url} alt={card.title || ''} loading="lazy" />
      : <div className="preview-image-empty"><IconImage size={28} /><span>Sin imagen — doble tap</span></div>
  }

  if (card.type === 'pdf') {
    return (
      <div className="preview-pdf">
        <IconPdf size={26} style={{ color: 'var(--olivo)' }} />
        <span className="preview-pdf-title">{card.title || 'PDF — doble tap'}</span>
      </div>
    )
  }

  if (card.type === 'deck') {
    return (
      <div className="preview-deck">
        <IconDeck size={24} style={{ color: 'var(--terracota)' }} />
        <span className="preview-deck-title">{card.title || 'Mazo — doble tap'}</span>
      </div>
    )
  }

  return null
}
