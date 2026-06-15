import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabaseClient'

const LEVEL_EMOJI = {
  0: '🌱',
  1: '🏠',
  2: '🏛️',
  3: '⭐',
}

export default function DeckCard({ card, isEditing, onUpdate, profile }) {
  const deckId = card.content?.deckId

  const [deck,      setDeck]      = useState(null)
  const [dueCount,  setDueCount]  = useState(0)
  const [avgLevel,  setAvgLevel]  = useState(0)
  const [creating,  setCreating]  = useState(false)
  const [deckTitle, setDeckTitle] = useState(card.title || 'Mi mazo')
  const [editTitle, setEditTitle] = useState(card.title || 'Mi mazo')

  // Load deck info when deckId is known
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
      setDeckTitle(deckData.title || card.title || 'Mi mazo')
      setEditTitle(deckData.title || card.title || 'Mi mazo')

      // Load flashcards for stats
      const { data: flashcards } = await supabase
        .from('flashcards')
        .select('level, next_review')
        .eq('deck_id', deckId)
      if (!active || !flashcards) return

      const now  = new Date()
      const due  = flashcards.filter((fc) => new Date(fc.next_review) <= now)
      const avg  = flashcards.length
        ? Math.round(flashcards.reduce((s, fc) => s + (fc.level || 0), 0) / flashcards.length)
        : 0
      setDueCount(due.length)
      setAvgLevel(avg)
    }

    load()
    return () => { active = false }
  }, [deckId, card.title])

  async function handleCreateDeck() {
    if (!profile) return
    setCreating(true)
    try {
      const title = deckTitle || card.title || 'Mi mazo'
      const { data: newDeck, error } = await supabase
        .from('decks')
        .insert({ card_id: card.id, owner_id: profile.id, title })
        .select()
        .single()
      if (error || !newDeck) throw error || new Error('No se pudo crear el mazo')
      onUpdate?.({ title, content: { ...card.content, deckId: newDeck.id } })
      setDeck(newDeck)
    } catch {
      // Silent fail — user can retry
    } finally {
      setCreating(false)
    }
  }

  function saveDeckTitle() {
    if (editTitle.trim() && editTitle !== deckTitle) {
      const t = editTitle.trim()
      setDeckTitle(t)
      onUpdate?.({ title: t })
      if (deckId) {
        supabase.from('decks').update({ title: t }).eq('id', deckId)
      }
    }
  }

  const levelEmoji = LEVEL_EMOJI[avgLevel] ?? '🌱'

  if (isEditing) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {deckId && deck ? (
          <>
            <div style={{ textAlign: 'center', padding: '8px 0' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: 8 }}>{levelEmoji}</div>
              <div
                style={{
                  fontSize: 'var(--text-sm)',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  marginBottom: 4,
                }}
              >
                {deckTitle}
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap', marginTop: 8 }}>
                <span
                  className="badge badge-primary"
                  title="Nivel promedio"
                >
                  {levelEmoji} Nivel {avgLevel}
                </span>
                {dueCount > 0 && (
                  <span className="badge badge-accent" title="Cartas para repasar">
                    {dueCount} para hoy
                  </span>
                )}
              </div>
            </div>

            <div className="field">
              <label className="field-label">Nombre del mazo</label>
              <input
                className="field-input"
                type="text"
                value={editTitle}
                placeholder="Nombre del mazo"
                maxLength={50}
                onChange={(e) => setEditTitle(e.target.value)}
                onBlur={saveDeckTitle}
              />
            </div>

            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', textAlign: 'center' }}>
              Para editar las flashcards, abre el panel completo del mazo desde el dashboard.
            </p>
          </>
        ) : (
          <>
            <div style={{ textAlign: 'center', padding: '8px 0' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: 8 }}>🃏</div>
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', marginBottom: 16 }}>
                Este mazo aún no tiene datos. Créalo para empezar a agregar flashcards.
              </p>
            </div>

            <div className="field">
              <label className="field-label">Nombre del mazo</label>
              <input
                className="field-input"
                type="text"
                value={deckTitle}
                placeholder="Ej: Vocabulario inglés"
                maxLength={50}
                onChange={(e) => setDeckTitle(e.target.value)}
              />
            </div>

            <button
              type="button"
              className="btn btn-primary"
              disabled={creating}
              onClick={handleCreateDeck}
            >
              {creating ? 'Creando...' : 'Crear mazo'}
            </button>
          </>
        )}
      </div>
    )
  }

  // Preview mode
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
          onClick={(e) => { e.stopPropagation(); handleCreateDeck() }}
          disabled={creating || !profile}
        >
          {creating ? 'Creando...' : 'Crear mazo'}
        </button>
      </div>
    )
  }

  return (
    <div className="deck-preview">
      <span className="deck-preview-emoji">{levelEmoji}</span>
      <span className="deck-preview-title">{deckTitle || card.title || 'Mazo'}</span>
      {dueCount > 0 && (
        <span className="deck-preview-due">{dueCount} para repasar hoy</span>
      )}
      {dueCount === 0 && deck && (
        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
          Al día ✓
        </span>
      )}
    </div>
  )
}
