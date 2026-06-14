import { useRef, useState, useCallback } from 'react'

const MAX_STACK = 50

/**
 * Pila de deshacer/rehacer por lienzo.
 * Cada operación es { do: fn, undo: fn } — ambas ya saben qué escribir en Supabase.
 */
export function useHistory() {
  const past   = useRef([])  // [{do, undo, label}]
  const future = useRef([])
  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)

  function sync() {
    setCanUndo(past.current.length > 0)
    setCanRedo(future.current.length > 0)
  }

  const push = useCallback((op) => {
    past.current = [...past.current.slice(-MAX_STACK + 1), op]
    future.current = []
    sync()
  }, [])

  const undo = useCallback(async () => {
    if (!past.current.length) return
    const op = past.current[past.current.length - 1]
    past.current = past.current.slice(0, -1)
    future.current = [op, ...future.current]
    sync()
    await op.undo()
  }, [])

  const redo = useCallback(async () => {
    if (!future.current.length) return
    const op = future.current[0]
    future.current = future.current.slice(1)
    past.current = [...past.current, op]
    sync()
    await op.do()
  }, [])

  const clear = useCallback(() => {
    past.current = []
    future.current = []
    sync()
  }, [])

  return { push, undo, redo, clear, canUndo, canRedo }
}
