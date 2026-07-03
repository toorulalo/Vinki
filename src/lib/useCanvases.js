import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'

export const MAX_CANVASES = 5

export function useCanvases(profile) {
  const [canvases, setCanvases] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const profileId = profile?.id ?? null

  useEffect(() => {
    if (profile === undefined) return
    if (!profileId) { setLoading(false); return }
    let active = true
    setLoading(true)
    setError(null)

    async function init() {
      const { data, error: loadError } = await supabase
        .from('canvases')
        .select('*')
        .eq('owner_id', profileId)
        .order('created_at', { ascending: true })
      if (!active) return
      if (loadError) setError(loadError.message || 'No se pudieron cargar tus lienzos.')
      setCanvases(data || [])
      setLoading(false)
    }
    init()
    return () => { active = false }
  }, [profileId])

  async function addCanvas(title) {
    if (canvases.length >= MAX_CANVASES)
      return { error: new Error(`Máximo ${MAX_CANVASES} lienzos por usuario.`) }
    const { data, error } = await supabase
      .from('canvases')
      .insert({ owner_id: profile.id, title: title || 'Nuevo lienzo', is_active: false })
      .select()
      .single()
    if (data) setCanvases((prev) => [...prev, data])
    return { data, error }
  }

  async function removeCanvas(id) {
    const { error } = await supabase.from('canvases').delete().eq('id', id)
    if (!error) setCanvases((prev) => prev.filter((c) => c.id !== id))
    return { error }
  }

  async function renameCanvas(id, title) {
    setCanvases((prev) => prev.map((c) => (c.id === id ? { ...c, title } : c)))
    const { error } = await supabase.from('canvases').update({ title, updated_at: new Date().toISOString() }).eq('id', id)
    return { error }
  }

  async function setActiveCanvas(id) {
    setCanvases((prev) => prev.map((c) => ({ ...c, is_active: c.id === id })))
    await supabase.from('canvases').update({ is_active: false }).eq('owner_id', profile.id)
    await supabase.from('canvases').update({ is_active: true, updated_at: new Date().toISOString() }).eq('id', id)
  }

  return { canvases, loading, error, addCanvas, removeCanvas, renameCanvas, setActiveCanvas }
}
