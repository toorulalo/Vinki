import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'

export const MAX_CANVASES = 5

export function useCanvases(profile, hiddenCanvasIds = []) {
  const [canvases, setCanvases] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // profile===undefined significa que auth todavía está cargando.
    // No cambiar el estado de loading hasta que profile se resuelva,
    // de lo contrario Canvas.jsx pasa la guarda loadingCanvases===false
    // con canvases=[] y muestra el Onboarding por un frame.
    if (profile === undefined) return

    if (!profile) {
      setLoading(false)
      return
    }

    let active = true
    // Marcar como loading ANTES del fetch para que Canvas.jsx muestre
    // el spinner mientras llegan los datos reales.
    setLoading(true)

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
    // Intentar el delete y devolver el error para que el llamador lo maneje.
    // Antes esto fallaba silenciosamente: la UI se actualizaba pero en la DB
    // el lienzo permanecía (por RLS o por ser un canvas de proyecto).
    const { error } = await supabase.from('canvases').delete().eq('id', id)
    if (!error) {
      setCanvases((prev) => prev.filter((c) => c.id !== id))
    }
    return { error }
  }

  async function renameCanvas(id, name) {
    setCanvases((prev) => prev.map((c) => (c.id === id ? { ...c, name } : c)))
    await supabase.from('canvases').update({ name }).eq('id', id)
  }

  return { canvases, loading, addCanvas, removeCanvas, renameCanvas }
}
