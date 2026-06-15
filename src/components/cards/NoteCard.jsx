import { useState, useRef, useEffect, useCallback } from 'react'

export default function NoteCard({ card, isEditing, onUpdate }) {
  const [text, setText] = useState(card.content?.note || '')
  const debounceRef = useRef(null)

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
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      onUpdate?.({ content: { ...card.content, note: val } })
    }, 500)
  }, [card.content, onUpdate])

  // Save on unmount
  useEffect(() => {
    return () => {
      clearTimeout(debounceRef.current)
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
