import { useEffect, useRef } from 'react'
import { IconX } from '../icons/index'

/**
 * Animated modal wrapper.
 *
 * Props:
 *   isOpen   {boolean}      — controls visibility
 *   onClose  {() => void}   — called when user dismisses
 *   title    {string}       — shown in header (omit to hide header)
 *   children {ReactNode}    — modal body content
 *   footer   {ReactNode}    — optional footer row (right-aligned)
 */
export default function Modal({ isOpen, onClose, title, children, footer }) {
  const overlayRef = useRef(null)

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return
    function onKey(e) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [isOpen, onClose])

  // Lock body scroll while open
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
        {/* Header — only rendered when a title is provided */}
        {title !== undefined && (
          <div className="modal-header">
            <h2 className="modal-title" id="modal-title">
              {title}
            </h2>
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

        {/* Body */}
        <div className="modal-body">{children}</div>

        {/* Footer */}
        {footer && (
          <div
            style={{
              padding: '0 24px 20px',
              paddingTop: 16,
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 8,
              borderTop: '1px solid var(--border)',
            }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}
