import { useEffect, useRef } from 'react'
import { IconX } from '../icons/index'

export default function Modal({ isOpen, onClose, title, children, footer }) {
  const overlayRef = useRef(null)

  useEffect(() => {
    if (!isOpen) return
    function onKey(e) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [isOpen, onClose])

  useEffect(() => {
    if (!isOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [isOpen])

  if (!isOpen) return null

  function handleOverlayClick(e) {
    if (e.target === overlayRef.current) onClose()
  }

  return (
    <div
      ref={overlayRef}
      className="modal-overlay"
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? 'modal-title' : undefined}
    >
      <div className="modal">
        {title !== undefined && (
          <div className="modal-header">
            <h2 className="modal-title" id="modal-title">{title}</h2>
            <button
              type="button"
              className="btn btn-icon"
              onClick={onClose}
              aria-label="Cerrar"
            >
              <IconX size={18} />
            </button>
          </div>
        )}
        <div className="modal-body">{children}</div>
        {footer && (
          <div style={{ padding: '0 24px 20px', paddingTop: 16, display: 'flex', justifyContent: 'flex-end', gap: 8, borderTop: '1px solid var(--border)' }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}
