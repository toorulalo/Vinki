import { useSession } from './lib/useSession'
import { MusicPlayerProvider } from './lib/MusicPlayerContext'
import GlobalMusicPlayer from './components/GlobalMusicPlayer'
import Login from './pages/Login'
import Canvas from './pages/Canvas'

export default function App() {
  const session = useSession()

  if (session === undefined) {
    return (
      <div className="page">
        <p className="canvas-empty">Cargando...</p>
      </div>
    )
  }

  return (
    <MusicPlayerProvider>
      {session ? <Canvas session={session} /> : <Login />}
      {session && <GlobalMusicPlayer />}
    </MusicPlayerProvider>
  )
}
