import { useEffect, useState, useCallback } from 'react'
import { supabase } from './supabaseClient'

/**
 * Devuelve los hilos de Vrop It en los que participa el usuario,
 * junto con los datos del otro participante.
 */
export function useVropThreads(profile) {
  const [threads, setThreads] = useState([])
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    if (!profile) return
    setLoading(true)

    const { data } = await supabase
      .from('vrop_threads')
      .select(
        'id, created_at, user_a:user_a_id(id, name), user_b:user_b_id(id, name)'
      )
      .order('created_at', { ascending: false })

    const list = (data || []).map((t) => {
      const partner = t.user_a.id === profile.id ? t.user_b : t.user_a
      return {
        id: t.id,
        created_at: t.created_at,
        partner
      }
    })

    setThreads(list)
    setLoading(false)
  }, [profile])

  useEffect(() => {
    reload()
  }, [reload])

  /**
   * Busca el hilo con un compañero dado, o lo crea si no existe.
   */
  async function getOrCreateThread(partnerId) {
    const [userAId, userBId] =
      profile.id < partnerId ? [profile.id, partnerId] : [partnerId, profile.id]

    const { data: existing } = await supabase
      .from('vrop_threads')
      .select('id')
      .eq('user_a_id', userAId)
      .eq('user_b_id', userBId)
      .maybeSingle()

    if (existing) return { data: existing }

    const { data: created, error } = await supabase
      .from('vrop_threads')
      .insert({ user_a_id: userAId, user_b_id: userBId })
      .select('id')
      .single()

    if (!error) await reload()
    return { data: created, error }
  }

  return { threads, loading, getOrCreateThread, reload }
}
