import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'

export function useSession() {
  const [session, setSession] = useState(undefined)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session ?? null)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession ?? null)
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  return session
}
