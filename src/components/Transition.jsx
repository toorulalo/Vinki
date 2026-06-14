import { useEffect, useState } from 'react'

/**
 * Transición "llenado de agua" entre vistas.
 * onReady: callback que se llama cuando la pantalla está cubierta y los datos pueden cargarse.
 * ready: cuando se pone en true (datos listos), empieza a drenar.
 */
export default function Transition({ ready, onReady, children }) {
  const [phase, setPhase] = useState('filling') // 'filling' | 'full' | 'draining' | 'done'

  useEffect(() => {
    // Fase 1: llenamos
    const t1 = setTimeout(() => {
      setPhase('full')
      onReady?.()
    }, 420)
    return () => clearTimeout(t1)
  }, [])

  useEffect(() => {
    if (ready && phase === 'full') {
      setPhase('draining')
      const t = setTimeout(() => setPhase('done'), 420)
      return () => clearTimeout(t)
    }
  }, [ready, phase])

  return (
    <>
      {phase === 'done' ? children : null}
      {phase !== 'done' && (
        <div className={`water-transition ${phase === 'draining' ? 'draining' : 'filling'}`} />
      )}
    </>
  )
}
