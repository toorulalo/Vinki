export default function WaitingRoomModal({ onCancel }) {
  return (
    <div className="session-modal-backdrop">
      <div className="session-modal">
        <div className="session-modal-icon">🤝</div>
        <h2 className="session-modal-title">Esperando a tu compañero…</h2>
        <p className="session-modal-body">
          Le enviaste una invitación. En cuanto acepte, la sesión comenzará automáticamente.
        </p>
        <div className="session-modal-spinner">
          <div className="spinner" />
        </div>
        <button className="btn btn-ghost" onClick={onCancel}>Cancelar</button>
      </div>
    </div>
  )
}
