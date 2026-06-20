import React from 'react'

const VARIANT = {
  primary: {
    bg: 'var(--color-primary)',
    grad: 'var(--grad-primary)',
    bgHover: 'var(--color-primary-hover)',
    fg: 'var(--color-on-primary)',
    glow: 'var(--glow-primary)',
    solid: true,
  },
  accent: {
    bg: 'var(--color-accent)',
    grad: 'var(--grad-accent)',
    bgHover: 'var(--color-accent-hover)',
    fg: 'var(--color-on-accent)',
    glow: 'var(--glow-accent)',
    solid: true,
  },
  danger: {
    bg: 'var(--color-danger)',
    grad: 'linear-gradient(180deg, var(--color-danger-hover), var(--color-danger))',
    bgHover: 'var(--color-danger-hover)',
    fg: '#fff',
    glow: 'var(--glow-danger)',
    solid: true,
  },
  secondary: {
    bg: 'var(--bg-surface-2)',
    bgHover: 'var(--bg-surface-3)',
    fg: 'var(--text-primary)',
    border: '1px solid var(--border-strong)',
    solid: false,
  },
  ghost: {
    bg: 'transparent',
    bgHover: 'var(--bg-surface-2)',
    fg: 'var(--text-secondary)',
    solid: false,
  },
}

const SIZE = {
  sm: { pad: '8px 14px', font: 'var(--text-sm)', radius: 'var(--radius-sm)', gap: 6, minH: '36px' },
  md: { pad: '12px 20px', font: 'var(--text-base)', radius: 'var(--radius-md)', gap: 8, minH: 'var(--tap-min)' },
  lg: { pad: '16px 28px', font: 'var(--text-lg)', radius: 'var(--radius-md)', gap: 10, minH: 'var(--tap-min)' },
}

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  block = false,
  disabled = false,
  iconLeft = null,
  iconRight = null,
  style = {},
  onClick,
  ...rest
}) {
  const v = VARIANT[variant] || VARIANT.primary
  const s = SIZE[size] || SIZE.md
  const [hover, setHover] = React.useState(false)
  const [press, setPress] = React.useState(false)

  const lifted = !disabled && v.solid
  const collapse = lifted && press

  let boxShadow = 'none'
  if (lifted) {
    boxShadow = collapse
      ? 'var(--rim-top), 0 2px 6px rgba(0,0,0,0.35)'
      : `var(--rim-top), var(--shadow-sm), ${v.glow}`
  } else if (!v.solid && v.border) {
    boxShadow = 'var(--rim-top), var(--shadow-sm)'
  }

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      style={{
        display: block ? 'flex' : 'inline-flex',
        width: block ? '100%' : undefined,
        alignItems: 'center',
        justifyContent: 'center',
        gap: s.gap,
        minHeight: s.minH,
        padding: s.pad,
        fontFamily: 'var(--font-body)',
        fontSize: s.font,
        fontWeight: 'var(--weight-bold)',
        letterSpacing: '0.005em',
        lineHeight: 1,
        color: v.fg,
        background: v.solid
          ? (disabled ? v.bg : (hover ? v.bgHover : v.grad))
          : (hover ? v.bgHover : v.bg),
        border: v.border || 'none',
        borderRadius: s.radius,
        boxShadow,
        transform: collapse ? 'translateY(1px) scale(0.99)' : 'translateY(0)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.45 : 1,
        whiteSpace: 'nowrap',
        userSelect: 'none',
        transition: 'background var(--duration-fast) ease, transform var(--duration-fast) var(--ease-spring), box-shadow var(--duration-normal) ease',
        ...style,
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => { setHover(false); setPress(false) }}
      onPointerDown={() => setPress(true)}
      onPointerUp={() => setPress(false)}
      onPointerCancel={() => setPress(false)}
      {...rest}
    >
      {iconLeft}
      {children}
      {iconRight}
    </button>
  )
}

export default Button
