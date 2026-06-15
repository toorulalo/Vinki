import { useState, useRef } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { useTheme } from '../../contexts/ThemeContext'
import Avatar from './Avatar'
import { IconX } from '../icons/index'

const AVATAR_COLORS = ['#2E7D52', '#E07240', '#3D8FA6', '#F0B429', '#8B5CF6', '#EC4899']

const APP_VERSION = 'v2.0'

/**
 * Settings panel that slides in from the right.
 *
 * Props:
 *   profile         {object}   — user profile ({ id, display_name, username, avatar_color })
 *   onClose         {() => void}
 *   onProfileUpdate {(updated) => void}
 */
export default function SettingsPanel({ profile, onClose, onProfileUpdate }) {
  const { theme, toggleTheme } = useTheme()

  // Profile section state
  const [displayName, setDisplayName] = useState(profile.display_name || '')
  const [avatarColor, setAvatarColor] = useState(profile.avatar_color || AVATAR_COLORS[0])
  const [savingName, setSavingName] = useState(false)
  const [savingColor, setSavingColor] = useState(false)

  // Logout section state
  const [logoutStep, setLogoutStep] = useState('idle') // 'idle' | 'confirm' | 'loading'

  // Ref for display name input to detect blur
  const nameInputRef = useRef(null)

  /* ── Save display name on blur ── */
  async function handleNameBlur() {
    const trimmed = displayName.trim()
    if (!trimmed || trimmed === profile.display_name) return
    setSavingName(true)
    const { data, error } = await supabase
      .from('profiles')
      .update({ display_name: trimmed })
      .eq('id', profile.id)
      .select()
      .single()
    setSavingName(false)
    if (!error && data) onProfileUpdate?.(data)
  }

  /* ── Save avatar color ── */
  async function handleColorSelect(c) {
    if (c === avatarColor) return
    setAvatarColor(c)
    setSavingColor(true)
    const { data, error } = await supabase
      .from('profiles')
      .update({ avatar_color: c })
      .eq('id', profile.id)
      .select()
      .single()
    setSavingColor(false)
    if (!error && data) onProfileUpdate?.(data)
  }

  /* ── Logout ── */
  async function handleLogoutConfirm() {
    setLogoutStep('loading')
    await supabase.auth.signOut()
    // After sign-out the auth listener in App will redirect automatically.
  }

  const isDark = theme === 'dark'

  return (
    <>
      {/* Backdrop */}
      <div
        className="overlay-backdrop"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <aside
        className="settings-panel"
        role="complementary"
        aria-label="Ajustes"
      >
        {/* Header */}
        <div className="settings-header">
          <h2 className="settings-title">Ajustes</h2>
          <button
            type="button"
            className="btn btn-icon"
            onClick={onClose}
            aria-label="Cerrar ajustes"
          >
            <IconX size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="settings-body">

          {/* ── Tu perfil ── */}
          <section className="settings-section" aria-labelledby="settings-profile-label">
            <p className="settings-section-label" id="settings-profile-label">Tu perfil</p>

            {/* Avatar preview */}
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 4 }}>
              <Avatar
                displayName={displayName || profile.display_name}
                color={avatarColor}
                size="xl"
              />
            </div>

            {/* Display name */}
            <div className="field">
              <label className="field-label" htmlFor="settings-displayname">
                Nombre
                {savingName && (
                  <span
                    style={{
                      marginLeft: 8,
                      fontSize: 'var(--text-xs)',
                      color: 'var(--text-muted)',
                    }}
                  >
                    Guardando...
                  </span>
                )}
              </label>
              <input
                id="settings-displayname"
                ref={nameInputRef}
                className="field-input"
                type="text"
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                onBlur={handleNameBlur}
                maxLength={40}
                placeholder="Tu nombre"
                autoComplete="off"
              />
            </div>

            {/* Username (read-only) */}
            <div className="field">
              <label className="field-label" htmlFor="settings-username">
                Usuario
              </label>
              <input
                id="settings-username"
                className="field-input"
                type="text"
                value={`@${profile.username || ''}`}
                readOnly
                style={{
                  color: 'var(--text-muted)',
                  cursor: 'default',
                }}
              />
            </div>

            {/* Avatar color picker */}
            <div className="field">
              <label className="field-label">
                Color de avatar
                {savingColor && (
                  <span
                    style={{
                      marginLeft: 8,
                      fontSize: 'var(--text-xs)',
                      color: 'var(--text-muted)',
                    }}
                  >
                    Guardando...
                  </span>
                )}
              </label>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 4 }}>
                {AVATAR_COLORS.map(c => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => handleColorSelect(c)}
                    aria-label={`Seleccionar color ${c}`}
                    aria-pressed={avatarColor === c}
                    style={{
                      width: 30,
                      height: 30,
                      borderRadius: '50%',
                      background: c,
                      border: avatarColor === c
                        ? '3px solid var(--text-primary)'
                        : '3px solid transparent',
                      outline: avatarColor === c ? '2px solid var(--bg-surface-2)' : 'none',
                      outlineOffset: '-5px',
                      cursor: 'pointer',
                      padding: 0,
                      transform: avatarColor === c ? 'scale(1.18)' : 'scale(1)',
                      transition:
                        'transform var(--duration-fast) var(--ease-spring), border-color var(--duration-fast) ease',
                    }}
                  />
                ))}
              </div>
            </div>
          </section>

          {/* ── Apariencia ── */}
          <section className="settings-section" aria-labelledby="settings-appearance-label">
            <p className="settings-section-label" id="settings-appearance-label">Apariencia</p>

            <div className="settings-row">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {/* Sun / Moon icon */}
                {isDark ? (
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                  </svg>
                ) : (
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    <circle cx="12" cy="12" r="5" />
                    <line x1="12" y1="1" x2="12" y2="3" />
                    <line x1="12" y1="21" x2="12" y2="23" />
                    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                    <line x1="1" y1="12" x2="3" y2="12" />
                    <line x1="21" y1="12" x2="23" y2="12" />
                    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                  </svg>
                )}
                <span className="settings-row-label">Modo oscuro</span>
              </div>
              <label className="toggle" aria-label="Activar modo oscuro">
                <input
                  type="checkbox"
                  checked={isDark}
                  onChange={toggleTheme}
                />
                <span className="toggle-slider" />
              </label>
            </div>
          </section>

          {/* ── Acerca de Vinki ── */}
          <section className="settings-section" aria-labelledby="settings-about-label">
            <p className="settings-section-label" id="settings-about-label">Acerca de Vinki</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontWeight: 700,
                    fontSize: 'var(--text-base)',
                    color: 'var(--color-primary)',
                  }}
                >
                  Vinki
                </span>
                <span
                  className="badge badge-primary"
                >
                  {APP_VERSION}
                </span>
              </div>
              <p
                style={{
                  fontSize: 'var(--text-xs)',
                  color: 'var(--text-muted)',
                  lineHeight: 1.55,
                }}
              >
                Tu sala de estudio compartida. Estudia solo o con alguien, sin perder el ritmo.
              </p>
            </div>
          </section>

          {/* ── Cuenta ── */}
          <section className="settings-section" aria-labelledby="settings-account-label">
            <p className="settings-section-label" id="settings-account-label">Cuenta</p>

            {logoutStep === 'idle' && (
              <button
                type="button"
                className="btn btn-danger btn-full"
                onClick={() => setLogoutStep('confirm')}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
                Cerrar sesión
              </button>
            )}

            {logoutStep === 'confirm' && (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                  animation: 'fade-in var(--duration-fast) ease',
                }}
              >
                <p
                  style={{
                    fontSize: 'var(--text-sm)',
                    color: 'var(--text-secondary)',
                    lineHeight: 1.5,
                  }}
                >
                  ¿Seguro? Esta acción te cerrará sesión.
                </p>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    style={{ flex: 1 }}
                    onClick={() => setLogoutStep('idle')}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger btn-sm"
                    style={{ flex: 1 }}
                    onClick={handleLogoutConfirm}
                  >
                    Sí, salir
                  </button>
                </div>
              </div>
            )}

            {logoutStep === 'loading' && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 10,
                  padding: '12px 0',
                }}
              >
                <span
                  style={{
                    width: 18,
                    height: 18,
                    border: '2px solid var(--border)',
                    borderTopColor: 'var(--color-danger)',
                    borderRadius: '50%',
                    display: 'inline-block',
                    animation: 'spin 0.75s linear infinite',
                  }}
                />
                <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
                  Cerrando sesión...
                </span>
              </div>
            )}
          </section>

        </div>
      </aside>
    </>
  )
}
