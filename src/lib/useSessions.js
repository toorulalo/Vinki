import { useEffect, useState, useCallback } from 'react'
import { supabase } from './supabaseClient'

export const MAX_SESSIONS = 1

function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

export function useSessions(profile) {
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    if (!profile) return
    setLoading(true)
    const { data: own } = await supabase
      .from('session_participants')
      .select('session_id, individual_canvas_id, sessions(id, join_code, created_at)')
      .eq('user_id', profile.id)

    const list = []
    for (const row of own || []) {
      if (!row.sessions) continue
      const { data: participants } = await supabase
        .from('session_participants')
        .select('user_id, individual_canvas_id, users(id, name)')
        .eq('session_id', row.session_id)
      list.push({
        id: row.sessions.id,
        join_code: row.sessions.join_code,
        created_at: row.sessions.created_at,
        my_individual_canvas_id: row.individual_canvas_id,
        participants: participants || []
      })
    }
    list.sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
    setSessions(list)
    setLoading(false)
  }, [profile])

  useEffect(() => { reload() }, [reload])

  async function createSession(individualCanvasId) {
    const existing = sessions.filter(() => true)
    if (existing.length >= MAX_SESSIONS)
      return { error: new Error('Ya tenés una sesión Vinki-Vinki activa.') }

    const join_code = generateCode()
    const { data: session, error: sessionError } = await supabase
      .from('sessions').insert({ join_code }).select().single()
    if (sessionError) return { error: sessionError }

    const { error: partError } = await supabase.from('session_participants')
      .insert({ session_id: session.id, user_id: profile.id, individual_canvas_id: individualCanvasId })
    if (partError) return { error: partError }

    await reload()
    return { data: session }
  }

  async function joinSession(code, individualCanvasId) {
    const clean = code.trim().toUpperCase()
    const { data: session, error: sessionError } = await supabase
      .from('sessions').select('id, join_code').eq('join_code', clean).maybeSingle()
    if (sessionError || !session)
      return { error: new Error('Código inválido. Revisá que esté bien escrito.') }

    if (sessions.length >= MAX_SESSIONS)
      return { error: new Error('Ya tenés una sesión Vinki-Vinki activa.') }

    const { error: insertError } = await supabase.from('session_participants')
      .insert({ session_id: session.id, user_id: profile.id, individual_canvas_id: individualCanvasId })
    if (insertError) {
      if (insertError.code === '23505') return { error: new Error('Ya estás en esa sesión.') }
      return { error: insertError }
    }
    await reload()
    return { data: session }
  }

  async function leaveSession(sessionId) {
    await supabase.from('session_participants')
      .delete().eq('session_id', sessionId).eq('user_id', profile.id)
    const { data: remaining } = await supabase
      .from('session_participants').select('user_id').eq('session_id', sessionId)
    if (!remaining || remaining.length === 0)
      await supabase.from('sessions').delete().eq('id', sessionId)
    await reload()
  }

  return { sessions, loading, createSession, joinSession, leaveSession, reload }
}
