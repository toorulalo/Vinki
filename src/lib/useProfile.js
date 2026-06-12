import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'

/**
 * Devuelve { profile, error } para el usuario autenticado.
 * Si no existe la fila en `users` todavía, la crea.
 *
 * - profile === undefined => cargando
 * - profile === null + error => algo falló (se muestra en pantalla)
 * - profile === null sin error => sin sesión
 */
export function useProfile(session) {
  const [profile, setProfile] = useState(undefined)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!session) {
      setProfile(null)
      setError(null)
      return
    }

    let active = true
    setProfile(undefined)
    setError(null)

    async function load() {
      try {
        const { data: existing, error: selectError } = await supabase
          .from('users')
          .select('*')
          .eq('auth_id', session.user.id)
          .maybeSingle()

        if (selectError) throw selectError
        if (!active) return

        if (existing) {
          setProfile(existing)
          return
        }

        const { data: created, error: insertError } = await supabase
          .from('users')
          .insert({
            auth_id: session.user.id,
            name: session.user.email?.split('@')[0] || 'Usuario'
          })
          .select()
          .single()

        if (insertError) throw insertError
        if (active) setProfile(created)
      } catch (err) {
        if (active) {
          setError(err.message || 'No se pudo cargar tu perfil.')
          setProfile(null)
        }
      }
    }

    load()

    return () => {
      active = false
    }
  }, [session])

  return { profile, error }
}
