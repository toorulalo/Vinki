import React from 'react'

const SIZES = { sm: 28, md: 36, lg: 48, xl: 64 }
const FONTS = { sm: 11, md: 14, lg: 18, xl: 24 }

function initials(str = '') {
  const parts = str.trim().split(/\s+/)
  if (!parts[0]) return '?'
  return (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase()
}

export default function Avatar({
  name,
  displayName,
  color = 'var(--color-accent)',
  size = 'md',
  online = false,
  style = {},
}) {
  const label = name || displayName || ''
  const px = typeof size === 'number' ? size : (SIZES[size] ?? 36)
  const font = typeof size === 'number' ? Math.round(size * 0.4) : (FONTS[size] ?? 14)
  const dot = Math.max(8, Math.round(px * 0.28))

  return (
    <span style={{ position: 'relative', display: 'inline-flex', flexShrink: 0, ...style }}>
      <span
        className={typeof size === 'string' ? `avatar avatar-${size}` : 'avatar'}
        style={{
          backgroundColor: color,
          width: typeof size === 'number' ? px : undefined,
          height: typeof size === 'number' ? px : undefined,
          fontSize: typeof size === 'number' ? font : undefined,
        }}
        aria-label={label || 'Avatar'}
        role="img"
      >
        {initials(label)}
      </span>
      {online && (
        <span
          style={{
            position: 'absolute',
            right: -1,
            bottom: -1,
            width: dot,
            height: dot,
            borderRadius: '50%',
            background: 'var(--color-primary)',
            border: '2px solid var(--bg-surface)',
            boxShadow: '0 0 0 2px var(--bg-surface)',
          }}
        />
      )}
    </span>
  )
}
