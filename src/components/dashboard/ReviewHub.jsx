import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../../lib/supabaseClient'
import ReviewSession from '../decks/ReviewSession'

// Dashboard section: all the user's decks with cards due today, one tap to review.
// Props: { profile }
export default function ReviewHub({ profile }) {
  const [decks, setDecks] = useState([])
  const [loading, setLoading] = useState(true)
  const [reviewDeckId, setReviewDeckId] = useState(null)

  const load = useCallback(async () => {
    if (!profile?.id) return
    const { data: deckRows } = await supabase
      .from('decks')
      .select('id, title')
      .eq('owner_id', profile.id)

    if (!deckRows?.length) {
      setDecks([])
      setLoading(false)
      return
    }

    const { data: fcRows } = await supabase
      .from('flashcards')
      .select('deck_id, next_review')
      .in('deck_id', deckRows.map(d => d.id))

    const now = new Date()
    const dueByDeck = {}
    for (const fc of fcRows || []) {
      if (new Date(fc.next_review) <= now) {
        dueByDeck[fc.deck_id] = (dueByDeck[fc.deck_id] || 0) + 1
      }
    }

    setDecks(deckRows
      .map(d => ({ ...d, due: dueByDeck[d.id] || 0 }))
      .filter(d => d.due > 0))
    setLoading(false)
  }, [profile?.id])

  useEffect(() => { load() }, [load])

  if (loading || decks.length === 0) return null

  const totalDue = decks.reduce((s, d) => s + d.due, 0)

  return (
    <>
      <p className="dashboard-section-title">Para repasar hoy</p>
      <div
        style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          padding: '14px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', margin: 0 }}>
          Tienes <strong style={{ color: 'var(--color-primary)' }}>{totalDue}</strong> tarjeta{totalDue !== 1 ? 's' : ''} esperándote 🌱
        </p>
        {decks.map(deck => (
          <div
            key={deck.id}
            style={{ display: 'flex', alignItems: 'center', gap: 10 }}
          >
            <span style={{ flex: 1, minWidth: 0, fontSize: 'var(--text-sm)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              🃏 {deck.title}
            </span>
            <span className="badge badge-accent" style={{ fontSize: 'var(--text-xs)', flexShrink: 0 }}>
              {deck.due}
            </span>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              style={{ flexShrink: 0 }}
              onClick={() => setReviewDeckId(deck.id)}
            >
              Repasar
            </button>
          </div>
        ))}
      </div>

      {reviewDeckId && (
        <ReviewSession
          deckId={reviewDeckId}
          onClose={() => { setReviewDeckId(null); load() }}
        />
      )}
    </>
  )
}
