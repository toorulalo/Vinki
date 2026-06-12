import { useState } from 'react'

const OPTIONS = [
  { type: 'note', label: 'Nota', icon: '📝' },
  { type: 'link', label: 'Link', icon: '🔗' },
  { type: 'image', label: 'Imagen', icon: '🖼️' },
  { type: 'pdf', label: 'PDF', icon: '📄' },
  { type: 'timer', label: 'Temporizador', icon: '⏱️' },
  { type: 'spotify', label: 'Música', icon: '🎵' }
]

export default function AddCardMenu({ onAdd, disabled }) {
  const [open, setOpen] = useState(false)

  function handlePick(type) {
    setOpen(false)
    onAdd(type)
  }

  return (
    <div className="fab-wrapper">
      {open && (
        <div className="fab-menu" role="menu">
          {OPTIONS.map((opt) => (
            <button
              key={opt.type}
              type="button"
              className="fab-option"
              onClick={() => handlePick(opt.type)}
            >
              <span aria-hidden="true">{opt.icon}</span> {opt.label}
            </button>
          ))}
        </div>
      )}
      <button
        type="button"
        className="fab"
        onClick={() => setOpen((v) => !v)}
        disabled={disabled}
        aria-label="Agregar tarjeta"
        aria-expanded={open}
      >
        {open ? '×' : '+'}
      </button>
    </div>
  )
}
