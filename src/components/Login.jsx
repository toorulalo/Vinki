import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'

export default function Login() {
  const [mode, setMode] = useState('signin') // 'signin' | 'signup'
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')

  const isSignUp = mode === 'signup'

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setInfo('')
    setLoading(true)

    try {
      if (isSignUp) {
        const { data, error: signUpError } = await supabase.auth.signUp({ email, password })
        if (signUpError) throw signUpError

        if (data.session) {
          const { error: profileError } = await supabase.from('users').insert({
            auth_id: data.user.id,
            name: name.trim() || email.split('@')[0]
          })
          if (profileError) throw profileError
        } else {
          setInfo('Te enviamos un correo para confirmar tu cuenta.')
        }
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
        if (signInError) throw signInError
      }
    } catch (err) {
      setError(err.message || 'Algo salió mal. Intentá de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  function switchMode() {
    setMode(isSignUp ? 'signin' : 'signup')
    setError('')
    setInfo('')
  }

  return (
    <div className="page">
      <form className="paper-card" onSubmit={handleSubmit}>

        <div className="brand-mark">
          <div className="brand-name">VINKI</div>
          <p className="brand-tagline">Tu lienzo de ideas y links</p>
        </div>

        {isSignUp && (
          <div className="field">
            <label className="field-label" htmlFor="login-name">Tu nombre</label>
            <input
              id="login-name"
              className="field-input"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="¿Cómo te llamás?"
              autoComplete="name"
            />
          </div>
        )}

        <div className="field">
          <label className="field-label" htmlFor="login-email">Correo</label>
          <input
            id="login-email"
            className="field-input"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="tu@correo.com"
            autoComplete="email"
          />
        </div>

        <div className="field">
          <label className="field-label" htmlFor="login-password">Contraseña</label>
          <input
            id="login-password"
            className="field-input"
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Mínimo 6 caracteres"
            autoComplete={isSignUp ? 'new-password' : 'current-password'}
          />
        </div>

        <button className="btn-primary" type="submit" disabled={loading}>
          {loading ? 'Un momento...' : isSignUp ? 'Crear cuenta' : 'Entrar'}
        </button>

        {error && <p className="msg msg-error">{error}</p>}
        {info  && <p className="msg msg-success">{info}</p>}

        <p className="form-footer">
          {isSignUp ? '¿Ya tenés cuenta? ' : '¿Todavía no tenés cuenta? '}
          <button type="button" className="btn-link" onClick={switchMode}>
            {isSignUp ? 'Entrar' : 'Crear una'}
          </button>
        </p>
      </form>
    </div>
  )
}
