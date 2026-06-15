import { useState, useEffect, useRef } from 'react'

const CARD_TYPES = [
  { type: 'note',  label: 'Nota',          icon: '📝' },
  { type: 'link',  label: 'Link',           icon: '🔗' },
  { type: 'image', label: 'Imagen',         icon: '🖼️' },
  { type: 'pdf',   label: 'PDF',            icon: '📄' },
  { type: 'timer', label: 'Temporizador',   icon: '⏱️' },
  { type: 'deck',  label: 'Mazo',           icon: '🃏' },
]

export default function AddBlockMenu({ onAdd }) {
  const [open, setOpen] = useState(false)
  const menuRef = useRef(null)

  // Close on outside click
  useEffect(() => {
    if (!open) return
    function handleClick(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('pointerdown', handleClick)
    return () => document.removeEventListener('pointerdown', handleClick)
  }, [open])

  function handleSelect(type) {
    setOpen(false)
    onAdd(type)
  }

  return (
    <div className="canvas-fab" ref={menuRef}>
      {open && (
        <div className="fab-menu">
          {CARD_TYPES.map(({ type, label, icon }) => (
            <button
              key={type}
              className="fab-menu-item"
              type="button"
              onClick={() => handleSelect(type)}
            >
              <span style={{ fontSize: '1.1rem', lineHeight: 1 }}>{icon}</span>
              {label}
            </button>
          ))}
        </div>
      )}
      <button
        className={`fab-btn${open ? ' is-open' : ''}`}
        type="button"
        aria-label={open ? 'Cerrar menú' : 'Agregar tarjeta'}
        onClick={() => setOpen((o) => !o)}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>
    </div>
  )
}
