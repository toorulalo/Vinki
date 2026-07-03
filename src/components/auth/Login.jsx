import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabaseClient'

export default function Login({ onLogin }) {
  const [mode, setMode] = useState('login') // 'login' | 'signup'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [signedUp, setSignedUp] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 30)
    return () => clearTimeout(t)
  }, [])

  function switchMode(m) {
    setMode(m)
    setError('')
    setSignedUp(false)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)

    if (mode === 'login') {
      const { data, error: err } = await supabase.auth.signInWithPassword({ email, password })
      setLoading(false)
      if (err) {
        setError(
          err.message.includes('Invalid login credentials')
            ? 'Correo o contraseña incorrectos.'
            : err.message
        )
        return
      }
      if (data.session) onLogin?.(data.session)
    } else {
      const { error: err } = await supabase.auth.signUp({ email, password })
      setLoading(false)
      if (err) {
        setError(
          err.message.includes('already registered')
            ? 'Este correo ya tiene una cuenta. Inicia sesión.'
            : err.message
        )
        return
      }
      setSignedUp(true)
    }
  }

  return (
    <div className="page-center">
      <div
        className="surface-card"
        style={{
          opacity: mounted ? 1 : 0,
          transform: mounted ? 'translateY(0) scale(1)' : 'translateY(24px) scale(0.98)',
          transition:
            'opacity var(--duration-slow) var(--ease-out), transform var(--duration-slow) var(--ease-out)',
        }}
      >
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 6 }}>
          <div
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'var(--text-4xl)',
              fontWeight: 700,
              color: 'var(--color-primary)',
              letterSpacing: '-0.03em',
              lineHeight: 1,
            }}
          >
            Vinki
          </div>
        </div>

        {/* Tagline */}
        <p
          style={{
            textAlign: 'center',
            color: 'var(--text-secondary)',
            fontSize: 'var(--text-sm)',
            marginBottom: 28,
            lineHeight: 1.55,
          }}
        >
          Tu sala de estudio, sin sentirte solo.
        </p>

        {signedUp ? (
          /* Post-signup confirmation */
          <div
            style={{
              textAlign: 'center',
              padding: '16px 0 8px',
              animation: 'fade-in var(--duration-normal) var(--ease-out)',
            }}
          >
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: '50%',
                background: 'var(--color-primary-soft)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px',
              }}
            >
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--color-primary)"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <p
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 700,
                fontSize: 'var(--text-lg)',
                color: 'var(--text-primary)',
                marginBottom: 8,
              }}
            >
              Casi listo
            </p>
            <p
              style={{
                color: 'var(--text-secondary)',
                fontSize: 'var(--text-sm)',
                lineHeight: 1.6,
                marginBottom: 24,
              }}
            >
              Revisa tu correo para confirmar tu cuenta.
            </p>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => switchMode('login')}
            >
              Volver al inicio de sesión
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Email */}
            <div className="field">
              <label className="field-label" htmlFor="login-email">
                Correo electrónico
              </label>
              <input
                id="login-email"
                className="field-input"
                type="email"
                placeholder="tu@correo.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
                autoFocus
              />
            </div>

            {/* Password */}
            <div className="field">
              <label className="field-label" htmlFor="login-password">
                Contraseña
              </label>
              <input
                id="login-password"
                className="field-input"
                type="password"
                placeholder={mode === 'signup' ? 'Mínimo 6 caracteres' : '••••••••'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                minLength={6}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              />
            </div>

            {/* Error */}
            {error && (
              <p
                role="alert"
                style={{
                  fontSize: 'var(--text-sm)',
                  color: 'var(--color-danger)',
                  animation: 'fade-in var(--duration-fast) ease',
                  lineHeight: 1.4,
                }}
              >
                {error}
              </p>
            )}

            {/* Submit */}
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
              ) : mode === 'login' ? 'Entrar' : 'Crear cuenta'}
            </button>

            {/* Divider */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                color: 'var(--text-muted)',
                fontSize: 'var(--text-sm)',
              }}
            >
              <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
              o
              <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
            </div>

            {/* Mode toggle */}
            {mode === 'login' ? (
              <p
                style={{
                  textAlign: 'center',
                  fontSize: 'var(--text-sm)',
                  color: 'var(--text-secondary)',
                }}
              >
                ¿No tienes cuenta?{' '}
                <ModeLink onClick={() => switchMode('signup')}>Crear cuenta</ModeLink>
              </p>
            ) : (
              <p
                style={{
                  textAlign: 'center',
                  fontSize: 'var(--text-sm)',
                  color: 'var(--text-secondary)',
                }}
              >
                ¿Ya tienes cuenta?{' '}
                <ModeLink onClick={() => switchMode('login')}>Entrar</ModeLink>
              </p>
            )}
          </form>
        )}
      </div>
    </div>
  )
}

function ModeLink({ onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        background: 'none',
        border: 'none',
        color: 'var(--color-primary)',
        fontFamily: 'var(--font-body)',
        fontSize: 'var(--text-sm)',
        fontWeight: 600,
        cursor: 'pointer',
        padding: 0,
        textDecoration: 'underline',
        textUnderlineOffset: '3px',
      }}
    >
      {children}
    </button>
  )
}
