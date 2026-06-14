import { useState, useEffect } from 'react'
import { IconFace, IconReactionApprove, IconReactionHeart, IconReactionCelebrate, IconReactionHighFive } from './icons/index.jsx'

const REACTIONS = [
  { id: 'approve',   Icon: IconReactionApprove,   label: 'Aprobación' },
  { id: 'heart',     Icon: IconReactionHeart,      label: 'Corazón' },
  { id: 'celebrate', Icon: IconReactionCelebrate,  label: 'Festejo' },
  { id: 'highfive',  Icon: IconReactionHighFive,   label: 'Choca cinco' },
]

const MAX_CHARGES  = 3
const COOLDOWN_MS  = 7 * 60 * 1000 // 7 minutos
const STORAGE_KEY  = 'vinki-reactions-state'

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { charges: MAX_CHARGES, cooldownUntil: null }
    return JSON.parse(raw)
  } catch { return { charges: MAX_CHARGES, cooldownUntil: null } }
}

function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

export default function ReactionsBar({ onReact }) {
  const [open, setOpen] = useState(false)
  const [charges, setCharges] = useState(MAX_CHARGES)
  const [cooldownUntil, setCooldownUntil] = useState(null)
  const [timeLeft, setTimeLeft] = useState(null)

  useEffect(() => {
    const s = loadState()
    if (s.cooldownUntil && Date.now() < s.cooldownUntil) {
      setCharges(0); setCooldownUntil(s.cooldownUntil)
    } else {
      setCharges(s.charges ?? MAX_CHARGES); setCooldownUntil(null)
    }
  }, [])

  useEffect(() => {
    if (!cooldownUntil) { setTimeLeft(null); return }
    const tick = () => {
      const left = cooldownUntil - Date.now()
      if (left <= 0) { setCharges(MAX_CHARGES); setCooldownUntil(null); setTimeLeft(null); saveState({ charges: MAX_CHARGES, cooldownUntil: null }) }
      else setTimeLeft(Math.ceil(left / 60000))
    }
    tick()
    const id = setInterval(tick, 10000)
    return () => clearInterval(id)
  }, [cooldownUntil])

  function handleReact(id) {
    if (charges <= 0) return
    onReact(id)
    setOpen(false)
    const newCharges = charges - 1
    let newCooldown = cooldownUntil
    if (newCharges === 0) { newCooldown = Date.now() + COOLDOWN_MS; setCooldownUntil(newCooldown) }
    setCharges(newCharges)
    saveState({ charges: newCharges, cooldownUntil: newCooldown })
  }

  const disabled = charges <= 0

  return (
    <div className="reactions-bar">
      <button type="button" className="reactions-trigger" onClick={() => !disabled && setOpen((o) => !o)}
        disabled={disabled} aria-label="Reacciones" style={{ opacity: disabled ? 0.5 : 1 }}>
        <IconFace size={22} />
      </button>
      {open && !disabled && (
        <div className="reactions-options">
          {REACTIONS.map(({ id, Icon, label }) => (
            <button key={id} type="button" className="reaction-btn" onClick={() => handleReact(id)} aria-label={label}>
              <Icon size={20} />
            </button>
          ))}
        </div>
      )}
      {disabled && timeLeft && (
        <span className="reactions-cooldown">{timeLeft}min</span>
      )}
      {!disabled && charges < MAX_CHARGES && (
        <span className="reactions-cooldown">{charges}/{MAX_CHARGES}</span>
      )}
    </div>
  )
}
