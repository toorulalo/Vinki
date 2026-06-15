// Props: { partner, partnerFocusTitle }
// Shows partner focus in the session topbar center area
export default function PresenceBar({ partner, partnerFocusTitle }) {
  const name = partner?.profile?.display_name || partner?.display_name || 'tu compañero'

  if (!partner) {
    return (
      <div className="partner-focus">
        <span>Esperando compañero...</span>
      </div>
    )
  }

  return (
    <div className="partner-focus">
      {partnerFocusTitle ? (
        <>
          <span>📖</span>
          <span className="partner-focus-name">{name}</span>
          <span>ve:</span>
          <span
            style={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              maxWidth: 120,
            }}
          >
            {partnerFocusTitle}
          </span>
        </>
      ) : (
        <>
          <span>📚</span>
          <span className="partner-focus-name">{name}</span>
          <span>está estudiando</span>
        </>
      )}
    </div>
  )
}
