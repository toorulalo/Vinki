import { useState } from 'react'
import { useFriends } from '../../lib/useFriends'
import Avatar from '../ui/Avatar'

// Props: { profile, session, onClose, onCreateSession, onJoinSession }
export default function FriendsPanel({ profile, session, onClose, onCreateSession, onJoinSession }) {
  const { friends, pending, loading, sendRequest, acceptRequest, removeFriend } = useFriends(profile)
  const [usernameInput, setUsernameInput] = useState('')
  const [sendError, setSendError] = useState('')
  const [sendSuccess, setSendSuccess] = useState('')
  const [sending, setSending] = useState(false)

  async function handleSendRequest(e) {
    e.preventDefault()
    if (!usernameInput.trim()) return
    setSending(true)
    setSendError('')
    setSendSuccess('')
    const { error } = await sendRequest(usernameInput.trim().replace(/^@/, ''))
    setSending(false)
    if (error) {
      setSendError(error.message)
    } else {
      setSendSuccess(`Solicitud enviada a @${usernameInput.trim().replace(/^@/, '')}`)
      setUsernameInput('')
    }
  }

  async function handleAccept(friendshipId) {
    await acceptRequest(friendshipId)
  }

  async function handleInvite(friend) {
    const { error } = await onCreateSession(null, friend.profile.id)
    if (error) {
      alert(error.message)
    }
    onClose()
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="overlay-backdrop"
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.3)',
          zIndex: 60,
        }}
      />

      {/* Panel */}
      <aside
        className="friends-panel"
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: 320,
          maxWidth: '90vw',
          background: 'var(--bg-surface)',
          borderLeft: '1px solid var(--border)',
          zIndex: 61,
          display: 'flex',
          flexDirection: 'column',
          boxShadow: 'var(--shadow-lg)',
        }}
      >
        {/* Header */}
        <div
          className="friends-header"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px',
            borderBottom: '1px solid var(--border)',
            flexShrink: 0,
          }}
        >
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 'var(--text-base)' }}>
            Amigos
          </span>
          <button type="button" className="btn btn-icon" onClick={onClose} aria-label="Cerrar">
            ✕
          </button>
        </div>

        {/* Scrollable body */}
        <div
          className="friends-body"
          style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: 24 }}
        >
          {/* Add friend */}
          <section>
            <p style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
              Añadir amigo
            </p>
            <form onSubmit={handleSendRequest} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <input
                className="field-input"
                type="text"
                placeholder="@nombre_de_usuario"
                value={usernameInput}
                onChange={e => { setUsernameInput(e.target.value); setSendError(''); setSendSuccess('') }}
                style={{ fontSize: 'var(--text-sm)' }}
              />
              {sendError && (
                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-danger, #ef4444)', margin: 0 }}>
                  {sendError}
                </p>
              )}
              {sendSuccess && (
                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-primary)', margin: 0 }}>
                  {sendSuccess}
                </p>
              )}
              <button
                type="submit"
                className="btn btn-primary btn-sm btn-full"
                disabled={sending || !usernameInput.trim()}
              >
                {sending ? 'Enviando...' : 'Enviar solicitud'}
              </button>
            </form>
          </section>

          {/* Pending requests */}
          {pending.length > 0 && (
            <section>
              <p style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
                Solicitudes pendientes ({pending.length})
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {pending.map(({ profile: p, friendshipId, direction }) => (
                  <div
                    key={friendshipId}
                    className="friend-row"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '8px 0',
                      borderBottom: '1px solid var(--border)',
                    }}
                  >
                    <Avatar displayName={p?.display_name || '?'} color={p?.avatar_color || '#2E7D52'} size="sm" />
                    <div className="friend-info" style={{ flex: 1, minWidth: 0 }}>
                      <p className="friend-name" style={{ margin: 0, fontSize: 'var(--text-sm)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {p?.display_name || 'Usuario'}
                      </p>
                      <p className="friend-username" style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                        @{p?.username}
                      </p>
                    </div>
                    {direction === 'received' ? (
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={() => handleAccept(friendshipId)}
                      >
                        Aceptar
                      </button>
                    ) : (
                      <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                        Pendiente
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Friends list */}
          <section>
            <p style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
              Amigos {friends.length > 0 ? `(${friends.length})` : ''}
            </p>

            {loading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: 16 }}>
                <div className="spinner" />
              </div>
            ) : friends.length === 0 ? (
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', textAlign: 'center', padding: '16px 0' }}>
                Todavía no tienes amigos en Vinki. ¡Envía una solicitud!
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {friends.map(({ profile: p, friendshipId }) => (
                  <div
                    key={friendshipId}
                    className="friend-row"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '8px 0',
                      borderBottom: '1px solid var(--border)',
                    }}
                  >
                    <Avatar displayName={p?.display_name || '?'} color={p?.avatar_color || '#2E7D52'} size="sm" />
                    <div className="friend-info" style={{ flex: 1, minWidth: 0 }}>
                      <p className="friend-name" style={{ margin: 0, fontSize: 'var(--text-sm)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {p?.display_name || 'Usuario'}
                      </p>
                      <p className="friend-username" style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                        @{p?.username}
                      </p>
                    </div>
                    {!session && (
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleInvite({ profile: p, friendshipId })}
                      >
                        Invitar
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </aside>
    </>
  )
}
