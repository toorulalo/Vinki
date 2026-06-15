import { useEffect, useState, useCallback } from 'react'
import { supabase } from './supabaseClient'

export function useFriends(profile) {
  const [friends, setFriends] = useState([])
  const [pending, setPending] = useState([])
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    if (!profile) return
    setLoading(true)

    try {
      const { data: sent } = await supabase
        .from('friendships')
        .select('id, status, addressee_id, profiles!friendships_addressee_id_fkey(id, username, display_name, avatar_color)')
        .eq('requester_id', profile.id)

      const { data: received } = await supabase
        .from('friendships')
        .select('id, status, requester_id, profiles!friendships_requester_id_fkey(id, username, display_name, avatar_color)')
        .eq('addressee_id', profile.id)

      const friendsList = []
      const pendingList = []

      for (const row of sent || []) {
        const prof = row.profiles
        if (row.status === 'accepted') {
          friendsList.push({ profile: prof, friendshipId: row.id, status: 'accepted' })
        } else if (row.status === 'pending') {
          pendingList.push({ profile: prof, friendshipId: row.id, direction: 'sent' })
        }
      }

      for (const row of received || []) {
        const prof = row.profiles
        if (row.status === 'accepted') {
          friendsList.push({ profile: prof, friendshipId: row.id, status: 'accepted' })
        } else if (row.status === 'pending') {
          pendingList.push({ profile: prof, friendshipId: row.id, direction: 'received' })
        }
      }

      setFriends(friendsList)
      setPending(pendingList)
    } catch (err) {
      console.error('Error cargando amigos:', err)
    } finally {
      setLoading(false)
    }
  }, [profile])

  useEffect(() => { reload() }, [reload])

  async function sendRequest(username) {
    if (!profile) return { error: new Error('No hay perfil activo.') }

    const { data: target, error: searchError } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_color')
      .ilike('username', username.trim())
      .maybeSingle()

    if (searchError) return { error: searchError }
    if (!target) return { error: new Error('No se encontró ningún usuario con ese nombre de usuario.') }
    if (target.id === profile.id) return { error: new Error('No puedes enviarte una solicitud a ti mismo.') }

    const alreadyFriend = friends.some((f) => f.profile?.id === target.id)
    const alreadyPending = pending.some((p) => p.profile?.id === target.id)
    if (alreadyFriend) return { error: new Error('Ya son amigos.') }
    if (alreadyPending) return { error: new Error('Ya existe una solicitud pendiente.') }

    const { data, error } = await supabase
      .from('friendships')
      .insert({ requester_id: profile.id, addressee_id: target.id, status: 'pending' })
      .select()
      .single()

    if (!error) await reload()
    return { data, error }
  }

  async function acceptRequest(friendshipId) {
    const { error } = await supabase
      .from('friendships')
      .update({ status: 'accepted' })
      .eq('id', friendshipId)
    if (!error) await reload()
    return { error }
  }

  async function removeFriend(friendshipId) {
    const { error } = await supabase
      .from('friendships')
      .delete()
      .eq('id', friendshipId)
    if (!error) await reload()
    return { error }
  }

  return { friends, pending, loading, sendRequest, acceptRequest, removeFriend, reload }
}
