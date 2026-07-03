import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabaseClient'

const LEVEL_EMOJI = {
  0: '🌱',
  1: '🏠',
  2: '🏛️',
  3: '⭐',
}

// Canvas preview of a flashcard deck. Editing (create deck, add cards, review)
// lives in decks/DeckEditPanel, rendered by canvas/CardEditPanel.
// Props: { card, onOpen } — onOpen opens the card's edit panel.
export default function DeckCard({ card, onOpen }) {
  const deckId = card.content?.deckId

  const [deck,     setDeck]     = useState(null)
  const [dueCount, setDueCount] = useState(0)
  const [avgLevel, setAvgLevel] = useState(0)

  useEffect(() => {
    if (!deckId) return
    let active = true

    async function load() {
      const { data: deckData } = await supabase
        .from('decks')
        .select('*')
        .eq('id', deckId)
        .maybeSingle()
      if (!active || !deckData) return
      setDeck(deckData)

      const { data: flashcards } = await supabase
        .from('flashcards')
        .select('level, next_review')
        .eq('deck_id', deckId)
      if (!active || !flashcards) return

      const now = new Date()
      const due = flashcards.filter((fc) => new Date(fc.next_review) <= now)
      const avg = flashcards.length
        ? Math.round(flashcards.reduce((s, fc) => s + (fc.level || 0), 0) / flashcards.length)
        : 0
      setDueCount(due.length)
      setAvgLevel(avg)
    }

    load()
    return () => { active = false }
  }, [deckId, card.updated_at])

  const levelEmoji = LEVEL_EMOJI[avgLevel] ?? '🌱'
  const title = deck?.title || card.title || 'Mazo'

  if (!deckId) {
    return (
      <div className="deck-preview">
        <span className="deck-preview-emoji">🃏</span>
        <span className="deck-preview-title" style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>
          Sin mazo aún
        </span>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={(e) => { e.stopPropagation(); onOpen?.() }}
        >
          Crear mazo
        </button>
      </div>
    )
  }

  return (
    <div className="deck-preview">
      <span className="deck-preview-emoji">{levelEmoji}</span>
      <span className="deck-preview-title">{title}</span>
      {dueCount > 0 ? (
        <span className="deck-preview-due">{dueCount} para repasar hoy</span>
      ) : deck && (
        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
          Al día ✓
        </span>
      )}
    </div>
  )
}
