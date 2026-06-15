import { useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { compressImage } from '../../lib/compressImage'

export default function ImageCard({ card, isEditing, onUpdate, profile }) {
  const [url,       setUrl]       = useState(card.content?.url  || '')
  const [note,      setNote]      = useState(card.content?.note || '')
  const [uploading, setUploading] = useState(false)
  const [uploadErr, setUploadErr] = useState('')

  async function handleFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setUploadErr('')
    try {
      const blob = await compressImage(file)
      const path = `${card.id}/${Date.now()}.jpg`
      const { error: upErr } = await supabase.storage
        .from('card-images')
        .upload(path, blob, { contentType: 'image/jpeg', upsert: true })
      if (upErr) throw upErr
      const { data: { publicUrl } } = supabase.storage.from('card-images').getPublicUrl(path)
      setUrl(publicUrl)
      onUpdate?.({ content: { ...card.content, url: publicUrl, note } })
    } catch {
      setUploadErr('No se pudo subir la imagen. Intentá de nuevo.')
    } finally {
      setUploading(false)
    }
  }

  function saveUrl() {
    onUpdate?.({ content: { ...card.content, url, note } })
  }

  function saveNote() {
    onUpdate?.({ content: { ...card.content, url, note } })
  }

  if (isEditing) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {(url || card.content?.url) && (
          <img
            src={url || card.content?.url}
            alt={card.title || ''}
            style={{
              width: '100%',
              borderRadius: 'var(--radius-md)',
              maxHeight: 280,
              objectFit: 'cover',
            }}
          />
        )}

        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            padding: '10px 16px',
            background: 'var(--bg-surface-2)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            fontSize: 'var(--text-sm)',
            fontWeight: 500,
            cursor: uploading ? 'not-allowed' : 'pointer',
            color: 'var(--text-secondary)',
            transition: 'background var(--duration-fast) ease',
          }}
        >
          🖼️ {uploading ? 'Subiendo...' : 'Subir imagen'}
          <input
            type="file"
            accept="image/*"
            onChange={handleFile}
            style={{ display: 'none' }}
            disabled={uploading}
          />
        </label>

        {uploadErr && (
          <p style={{ color: 'var(--color-danger)', fontSize: 'var(--text-xs)' }}>
            {uploadErr}
          </p>
        )}

        <div className="field">
          <label className="field-label">O pegar URL de imagen</label>
          <input
            className="field-input"
            type="url"
            value={url}
            placeholder="https://..."
            onChange={(e) => setUrl(e.target.value)}
            onBlur={saveUrl}
          />
        </div>

        <div className="field">
          <label className="field-label">Nota (opcional)</label>
          <textarea
            className="field-textarea"
            value={note}
            placeholder="Descripción de la imagen..."
            style={{ minHeight: 60 }}
            onChange={(e) => setNote(e.target.value)}
            onBlur={saveNote}
          />
        </div>
      </div>
    )
  }

  // Preview mode
  const displayUrl = card.content?.url

  if (!displayUrl) {
    return (
      <div className="image-preview-empty">
        <span style={{ fontSize: '1.8rem' }}>🖼️</span>
        <span style={{ fontSize: 'var(--text-xs)' }}>Sin imagen</span>
      </div>
    )
  }

  return (
    <img
      className="image-preview-img"
      src={displayUrl}
      alt={card.title || ''}
      loading="lazy"
    />
  )
}
