import { useRef, useState, useCallback, useEffect } from 'react'

const MIN_SCALE = 0.35
const MAX_SCALE = 2.8

export function useViewport(containerRef) {
  const [view, setView] = useState({ x: 0, y: 0, scale: 1 })
  const [animating, setAnimating] = useState(false)
  const viewRef = useRef(view)
  viewRef.current = view
  const pointers = useRef(new Map())
  const gesture  = useRef(null)

  const clamp = (s) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, s))

  const onWheel = useCallback((e) => {
    if (!e.ctrlKey) return
    e.preventDefault()
    const rect = containerRef.current.getBoundingClientRect()
    const px = e.clientX - rect.left
    const py = e.clientY - rect.top
    const cur = viewRef.current
    const factor = e.deltaY < 0 ? 1.1 : 0.9
    const next = clamp(cur.scale * factor)
    const ratio = next / cur.scale
    setView({ scale: next, x: px - (px - cur.x) * ratio, y: py - (py - cur.y) * ratio })
  }, [containerRef])

  const onPointerDown = useCallback((e) => {
    if (e.target.closest('.card-item,.modal-overlay,.fab-wrapper,.focus-bar,.coach-mark,.session-switch,.session-presence,.reactions-bar,.delete-mode-panel')) return
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    const cur = viewRef.current
    if (pointers.current.size === 1) {
      gesture.current = { mode: 'pan', startX: e.clientX, startY: e.clientY, origX: cur.x, origY: cur.y }
    } else if (pointers.current.size === 2) {
      const pts = [...pointers.current.values()]
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y)
      gesture.current = { mode: 'pinch', startDist: dist, startScale: cur.scale, origX: cur.x, origY: cur.y,
        centerX: (pts[0].x + pts[1].x) / 2, centerY: (pts[0].y + pts[1].y) / 2 }
    }
  }, [])

  const onPointerMove = useCallback((e) => {
    if (!pointers.current.has(e.pointerId)) return
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    const g = gesture.current
    if (!g) return
    if (g.mode === 'pan' && pointers.current.size === 1) {
      setView((v) => ({ ...v, x: g.origX + (e.clientX - g.startX), y: g.origY + (e.clientY - g.startY) }))
    } else if (g.mode === 'pinch' && pointers.current.size === 2) {
      const pts = [...pointers.current.values()]
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y)
      const rect = containerRef.current.getBoundingClientRect()
      const next = clamp(g.startScale * (dist / g.startDist))
      const ratio = next / g.startScale
      const cx = g.centerX - rect.left
      const cy = g.centerY - rect.top
      setView({ scale: next, x: cx - (cx - g.origX) * ratio, y: cy - (cy - g.origY) * ratio })
    }
  }, [containerRef])

  const onPointerUp = useCallback((e) => {
    pointers.current.delete(e.pointerId)
    if (pointers.current.size === 0) { gesture.current = null }
    else if (pointers.current.size === 1) {
      const cur = viewRef.current
      const [pt] = [...pointers.current.values()]
      gesture.current = { mode: 'pan', startX: pt.x, startY: pt.y, origX: cur.x, origY: cur.y }
    }
  }, [])

  const centerOn = useCallback((worldX, worldY, targetScale = 1.3) => {
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    const scale = clamp(targetScale)
    setAnimating(true)
    setView({ scale, x: rect.width / 2 - worldX * scale, y: rect.height / 2 - worldY * scale })
    setTimeout(() => setAnimating(false), 450)
  }, [containerRef])

  const screenToWorld = useCallback((sx, sy) => {
    const cur = viewRef.current
    return { x: (sx - cur.x) / cur.scale, y: (sy - cur.y) / cur.scale }
  }, [])

  return { view, animating, onWheel, onPointerDown, onPointerMove, onPointerUp, centerOn, screenToWorld }
}

export function useViewportWheelBinding(containerRef, onWheel) {
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [containerRef, onWheel])
}
