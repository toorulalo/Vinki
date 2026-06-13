import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'

export const MAX_CARDS = 40

function defaultContent(type) {
  if (type === 'note') return { text: '' }
  if (type === 'link') return { url: '' }
  if (type === 'image') return { url: '' }
  if (type === 'pdf') return { url: '', filename: '' }
  if (type === 'timer') return { goal: 25, mode: 'pomodoro' }
  if (type === 'spotify') return { url: '', source: 'youtube' }
  return {}
}

/**
 * Carga las tarjetas de un lienzo y se mantiene sincronizado vía Realtime
 * (útil para el modo VINKI-VINKI, donde dos personas comparten un lienzo).
 */
export function useCards(canvasId) {
  const [cards, setCards] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!canvasId) return
    let active = true
    setLoading(true)

    async function load() {
      const { data } = await supabase
        .from('cards')
        .select('*')
        .eq('canvas_id', canvasId)
        .order('updated_at', { ascending: true })

      if (active) {
        setCards(data || [])
        setLoading(false)
      }
    }

    load()

    const channel = supabase
      .channel(`cards-${canvasId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'cards',
          filter: `canvas_id=eq.${canvasId}`
        },
        (payload) => {
          setCards((prev) => {
            if (payload.eventType === 'INSERT') {
              if (prev.some((c) => c.id === payload.new.id)) return prev
              return [...prev, payload.new]
            }
            if (payload.eventType === 'UPDATE') {
              return prev.map((c) =>
                c.id === payload.new.id ? payload.new : c
              )
            }
            if (payload.eventType === 'DELETE') {
              return prev.filter((c) => c.id !== payload.old.id)
            }
            return prev
          })
        }
      )
      .subscribe()

    return () => {
      active = false
      supabase.removeChannel(channel)
    }
  }, [canvasId])

  async function addCard(type, pos) {
    if (cards.length >= MAX_CARDS) {
      return { error: new Error(`Máximo ${MAX_CARDS} tarjetas por lienzo.`) }
    }

    const newCard = {
      canvas_id: canvasId,
      type,
      title: '',
      content: defaultContent(type),
      x: pos ? pos.x : Math.round(40 + Math.random() * 160),
      y: pos ? pos.y : Math.round(40 + Math.random() * 120)
    }

    const { data, error } = await supabase
      .from('cards')
      .insert(newCard)
      .select()
      .single()

    if (data) {
      setCards((prev) =>
        prev.some((c) => c.id === data.id) ? prev : [...prev, data]
      )
    }
    return { data, error }
  }

  function updateCardLocal(id, patch) {
    setCards((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)))
  }

  async function updateCard(id, patch) {
    updateCardLocal(id, patch)
    await supabase.from('cards').update(patch).eq('id', id)
  }

  async function removeCard(id) {
    setCards((prev) => prev.filter((c) => c.id !== id))
    await supabase.from('cards').delete().eq('id', id)
  }

  return {
    cards,
    loading,
    addCard,
    updateCard,
    updateCardLocal,
    removeCard
  }
}
