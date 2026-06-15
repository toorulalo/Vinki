import { useSession } from './lib/useSession'
import { useProfile } from './lib/useProfile'
import { MusicPlayerProvider } from './lib/MusicPlayerContext'
import { ToastProvider } from './components/ui/Toast'
import Login from './components/auth/Login'
import Onboarding from './components/auth/Onboarding'
import CanvasPage from './pages/Canvas'

export default function App() {
  const session = useSession()
  const { profile, setProfile } = useProfile(session)

  // session === undefined → still loading auth
  if (session === undefined || (session && profile === undefined)) {
    return <div className="loading-screen"><div className="spinner" /></div>
  }

  // Not logged in
  if (!session) return <Login />

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
