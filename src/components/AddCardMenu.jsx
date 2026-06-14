import { useState } from 'react'
import { IconPlus, IconNote, IconLinkCard, IconX } from './icons/index.jsx'

const OPTIONS = [
  { type: 'note', label: 'Nota',  Icon: IconNote },
  { type: 'link', label: 'Link',  Icon: IconLinkCard },
]

export default function AddCardMenu({ onAdd, disabled }) {
  const [open, setOpen] = useState(false)

  function handlePick(type) { setOpen(false); onAdd(type) }

  return (
    <div className="fab-wrapper">
      {open && (
        <div className="fab-menu">
          {OPTIONS.map(({ type, label, Icon }) => (
            <button key={type} type="button" className="fab-option" onClick={() => handlePick(type)}>
              <Icon size={18} /> {label}
            </button>
          ))}
        </div>
      )}
      <button type="button" className={`fab${open ? ' open' : ''}`}
        onClick={() => setOpen((v) => !v)} disabled={disabled} aria-label="Agregar tarjeta" aria-expanded={open}>
        {open ? <IconX size={24} /> : <IconPlus size={24} />}
      </button>
    </div>
  )
}
