import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'

const SLIDES = [
  {
    icon: '🗺️',
    title: 'Bienvenido a VINKI',
    text: 'Tu lienzo de ideas: pegá notas, links e imágenes y acomodalas como quieras, como en un corcho.'
  },
  {
    icon: '🤝',
    title: 'VINKI-VINKI',
    text: 'Conectá con otra persona en vivo: cada quien con su lienzo, trabajando juntos en tiempo real.'
  },
  {
    icon: '📬',
    title: 'Vrop It',
    text: 'Lo mejor que descubran juntos se guarda en un hilo compartido, como un chat de hallazgos.'
  }
]

export default function Onboarding({ profile, onCreateCanvas }) {
  const [step, setStep] = useState(0)
  const [name, setName] = useState(profile?.name || '')
  const [canvasName, setCanvasName] = useState('Mi lienzo')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const isSlide = step < SLIDES.length
  const isNameStep = step === SLIDES.length
  const isCanvasStep = step === SLIDES.length + 1

  async function handleSaveName(e) {
    e.preventDefault()
    const clean = name.trim()
    if (!clean) {
      setError('Escribí cómo querés que te llamen.')
      return
    }
    setBusy(true)
    setError('')
    const { error: err } = await supabase
      .from('users')
      .update({ name: clean })
      .eq('id', profile.id)
    setBusy(false)
    if (err) {
      setError('No se pudo guardar. Probá de nuevo.')
      return
    }
    setStep(step + 1)
  }

  async function handleCreateCanvas(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    const { error: err } = await onCreateCanvas(
      canvasName.trim() || 'Mi lienzo'
    )
    setBusy(false)
    if (err) setError(err.message)
  }

  return (
    <div className="page onboarding">
      <div className="pinned-card onboarding-card" key={step}>
        {isSlide && (
          <>
            <div className="onboarding-icon">{SLIDES[step].icon}</div>
            <h2 className="onboarding-title">{SLIDES[step].title}</h2>
            <p className="onboarding-text">{SLIDES[step].text}</p>

            <div className="onboarding-dots">
              {SLIDES.map((_, i) => (
                <span
                  key={i}
                  className={`dot${i === step ? ' active' : ''}`}
                />
              ))}
            </div>

            <button
              className="btn-primary"
              onClick={() => setStep(step + 1)}
            >
              {step === SLIDES.length - 1 ? 'Empezar' : 'Siguiente'}
            </button>

            {step < SLIDES.length - 1 && (
              <button
                type="button"
                className="btn-link onboarding-skip"
                onClick={() => setStep(SLIDES.length)}
              >
                Saltar intro
              </button>
            )}
          </>
        )}

        {isNameStep && (
          <form onSubmit={handleSaveName}>
            <div className="onboarding-icon">👋</div>
            <h2 className="onboarding-title">¿Cómo te llamás?</h2>
            <p className="onboarding-text">
              Así te van a ver tus compañeros en VINKI-VINKI y Vrop It.
            </p>
            <div className="field">
              <input
                type="text"
                value={name}
                placeholder="Tu nombre"
                autoFocus
                maxLength={30}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <button className="btn-primary" type="submit" disabled={busy}>
              {busy ? 'Guardando...' : 'Continuar'}
            </button>
            {error && <p className="message error">{error}</p>}
          </form>
        )}

        {isCanvasStep && (
          <form onSubmit={handleCreateCanvas}>
            <div className="onboarding-icon">🎨</div>
            <h2 className="onboarding-title">Creá tu primer lienzo</h2>
            <p className="onboarding-text">
              Es tu espacio personal. Después podés tener hasta 5.
            </p>
            <div className="field">
              <input
                type="text"
                value={canvasName}
                placeholder="Mi lienzo"
                autoFocus
                maxLength={40}
                onChange={(e) => setCanvasName(e.target.value)}
              />
            </div>
            <button className="btn-primary" type="submit" disabled={busy}>
              {busy ? 'Creando...' : 'Crear lienzo'}
            </button>
            {error && <p className="message error">{error}</p>}
          </form>
        )}
      </div>
    </div>
  )
}
