import { useState } from 'react'
import { supabase } from '../../lib/supabaseClient'

const AVATAR_COLORS = ['#2E7D52', '#E07240', '#3D8FA6', '#F0B429', '#8B5CF6', '#EC4899']

const USERNAME_RE = /^[a-z0-9_]+$/

export default function Onboarding({ session, onComplete }) {
  const [step, setStep] = useState(0)
  const [animKey, setAnimKey] = useState(0)

  // Step 1 fields
  const [username, setUsername] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [avatarColor, setAvatarColor] = useState(AVATAR_COLORS[0])
  const [usernameError, setUsernameError] = useState('')

  // Step 2 fields
  const [canvasTitle, setCanvasTitle] = useState('')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function goStep(n) {
    setStep(n)
    setAnimKey(k => k + 1)
    setError('')
  }

  function validateUsername(val) {
    if (val.length < 3) return 'El usuario debe tener al menos 3 caracteres.'
    if (!USERNAME_RE.test(val)) return 'Solo letras, números y guiones bajos.'
    return ''
  }

  function handleUsernameChange(e) {
    const val = e.target.value.toLowerCase().replace(/\s/g, '')
    setUsername(val)
    if (usernameError) setUsernameError(validateUsername(val))
  }

  function handleStep1Submit(e) {
    e.preventDefault()
    const uErr = validateUsername(username)
    if (uErr) { setUsernameError(uErr); return }
    if (!displayName.trim()) { setError('Escribe tu nombre.'); return }
    goStep(2)
  }

  async function handleStep2Submit(e) {
    e.preventDefault()
    const title = canvasTitle.trim() || 'Mi lienzo de estudio'
    setLoading(true)
    setError('')

    try {
      // 1. Create profile — reuse the row if a previous attempt already created
      // it (e.g. the canvas insert failed and the user is retrying).
      let profileData
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('*')
        .eq('auth_id', session.user.id)
        .maybeSingle()

      if (existingProfile) {
        profileData = existingProfile
      } else {
        const { data: inserted, error: profileErr } = await supabase
          .from('profiles')
          .insert({
            auth_id: session.user.id,
            username: username.trim(),
            display_name: displayName.trim(),
            avatar_color: avatarColor,
          })
          .select()
          .single()

        if (profileErr) {
          if (profileErr.message?.includes('unique') || profileErr.code === '23505') {
            setLoading(false)
            goStep(1)
            // After goStep so its setError('') doesn't erase the message.
            setError('Ese nombre de usuario ya está en uso. Elige otro.')
            return
          }
          throw profileErr
        }
        profileData = inserted
      }

      // 2. Create first canvas
      const { error: canvasErr } = await supabase
        .from('canvases')
        .insert({
          owner_id: profileData.id,
          title,
          is_active: true,
        })

      if (canvasErr) throw canvasErr

      onComplete(profileData)
    } catch (err) {
      setError(err.message || 'Algo salió mal. Intenta de nuevo.')
      setLoading(false)
    }
  }

  return (
    <div className="page-center">
      <div className="surface-card">
        {/* Progress dots */}
        <div className="onboarding-dots">
          {[0, 1, 2].map(i => (
            <div key={i} className={`onboarding-dot${step === i ? ' active' : ''}`} />
          ))}
        </div>

        {/* Step content — keyed so the animation replays on step change */}
        <div key={animKey} className="onboarding-step">
          {step === 0 && <StepWelcome onNext={() => goStep(1)} />}

          {step === 1 && (
            <StepProfile
              username={username}
              displayName={displayName}
              avatarColor={avatarColor}
              usernameError={usernameError}
              serverError={error}
              onUsernameChange={handleUsernameChange}
              onDisplayNameChange={e => { setDisplayName(e.target.value); setError('') }}
              onColorSelect={setAvatarColor}
              onSubmit={handleStep1Submit}
            />
          )}

          {step === 2 && (
            <StepCanvas
              canvasTitle={canvasTitle}
              error={error}
              loading={loading}
              onTitleChange={e => setCanvasTitle(e.target.value)}
              onSubmit={handleStep2Submit}
            />
          )}
        </div>
      </div>
    </div>
  )
}

/* ─── Step 0: Welcome ─── */
function StepWelcome({ onNext }) {
  return (
    <>
      <div className="onboarding-logo">Vinki</div>
      <p className="onboarding-tagline">
        Estudias en tu mundo, ella en el suyo.<br />
        Los dos juntos.
      </p>
      <button type="button" className="btn btn-primary btn-full" onClick={onNext}>
        Empezar
      </button>
    </>
  )
}

/* ─── Step 1: Profile ─── */
function StepProfile({
  username,
  displayName,
  avatarColor,
  usernameError,
  serverError,
  onUsernameChange,
  onDisplayNameChange,
  onColorSelect,
  onSubmit,
}) {
  return (
    <form onSubmit={onSubmit} style={{ textAlign: 'left' }}>
      <h2
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'var(--text-2xl)',
          fontWeight: 700,
          color: 'var(--text-primary)',
          marginBottom: 4,
          textAlign: 'center',
        }}
      >
        Crea tu perfil
      </h2>
      <p
        style={{
          color: 'var(--text-secondary)',
          fontSize: 'var(--text-sm)',
          textAlign: 'center',
          marginBottom: 24,
          lineHeight: 1.5,
        }}
      >
        Así te verán quienes estudien contigo.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* Username */}
        <div className="field">
          <label className="field-label" htmlFor="ob-username">
            Nombre de usuario
          </label>
          <div style={{ position: 'relative' }}>
            <span
              aria-hidden="true"
              style={{
                position: 'absolute',
                left: 13,
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-muted)',
                fontSize: 'var(--text-base)',
                pointerEvents: 'none',
                fontFamily: 'var(--font-body)',
              }}
            >
              @
            </span>
            <input
              id="ob-username"
              className="field-input"
              type="text"
              placeholder="usuario"
              value={username}
              onChange={onUsernameChange}
              required
              minLength={3}
              maxLength={30}
              style={{ paddingLeft: 28 }}
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
            />
          </div>
          {usernameError && (
            <p
              role="alert"
              style={{ fontSize: 'var(--text-xs)', color: 'var(--color-danger)', marginTop: 2 }}
            >
              {usernameError}
            </p>
          )}
        </div>

        {/* Display name */}
        <div className="field">
          <label className="field-label" htmlFor="ob-displayname">
            Nombre
          </label>
          <input
            id="ob-displayname"
            className="field-input"
            type="text"
            placeholder="¿Cómo te llamas?"
            value={displayName}
            onChange={onDisplayNameChange}
            required
            maxLength={40}
            autoComplete="given-name"
          />
        </div>

        {/* Color picker */}
        <div className="field">
          <label className="field-label">Color de avatar</label>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 4 }}>
            {AVATAR_COLORS.map(c => (
              <button
                key={c}
                type="button"
                onClick={() => onColorSelect(c)}
                aria-label={`Seleccionar color ${c}`}
                aria-pressed={avatarColor === c}
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: '50%',
                  background: c,
                  border: avatarColor === c ? '3px solid var(--text-primary)' : '3px solid transparent',
                  outline: avatarColor === c ? '2px solid var(--bg-surface)' : 'none',
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

        {serverError && (
          <p
            role="alert"
            style={{ fontSize: 'var(--text-sm)', color: 'var(--color-danger)' }}
          >
            {serverError}
          </p>
        )}

        <button type="submit" className="btn btn-primary btn-full" style={{ marginTop: 4 }}>
          Continuar
        </button>
      </div>
    </form>
  )
}

/* ─── Step 2: First canvas ─── */
function StepCanvas({ canvasTitle, error, loading, onTitleChange, onSubmit }) {
  return (
    <form onSubmit={onSubmit} style={{ textAlign: 'left' }}>
      <h2
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'var(--text-2xl)',
          fontWeight: 700,
          color: 'var(--text-primary)',
          marginBottom: 4,
          textAlign: 'center',
        }}
      >
        Nombra tu primer lienzo
      </h2>
      <p
        style={{
          color: 'var(--text-secondary)',
          fontSize: 'var(--text-sm)',
          textAlign: 'center',
          marginBottom: 24,
          lineHeight: 1.5,
        }}
      >
        Este será tu espacio de estudio principal.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="field">
          <label className="field-label" htmlFor="ob-canvas">
            Título del lienzo
          </label>
          <input
            id="ob-canvas"
            className="field-input"
            type="text"
            placeholder="Mi lienzo de estudio"
            value={canvasTitle}
            onChange={onTitleChange}
            maxLength={60}
            autoFocus
          />
        </div>

        {error && (
          <p
            role="alert"
            style={{ fontSize: 'var(--text-sm)', color: 'var(--color-danger)' }}
          >
            {error}
          </p>
        )}

        <button
          type="submit"
          className="btn btn-primary btn-full"
          disabled={loading}
          style={{ marginTop: 4 }}
        >
          {loading ? (
            <span
              style={{
                width: 18,
                height: 18,
                border: '2px solid rgba(255,255,255,0.35)',
                borderTopColor: '#fff',
                borderRadius: '50%',
                display: 'inline-block',
                animation: 'spin 0.75s linear infinite',
              }}
            />
          ) : (
            'Empezar a estudiar'
          )}
        </button>
      </div>
    </form>
  )
}
