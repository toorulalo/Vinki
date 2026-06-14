import { useEffect, useState, useCallback } from 'react'
import { supabase } from './supabaseClient'

export function useVropThreads(profile) {
  const [threads, setThreads] = useState([])
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    if (!profile) return
    setLoading(true)
    const { data } = await supabase
      .from('vrop_threads')
      .select('id, created_at, user_a_data:user_a(id, name), user_b_data:user_b(id, name)')
      .order('created_at', { ascending: false })
    const list = (data || []).map((t) => ({
      id: t.id,
      created_at: t.created_at,
      partner: t.user_a_data?.id === profile.id ? t.user_b_data : t.user_a_data || { id: null, name: 'Compañero/a' }
    }))
    setThreads(list)
    setLoading(false)
  }, [profile])

  useEffect(() => { reload() }, [reload])

  async function getOrCreateThread(partnerId) {
    const [userA, userB] = profile.id < partnerId ? [profile.id, partnerId] : [partnerId, profile.id]
    const { data: existing } = await supabase
      .from('vrop_threads').select('id').eq('user_a', userA).eq('user_b', userB).maybeSingle()
    if (existing) return { data: existing }
    const { data: created, error } = await supabase
      .from('vrop_threads').insert({ user_a: userA, user_b: userB }).select('id').single()
    if (!error) await reload()
    return { data: created, error }
  }

  return { threads, loading, getOrCreateThread, reload }
}
