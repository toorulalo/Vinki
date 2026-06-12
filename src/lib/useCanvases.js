import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'

export const MAX_CANVASES = 5

/**
 * Carga los lienzos del usuario. Si no tiene ninguno, crea "Mi lienzo"
 * automáticamente.
 */
export function useCanvases(profile, hiddenCanvasIds = []) {
  const [canvases, setCanvases] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!profile) return
    let active = true

    async function init() {
      const { data } = await supabase
        .from('canvases')
        .select('*')
        .eq('owner_id', profile.id)
        .order('created_at', { ascending: true })

      let list = data || []
      const visible = list.filter((c) => !hiddenCanvasIds.includes(c.id))

      if (visible.length === 0) {
        const { data: created } = await supabase
          .from('canvases')
          .insert({ owner_id: profile.id, name: 'Mi lienzo' })
          .select()
          .single()
        if (created) list = [...list, created]
      }

      if (active) {
        setCanvases(list)
        setLoading(false)
      }
    }

    init()

    return () => {
      active = false
    }
  }, [profile])

  async function addCanvas(name) {
    const visibleCount = canvases.filter(
      (c) => !hiddenCanvasIds.includes(c.id)
    ).length

    if (visibleCount >= MAX_CANVASES) {
      return { error: new Error(`Máximo ${MAX_CANVASES} lienzos por usuario.`) }
    }
    const { data, error } = await supabase
      .from('canvases')
      .insert({ owner_id: profile.id, name: name || 'Nuevo lienzo' })
      .select()
      .single()

    if (data) setCanvases((prev) => [...prev, data])
    return { data, error }
  }

  async function removeCanvas(id) {
    await supabase.from('canvases').delete().eq('id', id)
    setCanvases((prev) => prev.filter((c) => c.id !== id))
  }

  async function renameCanvas(id, name) {
    setCanvases((prev) => prev.map((c) => (c.id === id ? { ...c, name } : c)))
    await supabase.from('canvases').update({ name }).eq('id', id)
  }

  return { canvases, loading, addCanvas, removeCanvas, renameCanvas }
}
