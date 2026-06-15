import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'

export function useProfile(session) {
  const [profile, setProfile] = useState(undefined)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!session) { setProfile(null); setError(null); return }
    let active = true
    setProfile(undefined)
    setError(null)

    async function load() {
      try {
        const { data, error: selectError } = await supabase
          .from('profiles')
          .select('*')
          .eq('auth_id', session.user.id)
          .maybeSingle()
        if (selectError) throw selectError
        if (!active) return
        setProfile(data ?? null)
      } catch (err) {
        if (active) { setError(err.message || 'No se pudo cargar tu perfil.'); setProfile(null) }
      }
    }
    load()
    return () => { active = false }
  }, [session])

  return { profile, setProfile, error }
}
