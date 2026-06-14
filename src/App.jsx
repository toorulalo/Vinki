import { useSession } from './lib/useSession'
import Login from './components/Login'
import Canvas from './pages/Canvas'

export default function App() {
  const session = useSession()

  // undefined = auth todavía cargando
  if (session === undefined) {
    return (
      <div className="page">
        <p className="text-muted">Cargando...</p>
      </div>
    )
  }

  return session ? <Canvas session={session} /> : <Login />
}
