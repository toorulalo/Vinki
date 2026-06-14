import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'

export const MAX_CANVASES = 5

export function useCanvases(profile) {
  const [canvases, setCanvases] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (profile === undefined) return
    if (!profile) { setLoading(false); return }
    let active = true
    setLoading(true)

    async function init() {
      const { data } = await supabase
        .from('canvases').select('*').eq('owner_id', profile.id)
        .order('created_at', { ascending: true })
      if (active) { setCanvases(data || []); setLoading(false) }
    }
    init()
    return () => { active = false }
  }, [profile])

  async function addCanvas(name) {
    if (canvases.length >= MAX_CANVASES)
      return { error: new Error(`Máximo ${MAX_CANVASES} lienzos por usuario.`) }
    const { data, error } = await supabase
      .from('canvases')
      .insert({ owner_id: profile.id, name: name || 'Nuevo lienzo' })
      .select().single()
    if (data) setCanvases((prev) => [...prev, data])
    return { data, error }
  }

  async function removeCanvas(id) {
    const { error } = await supabase.from('canvases').delete().eq('id', id)
    if (!error) setCanvases((prev) => prev.filter((c) => c.id !== id))
    return { error }
  }

  async function renameCanvas(id, name) {
    setCanvases((prev) => prev.map((c) => (c.id === id ? { ...c, name } : c)))
    await supabase.from('canvases').update({ name, updated_at: new Date().toISOString() }).eq('id', id)
  }

  return { canvases, loading, addCanvas, removeCanvas, renameCanvas }
}
