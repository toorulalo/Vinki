import { useState } from 'react'
import { supabase } from '../../lib/supabaseClient'

function triggerFilePicker(accept, onFile) {
  const prev = document.getElementById('__vinki_file_input')
  if (prev) prev.remove()
  const input = document.createElement('input')
  input.id = '__vinki_file_input'
  input.type = 'file'
  input.accept = accept
  input.style.cssText = 'position:fixed;top:-200px;left:-200px;opacity:0;'
  document.body.appendChild(input)
  input.addEventListener('change', () => {
    if (input.files?.[0]) onFile(input.files[0])
    setTimeout(() => input.remove(), 1000)
  }, { once: true })
  input.click()
}

export default function PdfCard({ card, isEditing, onUpdate }) {
  const [url,       setUrl]       = useState(card.content?.url || '')
  const [title,     setTitle]     = useState(card.title        || '')
  const [uploading, setUploading] = useState(false)
  const [uploadErr, setUploadErr] = useState('')

  const currentUrl = isEditing ? url : (card.content?.url || '')
  const viewerUrl  = currentUrl
    ? `https://docs.google.com/viewer?url=${encodeURIComponent(currentUrl)}&embedded=true`
    : null

  async function handleFile(file) {
    if (!file) return
    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
    if (!isPdf) { setUploadErr('Solo se aceptan archivos PDF.'); return }
    if (file.size > 25 * 1024 * 1024) { setUploadErr('El PDF debe pesar menos de 25 MB.'); return }
    setUploading(true)
    setUploadErr('')
    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
      const path = `${card.id}/${Date.now()}_${safeName}`
      const { error: upErr } = await supabase.storage
        .from('card-pdfs')
        .upload(path, file, { contentType: 'application/pdf', upsert: true })
      if (upErr) throw upErr
      const { data: { publicUrl } } = supabase.storage.from('card-pdfs').getPublicUrl(path)
      const newTitle = title || file.name.replace(/\.pdf$/i, '')
      setUrl(publicUrl)
      setTitle(newTitle)
      onUpdate?.({ title: newTitle, content: { ...card.content, url: publicUrl, title: newTitle } })
    } catch {
      setUploadErr('No se pudo subir el PDF. Revisá los permisos del bucket en Supabase.')
    } finally {
      setUploading(false)
    }
  }

  function save() {
    onUpdate?.({ title, content: { ...card.content, url, title } })
  }

  if (isEditing) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {viewerUrl && (
          <iframe
            src={viewerUrl}
            style={{
              width: '100%',
              height: 340,
              border: 'none',
              borderRadius: 'var(--radius-md)',
            }}
            title="Vista previa PDF"
          />
        )}

        <button
          type="button"
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
            fontFamily: 'inherit',
          }}
          disabled={uploading}
          onClick={() => !uploading && triggerFilePicker('.pdf,application/pdf', handleFile)}
        >
          📄 {uploading ? 'Subiendo...' : 'Subir PDF (máx 25 MB)'}
        </button>

        {uploadErr && (
          <p style={{ color: 'var(--color-danger)', fontSize: 'var(--text-xs)' }}>
            {uploadErr}
          </p>
        )}

        <div className="field">
          <label className="field-label">Título del PDF</label>
          <input
            className="field-input"
            type="text"
            value={title}
            placeholder="Nombre del documento"
            onChange={(e) => setTitle(e.target.value)}
            onBlur={save}
          />
        </div>

        <div className="field">
          <label className="field-label">O pegar URL del PDF</label>
          <input
            className="field-input"
            type="url"
            value={url}
            placeholder="https://..."
            onChange={(e) => setUrl(e.target.value)}
            onBlur={save}
          />
        </div>

        {currentUrl && (
          <a
            href={viewerUrl}
            target="_blank"
            rel="noreferrer"
            className="btn btn-secondary btn-sm"
            style={{ textDecoration: 'none', textAlign: 'center' }}
          >
            Abrir PDF ↗
          </a>
        )}
      </div>
    )
  }

  // Preview mode
  const displayUrl   = card.content?.url
  const displayTitle = card.title || card.content?.title || 'PDF sin título'

  return (
    <div className="pdf-preview">
      <span className="pdf-preview-icon" style={{ fontSize: '2rem' }}>📄</span>
      <span className="pdf-preview-name">{displayTitle}</span>
      {displayUrl && (
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          style={{ marginTop: 4 }}
          onClick={(e) => {
            e.stopPropagation()
            const viewer = `https://docs.google.com/viewer?url=${encodeURIComponent(displayUrl)}&embedded=true`
            window.open(viewer, '_blank', 'noreferrer')
          }}
        >
          Abrir PDF
        </button>
      )}
    </div>
  )
}
