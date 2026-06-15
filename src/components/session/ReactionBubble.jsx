import { useEffect, useRef } from 'react'

// Props: { emoji, senderName, onDone }
// Shows an animated emoji bubble that rises and fades, then calls onDone()
export default function ReactionBubble({ emoji, senderName, onDone }) {
  const posRef = useRef({
    x: 30 + Math.random() * 40,  // 30–70% from left
    y: 30 + Math.random() * 30,  // 30–60% from top
  })

  useEffect(() => {
    const timer = setTimeout(() => onDone?.(), 1500)
    return () => clearTimeout(timer)
  }, [onDone])

  const { x, y } = posRef.current

  return (
    <>
      {/* Emoji bubble */}
      <div
        className="reaction-bubble"
        style={{
          '--rx': `${x}vw`,
          '--ry': `${y}vh`,
        }}
      >
        {emoji}
      </div>

      {/* Sender label */}
      {senderName && (
        <div
          className="reaction-label"
          style={{
            left: `calc(${x}vw + 32px)`,
            top: `${y}vh`,
          }}
        >
          {senderName}
        </div>
      )}
    </>
  )
}
