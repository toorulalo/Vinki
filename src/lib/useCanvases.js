import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'

export const MAX_CANVASES = 5

/**
 * Carga los lienzos del usuario. Si no tiene ninguno, el componente que use
 * este hook debe mostrar un diálogo para crear el primero (con nombre).
 */
export function useCanvases(profile, hiddenCanvasIds = []) {
  const [canvases, setCanvases] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!profile) {
      setLoading(false)
      return
    }
    let active = true

    async function init() {
      const { data } = await supabase
        .from('canvases')
        .select('*')
        .eq('owner_id', profile.id)
        .order('created_at', { ascending: true })

      if (active) {
        setCanvases(data || [])
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
