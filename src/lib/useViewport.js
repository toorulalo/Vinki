import { useRef, useState, useCallback, useEffect } from 'react'

const MIN_SCALE = 0.4
const MAX_SCALE = 2.5

/**
 * Maneja el "viewport" del lienzo-mapa: escala (zoom) y desplazamiento (pan).
 * Devuelve el transform a aplicar al mundo, y handlers para el contenedor.
 */
export function useViewport(containerRef) {
  const [view, setView] = useState({ x: 0, y: 0, scale: 1 })
  const [animating, setAnimating] = useState(false)
  const viewRef = useRef(view)
  viewRef.current = view

  const gesture = useRef(null)

  const clampScale = (s) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, s))

  // Zoom con rueda (desktop) centrado en el cursor
  const onWheel = useCallback(
    (e) => {
      if (!e.ctrlKey) return
      e.preventDefault()
      const rect = containerRef.current.getBoundingClientRect()
      const px = e.clientX - rect.left
      const py = e.clientY - rect.top
      const cur = viewRef.current
      const factor = e.deltaY < 0 ? 1.1 : 0.9
      const next = clampScale(cur.scale * factor)
      const ratio = next / cur.scale
      setView({
        scale: next,
        x: px - (px - cur.x) * ratio,
        y: py - (py - cur.y) * ratio
      })
    },
    [containerRef]
  )

  // Paneo y pinch con punteros
  const pointers = useRef(new Map())

  const onPointerDown = useCallback((e) => {
    // Solo paneamos si el gesto empezó en el fondo, no sobre una tarjeta
    if (e.target.closest('.card-item, .embed-item, .modal-overlay')) return
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })

    if (pointers.current.size === 1) {
      const cur = viewRef.current
      gesture.current = {
        mode: 'pan',
        startX: e.clientX,
        startY: e.clientY,
        origX: cur.x,
        origY: cur.y
      }
    } else if (pointers.current.size === 2) {
      const pts = [...pointers.current.values()]
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y)
      const cur = viewRef.current
      gesture.current = {
        mode: 'pinch',
        startDist: dist,
        startScale: cur.scale,
        origX: cur.x,
        origY: cur.y,
        centerX: (pts[0].x + pts[1].x) / 2,
        centerY: (pts[0].y + pts[1].y) / 2
      }
    }
  }, [])

  const onPointerMove = useCallback(
    (e) => {
      if (!pointers.current.has(e.pointerId)) return
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
      const g = gesture.current
      if (!g) return

      if (g.mode === 'pan' && pointers.current.size === 1) {
        setView((v) => ({
          ...v,
          x: g.origX + (e.clientX - g.startX),
          y: g.origY + (e.clientY - g.startY)
        }))
      } else if (g.mode === 'pinch' && pointers.current.size === 2) {
        const pts = [...pointers.current.values()]
        const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y)
        const rect = containerRef.current.getBoundingClientRect()
        const next = clampScale(g.startScale * (dist / g.startDist))
        const ratio = next / g.startScale
        const cx = g.centerX - rect.left
        const cy = g.centerY - rect.top
        setView({
          scale: next,
          x: cx - (cx - g.origX) * ratio,
          y: cy - (cy - g.origY) * ratio
        })
      }
    },
    [containerRef]
  )

  const onPointerUp = useCallback((e) => {
    pointers.current.delete(e.pointerId)
    if (pointers.current.size === 0) gesture.current = null
    else if (pointers.current.size === 1) {
      const cur = viewRef.current
      const [pt] = [...pointers.current.values()]
      gesture.current = {
        mode: 'pan',
        startX: pt.x,
        startY: pt.y,
        origX: cur.x,
        origY: cur.y
      }
    }
  }, [])

  // Centrar la vista en un punto del mundo, con animación suave y zoom
  const centerOn = useCallback(
    (worldX, worldY, targetScale = 1.3) => {
      const rect = containerRef.current?.getBoundingClientRect()
      if (!rect) return
      const scale = clampScale(targetScale)
      setAnimating(true)
      setView({
        scale,
        x: rect.width / 2 - worldX * scale,
        y: rect.height / 2 - worldY * scale
      })
      setTimeout(() => setAnimating(false), 450)
    },
    [containerRef]
  )

  // Convertir coordenadas de pantalla a coordenadas del mundo
  const screenToWorld = useCallback((sx, sy) => {
    const cur = viewRef.current
    return {
      x: (sx - cur.x) / cur.scale,
      y: (sy - cur.y) / cur.scale
    }
  }, [])

  return {
    view,
    animating,
    onWheel,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    centerOn,
    screenToWorld
  }
}

export function useViewportWheelBinding(containerRef, onWheel) {
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [containerRef, onWheel])
}
