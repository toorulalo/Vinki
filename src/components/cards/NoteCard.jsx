import { useState, useRef, useEffect, useCallback } from 'react'

export default function NoteCard({ card, isEditing, onUpdate }) {
  const [text, setText] = useState(card.content?.note || '')
  const debounceRef = useRef(null)
  const pendingRef = useRef(null) // unsaved value awaiting the debounce
  const saveRef = useRef(null)
  saveRef.current = (val) => onUpdate?.({ content: { ...card.content, note: val } })

  // Sync if card content changes from outside
  useEffect(() => {
    if (!isEditing) {
      setText(card.content?.note || '')
    }
  }, [card.content?.note, isEditing])

  const handleChange = useCallback((e) => {
    const val = e.target.value
    setText(val)
    // Debounced save
    pendingRef.current = val
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      pendingRef.current = null
      saveRef.current(val)
    }, 500)
  }, [])

  // Flush any pending save on unmount (e.g. panel closed mid-debounce)
  useEffect(() => {
    return () => {
      clearTimeout(debounceRef.current)
      if (pendingRef.current !== null) saveRef.current(pendingRef.current)
    }
  }, [])

  if (isEditing) {
    return (
      <textarea
        className="note-editor"
        value={text}
        placeholder="Escribe tu nota aquí..."
        autoFocus
        onChange={handleChange}
        onBlur={() => {
          clearTimeout(debounceRef.current)
          pendingRef.current = null
          onUpdate?.({ content: { ...card.content, note: text } })
        }}
      />
    )
  }

  const noteText = card.content?.note?.trim()
  return (
    <p className={`note-preview${noteText ? '' : ' empty'}`}>
      {noteText || 'Escribe algo...'}
    </p>
  )
}
