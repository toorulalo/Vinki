import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'

export function useProfile(session) {
  const [profile, setProfile] = useState(undefined)
  const [error, setError] = useState(null)
  // Key the fetch on the user id, not the session object: onAuthStateChange
  // emits a new session object on every TOKEN_REFRESHED (~hourly) and refetching
  // then would unmount the whole app behind the loading spinner.
  const userId = session?.user?.id ?? null

  useEffect(() => {
    if (!userId) { setProfile(null); setError(null); return }
    let active = true
    setProfile(undefined)
    setError(null)

    async function load() {
      try {
        const { data, error: selectError } = await supabase
          .from('profiles')
          .select('*')
          .eq('auth_id', userId)
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
  }, [userId])

  return { profile, setProfile, error }
}
