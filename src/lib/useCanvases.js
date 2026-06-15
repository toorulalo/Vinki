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
        .from('canvases')
        .select('*')
        .eq('owner_id', profile.id)
        .order('created_at', { ascending: true })
      if (active) { setCanvases(data || []); setLoading(false) }
    }
    init()
    return () => { active = false }
  }, [profile])

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
    await supabase.from('canvases').update({ title, updated_at: new Date().toISOString() }).eq('id', id)
  }

  async function setActiveCanvas(id) {
    setCanvases((prev) => prev.map((c) => ({ ...c, is_active: c.id === id })))
    await supabase.from('canvases').update({ is_active: false }).eq('owner_id', profile.id)
    await supabase.from('canvases').update({ is_active: true, updated_at: new Date().toISOString() }).eq('id', id)
  }

  return { canvases, loading, addCanvas, removeCanvas, renameCanvas, setActiveCanvas }
}
