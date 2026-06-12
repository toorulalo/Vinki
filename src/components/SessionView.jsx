import { useState } from 'react'
import CanvasBoard from './CanvasBoard'
import SendToVropDialog from './SendToVropDialog'

export default function SessionView({ session, profile, vrop, onClose }) {
  const [vropCard, setVropCard] = useState(null)

  const partners = session.participants.filter(
    (p) => p.user_id !== profile.id
  )

  const sendProps =
    partners.length > 0 ? { onSendToVrop: setVropCard } : {}

  return (
    <div className="session-view">
      {session.mode === 'proyecto' ? (
        <>
          <div className="session-bar">
            <span className="session-mode-badge">Proyecto compartido</span>
            <button type="button" className="btn-link" onClick={onClose}>
              Volver a mi lienzo
            </button>
          </div>
          <CanvasBoard
            canvasId={session.shared_canvas_id}
            emptyLabel="Este proyecto está vacío. Agreguen la primera tarjeta."
            {...sendProps}
          />
        </>
      ) : (
        <>
          <div className="session-bar">
            <span className="session-mode-badge">VINKI-VINKI en vivo</span>
            <button type="button" className="btn-link" onClick={onClose}>
              Volver a mi lienzo
            </button>
          </div>

          <div className="session-grid">
            <div className="session-pane">
              <h4 className="session-pane-title">Tu lienzo</h4>
              <CanvasBoard
                canvasId={session.my_individual_canvas_id}
                emptyLabel="Agregá algo a tu lienzo para compartirlo."
                {...sendProps}
              />
            </div>

            {partners.length === 0 && (
              <div className="session-pane session-pane-empty">
                <p className="canvas-empty">
                  Compartí el código de esta sesión para que alguien se una.
                </p>
              </div>
            )}

            {partners.map((p) => (
              <div className="session-pane" key={p.user_id}>
                <h4 className="session-pane-title">
                  Lienzo de {p.users?.name || 'tu compañero/a'}
                </h4>
                <CanvasBoard
                  canvasId={p.individual_canvas_id}
                  emptyLabel="Todavía no agregó nada."
                  {...sendProps}
                />
              </div>
            ))}
          </div>
        </>
      )}

      {vropCard && (
        <SendToVropDialog
          card={vropCard}
          partners={partners}
          profile={profile}
          getOrCreateThread={vrop.getOrCreateThread}
          onClose={() => setVropCard(null)}
        />
      )}
    </div>
  )
}
