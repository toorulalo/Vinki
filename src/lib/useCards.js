import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'

export const MAX_CARDS = 40

function defaultContent(type) {
  if (type === 'note') return { note: '' }
  if (type === 'link') return { url: '', note: '' }
  return {}
}

export function useCards(canvasId) {
  const [cards, setCards] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!canvasId) return
    let active = true
    setLoading(true)

    async function load() {
      const { data } = await supabase
        .from('cards').select('*').eq('canvas_id', canvasId)
        .order('updated_at', { ascending: true })
      if (active) { setCards(data || []); setLoading(false) }
    }
    load()

    const channel = supabase.channel(`cards-${canvasId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cards', filter: `canvas_id=eq.${canvasId}` },
        (payload) => {
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
    const { data, error } = await supabase
      .from('cards')
      .insert({ canvas_id: canvasId, type, title: '', content: defaultContent(type), x: pos?.x ?? 100, y: pos?.y ?? 100 })
      .select().single()
    if (data) setCards((prev) => prev.some((c) => c.id === data.id) ? prev : [...prev, data])
    return { data, error }
  }

  function updateCardLocal(id, patch) {
    setCards((prev) => prev.map((c) => c.id === id ? { ...c, ...patch } : c))
  }

  async function updateCard(id, patch) {
    updateCardLocal(id, patch)
    await supabase.from('cards').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id)
  }

  async function removeCard(id) {
    setCards((prev) => prev.filter((c) => c.id !== id))
    await supabase.from('cards').delete().eq('id', id)
  }

  async function removeCards(ids) {
    setCards((prev) => prev.filter((c) => !ids.includes(c.id)))
    await supabase.from('cards').delete().in('id', ids)
  }

  return { cards, loading, addCard, updateCard, updateCardLocal, removeCard, removeCards }
}
