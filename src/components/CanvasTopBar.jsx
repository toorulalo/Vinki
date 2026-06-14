import { useState, useRef, useEffect } from 'react'
import { IconBack, IconUndo, IconRedo, IconTrash } from './icons/index.jsx'

export default function CanvasTopBar({ title, onBack, onRename, onUndo, onRedo, onDeleteMode, canUndo, canRedo }) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(title)
  const inputRef = useRef(null)

  useEffect(() => { setValue(title) }, [title])
  useEffect(() => { if (editing) inputRef.current?.select() }, [editing])

  function handleBlur() {
    setEditing(false)
    const clean = value.trim()
    if (clean && clean !== title) onRename(clean)
    else setValue(title)
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') { e.preventDefault(); inputRef.current?.blur() }
    if (e.key === 'Escape') { setValue(title); setEditing(false) }
  }

  return (
    <>
      <div className="topbar-left">
        <button type="button" className="btn-icon" onClick={onBack} aria-label="Volver">
          <IconBack size={20} />
        </button>
        {editing ? (
          <input ref={inputRef} className="topbar-title-input" value={value}
            onChange={(e) => setValue(e.target.value)}
            onBlur={handleBlur} onKeyDown={handleKeyDown} maxLength={40} />
        ) : (
          <span className="topbar-title" onDoubleClick={() => setEditing(true)} title="Doble tap para renombrar">
            {title}
          </span>
        )}
      </div>
      <div className="canvas-topbar-right">
        <button type="button" className="btn-icon" onClick={onUndo} disabled={!canUndo} aria-label="Deshacer"
          style={{ opacity: canUndo ? 1 : 0.35 }}>
          <IconUndo size={19} />
        </button>
        <button type="button" className="btn-icon" onClick={onRedo} disabled={!canRedo} aria-label="Rehacer"
          style={{ opacity: canRedo ? 1 : 0.35 }}>
          <IconRedo size={19} />
        </button>
        <button type="button" className="btn-icon" onClick={onDeleteMode} aria-label="Modo basurero">
          <IconTrash size={19} />
        </button>
      </div>
    </>
  )
}
