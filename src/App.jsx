import { useSession } from './lib/useSession'
import { useProfile } from './lib/useProfile'
import { MusicPlayerProvider } from './lib/MusicPlayerContext'
import { ToastProvider } from './components/ui/Toast'
import Login from './components/auth/Login'
import Onboarding from './components/auth/Onboarding'
import CanvasPage from './pages/Canvas'

export default function App() {
  const session = useSession()
  const { profile, setProfile, error: profileError } = useProfile(session)

  // session === undefined → still loading auth
  if (session === undefined || (session && profile === undefined)) {
    return <div className="loading-screen"><div className="spinner" /></div>
  }

  // Not logged in
  if (!session) return <Login />

  // Profile fetch failed → don't send an existing user to Onboarding
  // (it would try to insert a duplicate profile). Offer a retry instead.
  if (!profile && profileError) {
    return (
      <div className="page-center">
        <div className="surface-card" style={{ textAlign: 'center' }}>
          <p style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 'var(--text-lg)', marginBottom: 8 }}>
            No pudimos cargar tu perfil
          </p>
          <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)', marginBottom: 20 }}>
            {profileError}
          </p>
          <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>
            Reintentar
          </button>
        </div>
      </div>
    )
  }

  // Logged in but no profile → new user, show onboarding
  if (!profile) return <Onboarding session={session} onComplete={setProfile} />

  // All good → show app
  return (
    <MusicPlayerProvider>
      <ToastProvider>
        <CanvasPage session={session} profile={profile} />
      </ToastProvider>
    </MusicPlayerProvider>
  )
}
