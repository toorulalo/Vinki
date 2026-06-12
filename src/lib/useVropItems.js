import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'

export const MAX_VROP_ITEMS = 15

/**
 * Envía un ítem a un hilo de Vrop It. Función standalone, utilizable desde
 * cualquier componente sin necesitar el hook de un hilo específico.
 */
export async function sendVropItem({ threadId, type, content, note, senderId }) {
  const { error } = await supabase.from('vrop_items').insert({
    thread_id: threadId,
    sender_id: senderId,
    type,
    content,
    note: note || ''
  })
  return { error }
}

export function useVropItems(threadId) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!threadId) return
    let active = true
    setLoading(true)

    async function load() {
      const { data } = await supabase
        .from('vrop_items')
        .select('*, sender:sender_id(id, name)')
        .eq('thread_id', threadId)
        .order('created_at', { ascending: false })

      if (active) {
        setItems(data || [])
        setLoading(false)
      }
    }

    load()

    const channel = supabase
      .channel(`vrop-${threadId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'vrop_items',
          filter: `thread_id=eq.${threadId}`
        },
        () => {
          load()
        }
      )
      .subscribe()

    return () => {
      active = false
      supabase.removeChannel(channel)
    }
  }, [threadId])

  async function sendItemToThread(payload) {
    return sendVropItem({ threadId, ...payload })
  }

  return { items, loading, sendItem: sendItemToThread }
}
