import React from 'react'

export function Card({
  children,
  interactive = false,
  accent = 'var(--color-primary)',
  padded = true,
  onClick,
  style = {},
  ...rest
}) {
  const [hover, setHover] = React.useState(false)
  const [press, setPress] = React.useState(false)

  const base = {
    background: 'var(--grad-surface), var(--bg-surface)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)',
    padding: padded ? 'var(--space-5)' : 0,
    color: 'var(--text-primary)',
    ...style,
  }

  if (!interactive) {
    return (
      <div style={{ boxShadow: 'var(--rim-top), var(--shadow-card)', ...base }} onClick={onClick} {...rest}>
        {children}
      </div>
    )
  }

  return (
    <div
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => { setHover(false); setPress(false) }}
      onPointerDown={() => setPress(true)}
      onPointerUp={() => setPress(false)}
      onPointerCancel={() => setPress(false)}
      style={{
        ...base,
        cursor: onClick ? 'pointer' : 'default',
        boxShadow: hover ? `var(--rim-top), 0 0 0 1px ${accent}, var(--shadow-md)` : 'var(--rim-top), var(--shadow-card)',
        transform: press ? 'translateY(0) scale(0.992)' : hover ? 'translateY(-3px)' : 'translateY(0)',
        transition: 'transform var(--duration-normal) var(--ease-out), box-shadow var(--duration-normal) var(--ease-out)',
      }}
      {...rest}
    >
      {children}
    </div>
  )
}

export default Card
