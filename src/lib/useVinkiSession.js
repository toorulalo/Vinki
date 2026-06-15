import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from './supabaseClient'

const SESSION_EXPIRY_HOURS = 48

export function useVinkiSession(profile, onInvite) {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const onInviteRef = useRef(onInvite)
  onInviteRef.current = onInvite

  // Subscribe to personal channel for incoming session invites
  useEffect(() => {
    if (!profile?.id) return
    const ch = supabase.channel(`vinki-user-${profile.id}`)
    ch.on('broadcast', { event: 'session_invite' }, ({ payload }) => {
      onInviteRef.current?.(payload)
    })
    ch.subscribe()
    return () => supabase.removeChannel(ch)
  }, [profile?.id])

  const reload = useCallback(async () => {
    if (!profile) { setLoading(false); return }
    setLoading(true)

    try {
      const { data } = await supabase
        .from('session_participants')
        .select('session_id, individual_canvas_id, last_opened_card_id, last_opened_at, joined_at, sessions(*)')
        .eq('user_id', profile.id)
        .maybeSingle()

      if (!data || !data.sessions) {
        setSession(null)
        return
      }

      const sess = data.sessions
      const lastActivity = new Date(sess.last_activity_at)
      const hoursSince = (Date.now() - lastActivity.getTime()) / (1000 * 60 * 60)

      if (hoursSince > SESSION_EXPIRY_HOURS) {
        await leaveSessionById(sess.id, profile.id)
        setSession(null)
        return
      }

      setSession({ ...sess, my_individual_canvas_id: data.individual_canvas_id })
    } catch (err) {
      console.error('Error cargando sesión:', err)
      setSession(null)
    } finally {
      setLoading(false)
    }
  }, [profile])

  useEffect(() => { reload() }, [reload])

  async function leaveSessionById(sessionId, userId) {
    await supabase
      .from('session_participants')
      .delete()
      .eq('session_id', sessionId)
      .eq('user_id', userId)

    const { data: remaining } = await supabase
      .from('session_participants')
      .select('user_id')
      .eq('session_id', sessionId)

    if (!remaining || remaining.length === 0) {
      await supabase.from('sessions').delete().eq('id', sessionId)
    }
  }

  async function createSession(individualCanvasId, invitedUserId = null) {
    if (!profile) return { error: new Error('No hay perfil activo.') }

    const { data: existing } = await supabase
      .from('session_participants')
      .select('session_id')
      .eq('user_id', profile.id)
      .maybeSingle()

    if (existing) return { error: new Error('Ya tienes una sesión Vinki activa.') }

    const now = new Date().toISOString()
    const { data: sess, error: sessError } = await supabase
      .from('sessions')
      .insert({
        host_id: profile.id,
        mode: 'normal',
        last_activity_at: now,
        invited_user_id: invitedUserId || null,
      })
      .select()
      .single()

    if (sessError) return { error: sessError }

    const { error: partError } = await supabase
      .from('session_participants')
      .insert({
        session_id: sess.id,
        user_id: profile.id,
        individual_canvas_id: individualCanvasId,
        joined_at: now,
      })

    if (partError) {
      await supabase.from('sessions').delete().eq('id', sess.id)
      return { error: partError }
    }

    // Broadcast invite to the invited user's personal channel
    if (invitedUserId) {
      try {
        const inviteChannel = supabase.channel(`vinki-user-${invitedUserId}`)
        await inviteChannel.subscribe()
        inviteChannel.send({
          type: 'broadcast',
          event: 'session_invite',
          payload: {
            sessionId: sess.id,
            hostName: profile.display_name,
            hostColor: profile.avatar_color,
            hostId: profile.id,
          },
        })
        supabase.removeChannel(inviteChannel)
      } catch (err) {
        console.warn('No se pudo enviar la invitación por broadcast:', err)
      }
    }

    await reload()
    return { data: sess }
  }

  async function joinSession(sessionId, individualCanvasId) {
    if (!profile) return { error: new Error('No hay perfil activo.') }

    const { data: existing } = await supabase
      .from('session_participants')
      .select('session_id')
      .eq('user_id', profile.id)
      .maybeSingle()

    if (existing) return { error: new Error('Ya tienes una sesión Vinki activa.') }

    const { data: sess, error: sessError } = await supabase
      .from('sessions')
      .select('*')
      .eq('id', sessionId)
      .maybeSingle()

    if (sessError || !sess) return { error: new Error('La sesión no existe o ya no está disponible.') }

    const now = new Date().toISOString()
    const { error: insertError } = await supabase
      .from('session_participants')
      .insert({
        session_id: sess.id,
        user_id: profile.id,
        individual_canvas_id: individualCanvasId,
        joined_at: now,
      })

    if (insertError) {
      if (insertError.code === '23505') return { error: new Error('Ya estás en esa sesión.') }
      return { error: insertError }
    }

    await reload()
    return { data: sess }
  }

  async function leaveSession() {
    if (!profile || !session) return
    await leaveSessionById(session.id, profile.id)
    setSession(null)
  }

  async function updateActivity() {
    if (!session) return
    const now = new Date().toISOString()
    await supabase
      .from('sessions')
      .update({ last_activity_at: now })
      .eq('id', session.id)
    setSession((prev) => prev ? { ...prev, last_activity_at: now } : prev)
  }

  function checkExpiry() {
    if (!session?.last_activity_at) return false
    const hoursSince = (Date.now() - new Date(session.last_activity_at).getTime()) / (1000 * 60 * 60)
    return hoursSince > SESSION_EXPIRY_HOURS
  }

  async function getPendingInvitations() {
    if (!profile) return []
    const { data } = await supabase
      .from('sessions')
      .select('id, host_id, created_at, profiles!sessions_host_id_fkey(display_name, avatar_color)')
      .eq('invited_user_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(5)
    return data || []
  }

  return {
    session,
    loading,
    createSession,
    joinSession,
    leaveSession,
    updateActivity,
    checkExpiry,
    reload,
    getPendingInvitations,
  }
}
