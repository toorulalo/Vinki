import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'

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
    setBusy(true)
    setMsg('')
    const { error } = await supabase
      .from('users')
      .update({ name: clean })
      .eq('id', profile.id)
    setBusy(false)
    if (error) {
      setMsg('No se pudo guardar.')
      return
    }
    setMsg('Guardado ✓')
    onNameChanged?.(clean)
  }

  function toggleAnimations() {
    const next = !animations
    setAnimations(next)
    localStorage.setItem('vinki-animations', next ? 'on' : 'off')
    document.body.classList.toggle('no-animations', !next)
  }

  async function handleLogout() {
    if (loggingOut) return
    if (!window.confirm('¿Cerrar sesión? Vas a volver a la pantalla de inicio.')) {
      return
    }
    setLoggingOut(true)
    await supabase.auth.signOut()
    // onAuthStateChange (useSession) se encarga de mostrar el Login
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="font-display">Configuración</h3>
          <button
            type="button"
            className="card-control-btn"
            onClick={onClose}
            aria-label="Cerrar"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSave} className="vinki-section">
          <h4>Tu nombre</h4>
          <div className="field">
            <input
              type="text"
              value={name}
              maxLength={30}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <button className="btn-primary" type="submit" disabled={busy}>
            {busy ? 'Guardando...' : 'Guardar nombre'}
          </button>
          {msg && <p className="message success">{msg}</p>}
        </form>

        <div className="vinki-section">
          <h4>Rendimiento</h4>
          <label className="mode-option">
            <input
              type="checkbox"
              checked={animations}
              onChange={toggleAnimations}
            />
            Animaciones activadas
          </label>
          <p className="vrop-thread-hint" style={{ marginTop: 8 }}>
            Desactivalas si tu dispositivo va lento.
          </p>
        </div>

        <div className="vinki-section">
          <h4>Cuenta</h4>
          <p className="vrop-thread-hint" style={{ marginTop: 0 }}>
            Vas a salir de tu cuenta en este dispositivo. Tus lienzos y
            tarjetas quedan guardados, solo necesitás volver a entrar con tu
            email y contraseña.
          </p>
          <button
            type="button"
            className="btn-pill btn-pill-muted btn-danger"
            onClick={handleLogout}
            disabled={loggingOut}
            style={{ width: '100%', justifyContent: 'center' }}
          >
            {loggingOut ? 'Saliendo...' : '🚪 Cerrar sesión'}
          </button>
        </div>
      </div>
    </div>
  )
}
