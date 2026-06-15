import { useEffect, useState, useCallback } from 'react'
import { supabase } from './supabaseClient'

export function useSessionPresence(sessionId) {
  const [participants, setParticipants] = useState([])

  const reload = useCallback(async () => {
    if (!sessionId) return
    const { data } = await supabase
      .from('session_participants')
      .select('user_id, individual_canvas_id, last_opened_card_id, last_opened_at, joined_at, profiles(id, username, display_name, avatar_color)')
      .eq('session_id', sessionId)
    setParticipants(
      (data || []).map((row) => ({
        user_id: row.user_id,
        individual_canvas_id: row.individual_canvas_id,
        last_opened_card_id: row.last_opened_card_id,
        last_opened_at: row.last_opened_at,
        joined_at: row.joined_at,
        profile: row.profiles,
      }))
    )
  }, [sessionId])

  useEffect(() => {
    reload()
    if (!sessionId) return
    const channel = supabase.channel(`presence-${sessionId}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'session_participants',
        filter: `session_id=eq.${sessionId}`
      }, reload)
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [sessionId, reload])

  return { participants, reload }
}

export async function setLastOpenedCard(sessionId, userId, cardId) {
  await supabase
    .from('session_participants')
    .update({ last_opened_card_id: cardId, last_opened_at: new Date().toISOString() })
    .eq('session_id', sessionId)
    .eq('user_id', userId)
}
