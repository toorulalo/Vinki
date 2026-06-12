import { useState } from 'react'
import { sendVropItem } from '../lib/useVropItems'

const TYPE_PREVIEW = {
  note: (content) => content?.text || '(nota vacía)',
  link: (content) => content?.url || '(sin link)',
  image: (content) => content?.url || '(sin imagen)'
}

export default function SendToVropDialog({
  card,
  partners,
  profile,
  getOrCreateThread,
  onClose
}) {
  const [partnerId, setPartnerId] = useState(partners[0]?.user_id || '')
  const [note, setNote] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  async function handleSend() {
    if (!partnerId) {
      setError('Elegí a quién enviarlo.')
      return
    }
    setSending(true)
    setError('')

    const { data: thread, error: threadError } = await getOrCreateThread(
      partnerId
    )
    if (threadError || !thread) {
      setSending(false)
      setError('No se pudo crear el Vrop. Probá de nuevo.')
      return
    }

    const { error: sendError } = await sendVropItem({
      threadId: thread.id,
      type: card.type,
      content: { ...card.content, title: card.title },
      note,
      senderId: profile.id
    })

    setSending(false)

    if (sendError) {
      setError('No se pudo enviar. Probá de nuevo.')
      return
    }

    setDone(true)
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="font-display">Enviar a Vrop It</h3>
          <button
            type="button"
            className="card-control-btn"
            onClick={onClose}
            aria-label="Cerrar"
          >
            ×
          </button>
        </div>

        {done ? (
          <p className="message success">
            Listo, lo agregamos al Vrop. Lo van a ver en "Vrop It".
          </p>
        ) : (
          <>
            <div className="vrop-preview">
              <span className="card-type-tag">{card.type}</span>
              <p>{TYPE_PREVIEW[card.type]?.(card.content)}</p>
            </div>

            {partners.length > 1 && (
              <div className="field">
                <label htmlFor="vrop-partner">Enviar a</label>
                <select
                  id="vrop-partner"
                  value={partnerId}
                  onChange={(e) => setPartnerId(e.target.value)}
                >
                  {partners.map((p) => (
                    <option key={p.user_id} value={p.user_id}>
                      {p.users?.name || 'Sin nombre'}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {partners.length === 1 && (
              <p className="vrop-to">
                Para: <strong>{partners[0].users?.name || 'tu compañero/a'}</strong>
              </p>
            )}

            <div className="field">
              <label htmlFor="vrop-note">Nota (opcional)</label>
              <input
                id="vrop-note"
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="¿Por qué le mandás esto?"
              />
            </div>

            <button
              type="button"
              className="btn-primary"
              onClick={handleSend}
              disabled={sending}
            >
              {sending ? 'Enviando...' : 'Enviar'}
            </button>

            {error && <p className="message error">{error}</p>}
          </>
        )}
      </div>
    </div>
  )
}
