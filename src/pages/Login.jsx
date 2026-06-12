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
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password
        })
        if (signUpError) throw signUpError

        // Si ya hay sesión (confirmación de email desactivada), creamos el
        // perfil en la tabla `users`. Si no, se puede crear en el primer
        // login una vez confirmado el email.
        if (data.session) {
          const { error: profileError } = await supabase.from('users').insert({
            auth_id: data.user.id,
            name: name || email.split('@')[0]
          })
          if (profileError) throw profileError
        } else {
          setInfo('Te enviamos un email para confirmar tu cuenta.')
        }
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password
        })
        if (signInError) throw signInError
      }
    } catch (err) {
      setError(err.message || 'Algo salió mal. Probá de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page">
      <form className="pinned-card" onSubmit={handleSubmit}>
        <div className="brand">
          <h1 className="brand-title">VINKI</h1>
          <p className="brand-subtitle">Tu lienzo de ideas, links y notas</p>
        </div>

        {isSignUp && (
          <div className="field">
            <label htmlFor="name">Tu nombre</label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="¿Cómo te llamás?"
              autoComplete="name"
            />
          </div>
        )}

        <div className="field">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="tu@email.com"
            autoComplete="email"
          />
        </div>

        <div className="field">
          <label htmlFor="password">Contraseña</label>
          <input
            id="password"
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
          {loading
            ? 'Un momento...'
            : isSignUp
            ? 'Crear cuenta'
            : 'Entrar'}
        </button>

        {error && <p className="message error">{error}</p>}
        {info && <p className="message success">{info}</p>}

        <p className="form-footer">
          {isSignUp ? '¿Ya tenés cuenta? ' : '¿Todavía no tenés cuenta? '}
          <button
            type="button"
            className="btn-link"
            onClick={() => {
              setMode(isSignUp ? 'signin' : 'signup')
              setError('')
              setInfo('')
            }}
          >
            {isSignUp ? 'Entrar' : 'Crear una'}
          </button>
        </p>
      </form>
    </div>
  )
}
