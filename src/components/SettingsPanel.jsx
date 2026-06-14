import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { IconClose, IconLogout } from './icons/index.jsx'

export function getAnimationsEnabled() {
  return localStorage.getItem('vinki-animations') !== 'off'
}

export default function SettingsPanel({ profile, onNameChanged, onClose }) {
  const [name, setName] = useState(profile.name || '')
  const [animations, setAnimations] = useState(getAnimationsEnabled())
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [loggingOut, setLoggingOut] = useState(false)

  async function handleSave(e) {
    e.preventDefault()
    const clean = name.trim()
    if (!clean) return
    setBusy(true); setMsg('')
    const { error } = await supabase.from('users').update({ name: clean }).eq('id', profile.id)
    setBusy(false)
    if (error) { setMsg('No se pudo guardar.'); return }
    setMsg('Guardado'); onNameChanged?.(clean)
  }

  function toggleAnimations() {
    const next = !animations
    setAnimations(next)
    localStorage.setItem('vinki-animations', next ? 'on' : 'off')
    document.body.classList.toggle('no-animations', !next)
  }

  async function handleLogout() {
    if (loggingOut) return
    if (!window.confirm('¿Cerrar sesión? Tus lienzos quedan guardados.')) return
    setLoggingOut(true)
    await supabase.auth.signOut()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">Ajustes</h3>
          <button type="button" className="btn-icon" onClick={onClose} aria-label="Cerrar">
            <IconClose size={18} />
          </button>
        </div>

        <form onSubmit={handleSave} className="settings-section">
          <p className="settings-section-title">Tu nombre</p>
          <div className="field">
            <input className="field-input" type="text" value={name} maxLength={30}
              onChange={(e) => setName(e.target.value)} />
          </div>
          <button className="btn-primary" type="submit" disabled={busy} style={{ marginTop: 4 }}>
            {busy ? 'Guardando...' : 'Guardar nombre'}
          </button>
          {msg && <p className="msg msg-success" style={{ marginTop: 8 }}>{msg}</p>}
        </form>

        <div className="settings-section">
          <p className="settings-section-title">Rendimiento</p>
          <label className="settings-toggle-row">
            <span>Animaciones</span>
            <input type="checkbox" checked={animations} onChange={toggleAnimations} />
          </label>
          <p className="settings-hint">Desactivalas si tu dispositivo va lento.</p>
        </div>

        <div className="settings-section">
          <p className="settings-section-title">Cuenta</p>
          <p className="settings-hint" style={{ marginBottom: 12 }}>
            Salís de tu cuenta en este dispositivo. Tus lienzos y tarjetas quedan guardados.
          </p>
          <button type="button"
            style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--danger)', background: 'var(--danger-bg)', border: 'none', borderRadius: 'var(--radius-md)', padding: '12px 16px', fontFamily: 'var(--font-display)', fontWeight: 700, width: '100%', justifyContent: 'center', cursor: 'pointer' }}
            onClick={handleLogout} disabled={loggingOut}>
            <IconLogout size={16} />
            {loggingOut ? 'Saliendo...' : 'Cerrar sesión'}
          </button>
        </div>
      </div>
    </div>
  )
}
