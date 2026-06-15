import { useEffect, useState, useCallback } from 'react'
import { supabase } from './supabaseClient'

const INTERVALS_DAYS = [0, 1, 3, 7]

function daysFromNow(n) {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return d.toISOString()
}

export function useDecks(profile) {
  const [decks, setDecks] = useState([])
  const [loading, setLoading] = useState(false)

  const reload = useCallback(async () => {
    if (!profile) return
    setLoading(true)
    const { data } = await supabase
      .from('decks')
      .select('*')
      .eq('owner_id', profile.id)
      .order('created_at', { ascending: true })
    setDecks(data || [])
    setLoading(false)
  }, [profile])

  useEffect(() => { reload() }, [reload])

  async function createDeck(cardId, ownerId, title = 'Mi mazo') {
    const { data, error } = await supabase
      .from('decks')
      .insert({ card_id: cardId, owner_id: ownerId, title })
      .select()
      .single()
    if (!error) setDecks((prev) => [...prev, data])
    return { data, error }
  }

  async function getDeckByCardId(cardId) {
    const { data } = await supabase
      .from('decks')
      .select('*')
      .eq('card_id', cardId)
      .maybeSingle()
    return data
  }

  async function renameDeck(deckId, title) {
    await supabase.from('decks').update({ title }).eq('id', deckId)
    setDecks((prev) => prev.map((d) => d.id === deckId ? { ...d, title } : d))
  }

  async function deleteDeck(deckId) {
    await supabase.from('decks').delete().eq('id', deckId)
    setDecks((prev) => prev.filter((d) => d.id !== deckId))
  }

  return { decks, loading, reload, createDeck, getDeckByCardId, renameDeck, deleteDeck }
}

export function useFlashcards(deckId) {
  const [cards, setCards] = useState([])
  const [loading, setLoading] = useState(false)

  const reload = useCallback(async () => {
    if (!deckId) return
    setLoading(true)
    const { data } = await supabase
      .from('flashcards')
      .select('*')
      .eq('deck_id', deckId)
      .order('created_at', { ascending: true })
    setCards(data || [])
    setLoading(false)
  }, [deckId])

  useEffect(() => { reload() }, [reload])

  async function addCard(front = '', back = '') {
    const { data, error } = await supabase
      .from('flashcards')
      .insert({ deck_id: deckId, front, back, level: 0, next_review: new Date().toISOString() })
      .select()
      .single()
    if (data) setCards((prev) => [...prev, data])
    return { data, error }
  }

  async function updateCard(id, patch) {
    setCards((prev) => prev.map((c) => c.id === id ? { ...c, ...patch } : c))
    await supabase.from('flashcards').update(patch).eq('id', id)
  }

  async function removeCard(id) {
    setCards((prev) => prev.filter((c) => c.id !== id))
    await supabase.from('flashcards').delete().eq('id', id)
  }

  async function recordResult(id, remembered) {
    const card = cards.find((c) => c.id === id)
    if (!card) return
    const newLevel = remembered ? Math.min(card.level + 1, 3) : 0
    const interval = INTERVALS_DAYS[newLevel] ?? 0
    const patch = {
      level:         newLevel,
      last_reviewed: new Date().toISOString(),
      next_review:   daysFromNow(interval),
    }
    await updateCard(id, patch)
  }

  const dueCards = cards.filter((c) => new Date(c.next_review) <= new Date())

  const avgLevel = cards.length
    ? Math.round(cards.reduce((s, c) => s + c.level, 0) / cards.length)
    : 0

  return { cards, dueCards, avgLevel, loading, reload, addCard, updateCard, removeCard, recordResult }
}

export const LEVEL_LABELS = ['Nueva', 'Practicando', 'Firme', 'Dominada']
export const LEVEL_CSS    = ['level-0', 'level-1', 'level-2', 'level-3']
