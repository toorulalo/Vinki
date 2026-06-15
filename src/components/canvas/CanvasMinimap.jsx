import { useRef, useCallback } from 'react'

const MINIMAP_W = 120
const MINIMAP_H = 80
const WORLD_W   = 10000
const WORLD_H   = 10000

const TYPE_COLOR = {
  note:  '#F0B429',
  link:  '#3D8FA6',
  image: '#3D8FA6',
  pdf:   '#2E7D52',
  timer: '#E07240',
  deck:  '#E07240',
}

export default function CanvasMinimap({ cards, view, containerRef, onNavigate }) {
  const minimapRef = useRef(null)

  const scaleX = MINIMAP_W / WORLD_W
  const scaleY = MINIMAP_H / WORLD_H

  // Compute viewport rect in minimap coordinates
  function getViewportRect() {
    const el = containerRef?.current
    if (!el) return null
    const rect  = el.getBoundingClientRect()
    const vw    = rect.width
    const vh    = rect.height

    // World area visible: origin at (-view.x / scale, -view.y / scale)
    // width/height in world: vw / scale, vh / scale
    const wx = -view.x / view.scale
    const wy = -view.y / view.scale
    const ww = vw / view.scale
    const wh = vh / view.scale

    return {
      left:   Math.max(0, wx * scaleX),
      top:    Math.max(0, wy * scaleY),
      width:  Math.min(MINIMAP_W, ww * scaleX),
      height: Math.min(MINIMAP_H, wh * scaleY),
    }
  }

  const handleMinimapClick = useCallback((e) => {
    const rect = minimapRef.current?.getBoundingClientRect()
    if (!rect) return
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top
    // Convert minimap coords to world coords
    const wx = (mx / MINIMAP_W) * WORLD_W
    const wy = (my / MINIMAP_H) * WORLD_H
    onNavigate(wx, wy)
  }, [onNavigate])

  const vpRect = getViewportRect()

  return (
    <div
      ref={minimapRef}
      className="canvas-minimap"
      onClick={handleMinimapClick}
      title="Minimapa — click para navegar"
    >
      {/* Card dots */}
      {cards.map((card) => {
        const cx = card.x * scaleX
        const cy = card.y * scaleY
        // Clamp to minimap bounds
        if (cx < 0 || cx > MINIMAP_W || cy < 0 || cy > MINIMAP_H) return null
        return (
          <div
            key={card.id}
            className="minimap-dot"
            style={{
              left:       cx,
              top:        cy,
              background: TYPE_COLOR[card.type] || 'var(--color-primary)',
            }}
          />
        )
      })}

      {/* Viewport rectangle */}
      {vpRect && (
        <div
          className="minimap-viewport"
          style={{
            left:   vpRect.left,
            top:    vpRect.top,
            width:  Math.max(4, vpRect.width),
            height: Math.max(4, vpRect.height),
          }}
        />
      )}
    </div>
  )
}
