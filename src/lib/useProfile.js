import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'

/**
 * Devuelve el perfil (fila de `users`) del usuario autenticado.
 * Si no existe todavía (por ejemplo, primer login tras confirmar el email),
 * lo crea automáticamente.
 *
 * - undefined => cargando
 * - null      => sin sesión
 * - objeto    => perfil listo
 */
export function useProfile(session) {
  const [profile, setProfile] = useState(undefined)

  useEffect(() => {
    if (!session) {
      setProfile(null)
      return
    }

    let active = true
    setProfile(undefined)

    async function load() {
      const { data: existing } = await supabase
        .from('users')
        .select('*')
        .eq('auth_id', session.user.id)
        .maybeSingle()

      if (!active) return

      if (existing) {
        setProfile(existing)
        return
      }

      const { data: created } = await supabase
        .from('users')
        .insert({
          auth_id: session.user.id,
          name: session.user.email?.split('@')[0] || 'Usuario'
        })
        .select()
        .single()

      if (active) setProfile(created || null)
    }

    load()

    return () => {
      active = false
    }
  }, [session])

  return profile
}
