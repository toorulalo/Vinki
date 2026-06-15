export default function SessionInviteModal({ invite, onAccept, onDecline }) {
  return (
    <div className="session-modal-backdrop">
      <div className="session-modal">
        <div className="session-modal-icon">✨</div>
        <h2 className="session-modal-title">¡Te invitan a estudiar!</h2>
        <p className="session-modal-body">
          <strong>{invite.hostName}</strong> te está invitando a una sesión Vinki-Vinki.
        </p>
        <div className="session-modal-actions">
          <button className="btn btn-primary" onClick={onAccept}>Entrar</button>
          <button className="btn btn-ghost" onClick={onDecline}>Ahora no</button>
        </div>
      </div>
    </div>
  )
}
