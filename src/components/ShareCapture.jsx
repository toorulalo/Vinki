import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useToast } from './ui/Toast'
import { getDomain } from '../lib/linkPreview'
import { MAX_CARDS } from '../lib/useCards'

// Handles the PWA share_target: when the app is opened via "Compartir en Vinki",
// the shared title/text/url arrive as query params. Lets the user pick a canvas
// and saves the content as a link or note card there.
// Props: { profile, canvases, onOpenCanvas }

function parseSharedFromLocation() {
  const params = new URLSearchParams(window.location.search)
  const title = params.get('title') || ''
  const text = params.get('text') || ''
  let url = params.get('url') || ''
  // Many Android apps put the URL inside `text`
  if (!url) {
    const match = text.match(/https?:\/\/\S+/)
    if (match) url = match[0]
  }
  if (!url && !text && !title) return null
  return { title, text, url }
}

export default function ShareCapture({ profile, canvases, onOpenCanvas }) {
  const [shared, setShared] = useState(null)
  const [saving, setSaving] = useState(false)
  const { showToast } = useToast()

  useEffect(() => {
    const data = parseSharedFromLocation()
    if (!data) return
    setShared(data)
    // Clean the URL so a reload doesn't re-trigger the capture
    window.history.replaceState({}, '', window.location.pathname)
  }, [])

  if (!shared || !profile) return null

  async function saveTo(canvasId) {
    setSaving(true)
    try {
      const { count } = await supabase
        .from('cards')
        .select('id', { count: 'exact', head: true })
        .eq('canvas_id', canvasId)
      if ((count ?? 0) >= MAX_CARDS) {
        showToast(`Ese lienzo ya tiene el máximo de ${MAX_CARDS} tarjetas.`, 'error')
        setSaving(false)
        return
      }

      const isLink = Boolean(shared.url)
      const noteText = shared.text && shared.text !== shared.url ? shared.text : ''
      const { error } = await supabase.from('cards').insert({
        canvas_id: canvasId,
        type: isLink ? 'link' : 'note',
        title: shared.title || (isLink ? getDomain(shared.url) : ''),
        content: isLink ? { url: shared.url, note: noteText, title: shared.title } : { note: noteText || shared.title },
        x: 120 + Math.round(Math.random() * 120),
        y: 120 + Math.round(Math.random() * 120),
        width: 260,
        height: isLink ? 200 : 180,
        z: 0,
        group_id: null,
        minimized: false,
      })
      if (error) throw error
      showToast('Guardado en tu lienzo ✓', 'success')
      setShared(null)
      onOpenCanvas?.(canvasId)
    } catch (err) {
      showToast(err.message || 'No se pudo guardar.', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShared(null)}>
      <div className="modal" style={{ background: 'var(--bg-surface)', padding: 24 }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 'var(--text-lg)', margin: '0 0 6px', color: 'var(--text-primary)' }}>
          Guardar en Vinki
        </h2>
        <p
          style={{
            fontSize: 'var(--text-sm)',
            color: 'var(--text-secondary)',
            margin: '0 0 16px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            display: '-webkit-box',
            WebkitLineClamp: 3,
            WebkitBoxOrient: 'vertical',
            wordBreak: 'break-word',
          }}
        >
          {shared.url || shared.text || shared.title}
        </p>

        <p style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
          Elige un lienzo
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
          {canvases.length === 0 && (
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', margin: 0 }}>
              Aún no tienes lienzos. Crea uno primero.
            </p>
          )}
          {canvases.map(c => (
            <button
              key={c.id}
              type="button"
              className="btn btn-secondary"
              disabled={saving}
              onClick={() => saveTo(c.id)}
              style={{ justifyContent: 'flex-start' }}
            >
              {c.title}
            </button>
          ))}
        </div>

        <button type="button" className="btn btn-ghost btn-full" onClick={() => setShared(null)} disabled={saving}>
          Cancelar
        </button>
      </div>
    </div>
  )
}
