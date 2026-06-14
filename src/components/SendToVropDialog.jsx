import { useState } from 'react'
import { sendVropItem } from '../lib/useVropItems'
import { IconClose } from './icons/index.jsx'

export default function SendToVropDialog({ card, partner, profile, getOrCreateThread, onClose }) {
  const [note, setNote] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  const url = card.content?.url || ''
  const isValidForVrop = card.type === 'link' && url

  async function handleSend() {
    if (!isValidForVrop) { setError('Solo se pueden enviar tarjetas de tipo Link con URL.'); return }
    setSending(true); setError('')
    const { data: thread, error: threadErr } = await getOrCreateThread(partner.user_id)
    if (threadErr || !thread) { setSending(false); setError('No se pudo crear el Vrop.'); return }
    const { error: sendErr } = await sendVropItem({ threadId: thread.id, type: 'link', url, note, senderId: profile.id })
    setSending(false)
    if (sendErr) { setError('No se pudo enviar.'); return }
    setDone(true)
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">Enviar a Vrop It</h3>
          <button type="button" className="btn-icon" onClick={onClose} aria-label="Cerrar">
            <IconClose size={18} />
          </button>
        </div>
        {done ? (
          <p className="msg msg-success">Enviado a Vrop It de {partner?.users?.name || 'tu compañero/a'}.</p>
        ) : (
          <>
            <p style={{ fontSize: '0.88rem', color: 'var(--ink-soft)', marginBottom: 12 }}>
              Para: <strong>{partner?.users?.name || 'tu compañero/a'}</strong>
            </p>
            <div style={{ background: 'var(--paper-2)', borderRadius: 8, padding: '10px 12px', fontSize: '0.85rem', marginBottom: 12, wordBreak: 'break-all', color: 'var(--ink)' }}>
              {url || '(sin URL)'}
            </div>
            <div className="field">
              <label className="field-label">Nota (opcional)</label>
              <input className="field-input" type="text" value={note}
                onChange={(e) => setNote(e.target.value)} placeholder="¿Por qué lo mandás?" />
            </div>
            <button type="button" className="btn-primary" onClick={handleSend} disabled={sending || !isValidForVrop}>
              {sending ? 'Enviando...' : 'Enviar'}
            </button>
            {error && <p className="msg msg-error">{error}</p>}
          </>
        )}
      </div>
    </div>
  )
}
