import { useEffect, useState, useCallback } from 'react'
import { supabase } from './supabaseClient'

export const MAX_NORMAL_SESSIONS = 1
export const MAX_PROYECTO_SESSIONS = 2

/**
 * Sesiones VINKI-VINKI en las que participa el usuario, con la lista de
 * compañeros de cada una.
 */
export function useVinkiSessions(profile) {
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    if (!profile) return
    setLoading(true)

    const { data: own } = await supabase
      .from('session_participants')
      .select('session_id, individual_canvas_id, sessions(id, mode, shared_canvas_id, created_at)')
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
        mode: row.sessions.mode,
        shared_canvas_id: row.sessions.shared_canvas_id,
        created_at: row.sessions.created_at,
        my_individual_canvas_id: row.individual_canvas_id,
        participants: participants || []
      })
    }

    list.sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
    setSessions(list)
    setLoading(false)
  }, [profile])

  useEffect(() => {
    reload()
  }, [reload])

  const normalCount = sessions.filter((s) => s.mode === 'normal').length
  const proyectoCount = sessions.filter((s) => s.mode === 'proyecto').length

  async function createSession(mode, individualCanvasId) {
    if (mode === 'normal' && normalCount >= MAX_NORMAL_SESSIONS) {
      return { error: new Error('Ya tenés una sesión VINKI-VINKI activa.') }
    }
    if (mode === 'proyecto' && proyectoCount >= MAX_PROYECTO_SESSIONS) {
      return {
        error: new Error(`Máximo ${MAX_PROYECTO_SESSIONS} proyectos activos.`)
      }
    }

    let sharedCanvasId = null

    if (mode === 'proyecto') {
      const { data: sharedCanvas, error: canvasError } = await supabase
        .from('canvases')
        .insert({ owner_id: profile.id, name: 'Lienzo del proyecto' })
        .select()
        .single()
      if (canvasError) return { error: canvasError }
      sharedCanvasId = sharedCanvas.id
    }

    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .insert({ mode, shared_canvas_id: sharedCanvasId })
      .select()
      .single()
    if (sessionError) return { error: sessionError }

    const { error: participantError } = await supabase
      .from('session_participants')
      .insert({
        session_id: session.id,
        user_id: profile.id,
        individual_canvas_id: individualCanvasId
      })
    if (participantError) return { error: participantError }

    await reload()
    return { data: session }
  }

  async function joinSession(sessionId, individualCanvasId) {
    const cleanId = sessionId.trim()

    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .select('id, mode')
      .eq('id', cleanId)
      .maybeSingle()

    if (sessionError || !session) {
      return { error: new Error('Código inválido. Revisá que esté bien copiado.') }
    }

    if (session.mode === 'normal' && normalCount >= MAX_NORMAL_SESSIONS) {
      return { error: new Error('Ya tenés una sesión VINKI-VINKI activa.') }
    }
    if (session.mode === 'proyecto' && proyectoCount >= MAX_PROYECTO_SESSIONS) {
      return {
        error: new Error(`Máximo ${MAX_PROYECTO_SESSIONS} proyectos activos.`)
      }
    }

    const { error: insertError } = await supabase
      .from('session_participants')
      .insert({
        session_id: session.id,
        user_id: profile.id,
        individual_canvas_id: individualCanvasId
      })

    if (insertError) {
      if (insertError.code === '23505') {
        return { error: new Error('Ya estás en esa sesión.') }
      }
      return { error: insertError }
    }

    await reload()
    return { data: session }
  }

  async function leaveSession(sessionId) {
    await supabase
      .from('session_participants')
      .delete()
      .eq('session_id', sessionId)
      .eq('user_id', profile.id)

    await reload()
  }

  /**
   * Transforma una sesión 'normal' en 'proyecto': crea un lienzo compartido
   * y lo asigna como shared_canvas_id de la sesión. Ambos participantes
   * pasan a ver ese lienzo común.
   */
  async function convertToProject(sessionId) {
    const { data: sharedCanvas, error: canvasError } = await supabase
      .from('canvases')
      .insert({ owner_id: profile.id, name: 'Proyecto VINKI-VINKI' })
      .select()
      .single()

    if (canvasError) return { error: canvasError }

    const { error: sessionError } = await supabase
      .from('sessions')
      .update({ mode: 'proyecto', shared_canvas_id: sharedCanvas.id })
      .eq('id', sessionId)

    if (sessionError) return { error: sessionError }

    await reload()
    return { data: { shared_canvas_id: sharedCanvas.id } }
  }

  /**
   * Copia las tarjetas de un lienzo individual al lienzo compartido del
   * proyecto (cuando alguien acepta "guardar mis tarjetas").
   */
  async function copyCardsToCanvas(fromCanvasId, toCanvasId) {
    const { data: cards } = await supabase
      .from('cards')
      .select('type, title, content, x, y, minimized')
      .eq('canvas_id', fromCanvasId)

    if (!cards || cards.length === 0) return { data: [] }

    const rows = cards.map((c) => ({ ...c, canvas_id: toCanvasId }))
    const { data, error } = await supabase.from('cards').insert(rows).select()
    return { data, error }
  }

  return {
    sessions,
    loading,
    normalCount,
    proyectoCount,
    createSession,
    joinSession,
    leaveSession,
    convertToProject,
    copyCardsToCanvas,
    reload
  }
}
