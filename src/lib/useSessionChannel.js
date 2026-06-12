import { useEffect, useRef } from 'react'
import { supabase } from './supabaseClient'

/**
 * Canal de broadcast (efímero, sin tabla) para eventos en vivo dentro de
 * una sesión VINKI-VINKI: reacciones, invitaciones a Proyecto, avisos de
 * que alguien salió, etc.
 */
export function useSessionChannel(sessionId, onEvent) {
  const channelRef = useRef(null)
  const handlerRef = useRef(onEvent)
  handlerRef.current = onEvent

  useEffect(() => {
    if (!sessionId) return

    const channel = supabase.channel(`vinki-session-${sessionId}`, {
      config: { broadcast: { self: false } }
    })

    channel.on('broadcast', { event: 'vinki' }, ({ payload }) => {
      handlerRef.current?.(payload)
    })

    channel.subscribe()
    channelRef.current = channel

    return () => {
      supabase.removeChannel(channel)
      channelRef.current = null
    }
  }, [sessionId])

  function send(payload) {
    channelRef.current?.send({ type: 'broadcast', event: 'vinki', payload })
  }

  return { send }
}
