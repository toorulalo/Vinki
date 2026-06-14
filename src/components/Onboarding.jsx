import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { IconNote, IconVinki, IconInbox } from './icons/index.jsx'

const SLIDES = [
  { Icon: IconNote,  title: 'Tu lienzo',      text: 'Pegá notas y links en un mapa infinito. Acomodalos como quieras, como en un corcho digital.' },
  { Icon: IconVinki, title: 'Vinki-Vinki',    text: 'Conectá con otra persona en vivo. Cada quien con su lienzo, trabajando juntos en tiempo real.' },
  { Icon: IconInbox, title: 'Vrop It',        text: 'Lo mejor que descubran juntos se guarda en un canal compartido, fácil de revisar después.' },
]

export default function Onboarding({ profile, onCreateCanvas }) {
  const [step, setStep] = useState(0)
  const [name, setName] = useState(profile?.name || '')
  const [canvasName, setCanvasName] = useState('Mi lienzo')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const isSlide    = step < SLIDES.length
  const isNameStep = step === SLIDES.length
  const isDoneStep = step === SLIDES.length + 1

  async function handleSaveName(e) {
    e.preventDefault()
    const clean = name.trim()
    if (!clean) { setError('Escribí cómo querés que te llamen.'); return }
    setBusy(true); setError('')
    const { error: err } = await supabase.from('users').update({ name: clean }).eq('id', profile.id)
    setBusy(false)
    if (err) { setError('No se pudo guardar. Intentá de nuevo.'); return }
    setStep(step + 1)
  }

  async function handleCreateCanvas(e) {
    e.preventDefault()
    setBusy(true); setError('')
    const { error: err } = await onCreateCanvas(canvasName.trim() || 'Mi lienzo')
    setBusy(false)
    if (err) setError(err.message)
  }

  if (isSlide) {
    const { Icon, title, text } = SLIDES[step]
    return (
      <div className="page">
        <div className="paper-card onboarding-card">
          <div className="onboarding-icon-wrap">
            <Icon size={52} style={{ color: 'var(--terracota)' }} />
          </div>
          <h2 className="onboarding-title">{title}</h2>
          <p className="onboarding-text">{text}</p>
          <div className="onboarding-dots">
            {SLIDES.map((_, i) => <span key={i} className={`dot${i === step ? ' active' : ''}`} />)}
          </div>
          <button className="btn-primary" onClick={() => setStep(step + 1)}>
            {step === SLIDES.length - 1 ? 'Empezar' : 'Siguiente'}
          </button>
          {step < SLIDES.length - 1 && (
            <button type="button" className="btn-link onboarding-skip" onClick={() => setStep(SLIDES.length)}>
              Saltar intro
            </button>
          )}
        </div>
      </div>
    )
  }

  if (isNameStep) {
    return (
      <div className="page">
        <form className="paper-card onboarding-card" onSubmit={handleSaveName}>
          <div className="onboarding-icon-wrap">
            <IconNote size={52} style={{ color: 'var(--terracota)' }} />
          </div>
          <h2 className="onboarding-title">¿Cómo te llamás?</h2>
          <p className="onboarding-text">Así te van a ver en Vinki-Vinki y Vrop It.</p>
          <div className="field">
            <input className="field-input" type="text" value={name} placeholder="Tu nombre"
              autoFocus maxLength={30} onChange={(e) => setName(e.target.value)} />
          </div>
          <button className="btn-primary" type="submit" disabled={busy}>
            {busy ? 'Guardando...' : 'Continuar'}
          </button>
          {error && <p className="msg msg-error">{error}</p>}
        </form>
      </div>
    )
  }

  return (
    <div className="page">
      <form className="paper-card onboarding-card" onSubmit={handleCreateCanvas}>
        <div className="onboarding-icon-wrap">
          <IconNote size={52} style={{ color: 'var(--terracota)' }} />
        </div>
        <h2 className="onboarding-title">Creá tu primer lienzo</h2>
        <p className="onboarding-text">Es tu espacio personal. Después podés tener hasta 5.</p>
        <div className="field">
          <input className="field-input" type="text" value={canvasName} placeholder="Mi lienzo"
            autoFocus maxLength={40} onChange={(e) => setCanvasName(e.target.value)} />
        </div>
        <button className="btn-primary" type="submit" disabled={busy}>
          {busy ? 'Creando...' : 'Crear lienzo'}
        </button>
        {error && <p className="msg msg-error">{error}</p>}
      </form>
    </div>
  )
}
