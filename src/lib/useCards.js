import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'

export const MAX_CARDS = 40

const DEFAULT_SIZES = {
  note:  { width: 260, height: 180 },
  link:  { width: 260, height: 200 },
  image: { width: 260, height: 220 },
  pdf:   { width: 220, height: 160 },
  timer: { width: 200, height: 200 },
  deck:  { width: 220, height: 160 },
}

function defaultContent(type) {
  if (type === 'note')  return { note: '' }
  if (type === 'link')  return { url: '', note: '', title: '' }
  if (type === 'image') return { url: '', note: '' }
  if (type === 'pdf')   return { url: '', title: '' }
  if (type === 'timer') return { duration: 25 * 60 }
  if (type === 'deck')  return { deckId: null }
  return {}
}

export function useCards(canvasId) {
  const [cards, setCards] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    // Clear immediately so switching canvases never shows (editable) stale cards.
    setCards([])
    setError(null)
    if (!canvasId) { setLoading(false); return }
    let active = true
    setLoading(true)

    async function load() {
      const { data, error: loadError } = await supabase
        .from('cards')
        .select('*')
        .eq('canvas_id', canvasId)
        .order('updated_at', { ascending: true })
      if (!active) return
      if (loadError) setError(loadError.message || 'No se pudieron cargar las tarjetas.')
      setCards(data || [])
      setLoading(false)
    }
    load()

    const channel = supabase.channel(`cards-${canvasId}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'cards',
        filter: `canvas_id=eq.${canvasId}`
      }, (payload) => {
        setCards((prev) => {
          if (payload.eventType === 'INSERT') {
            if (prev.some((c) => c.id === payload.new.id)) return prev
            return [...prev, payload.new]
          }
          if (payload.eventType === 'UPDATE')
            return prev.map((c) => c.id === payload.new.id ? payload.new : c)
          if (payload.eventType === 'DELETE')
            return prev.filter((c) => c.id !== payload.old.id)
          return prev
        })
      })
      .subscribe()

    return () => { active = false; supabase.removeChannel(channel) }
  }, [canvasId])

  async function addCard(type, pos) {
    if (cards.length >= MAX_CARDS)
      return { error: new Error(`Máximo ${MAX_CARDS} tarjetas por lienzo.`) }
    const sizes = DEFAULT_SIZES[type] || { width: 260, height: 180 }
    const { data, error } = await supabase
      .from('cards')
      .insert({
        canvas_id: canvasId,
        type,
        title:     '',
        content:   defaultContent(type),
        x:         pos?.x ?? 100,
        y:         pos?.y ?? 100,
        width:     sizes.width,
        height:    sizes.height,
        z:         0,
        group_id:  null,
        minimized: false,
      })
      .select()
      .single()
    if (data) setCards((prev) => prev.some((c) => c.id === data.id) ? prev : [...prev, data])
    return { data, error }
  }

  function updateCardLocal(id, patch) {
    setCards((prev) => prev.map((c) => c.id === id ? { ...c, ...patch } : c))
  }

  async function updateCard(id, patch) {
    updateCardLocal(id, patch)
    const { error } = await supabase.from('cards')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', id)
    return { error }
  }

  async function removeCard(id) {
    const target = cards.find((c) => c.id === id)
    setCards((prev) => prev.filter((c) => c.id !== id))
    // Deck cards own a decks row (+ its flashcards) — remove them too so they don't orphan.
    const deckId = target?.type === 'deck' ? target.content?.deckId : null
    if (deckId) {
      await supabase.from('flashcards').delete().eq('deck_id', deckId)
      await supabase.from('decks').delete().eq('id', deckId)
    }
    const { error } = await supabase.from('cards').delete().eq('id', id)
    return { error }
  }

  async function removeCards(ids) {
    setCards((prev) => prev.filter((c) => !ids.includes(c.id)))
    const { error } = await supabase.from('cards').delete().in('id', ids)
    return { error }
  }

  return { cards, loading, error, addCard, updateCard, updateCardLocal, removeCard, removeCards }
}
