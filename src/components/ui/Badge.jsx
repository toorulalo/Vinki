const TONES = {
  primary: ['var(--color-primary-soft)', 'var(--color-primary)'],
  accent:  ['var(--color-accent-soft)',  'var(--color-accent)'],
  teal:    ['var(--color-teal-soft)',    'var(--color-teal)'],
  gold:    ['var(--color-gold-soft)',    'var(--color-gold)'],
  violet:  ['var(--color-violet-soft)',  'var(--color-violet)'],
  danger:  ['var(--color-danger-soft)',  'var(--color-danger)'],
  neutral: ['var(--bg-surface-3)',       'var(--text-secondary)'],
}

export function Badge({ children, tone = 'primary', icon = null, style = {} }) {
  const [bg, fg] = TONES[tone] || TONES.primary
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: icon ? '3px 10px 3px 8px' : '3px 10px',
        borderRadius: 'var(--radius-full)',
        background: bg,
        color: fg,
        fontSize: 'var(--text-xs)',
        fontWeight: 'var(--weight-bold)',
        fontFamily: 'var(--font-body)',
        lineHeight: 1.4,
        whiteSpace: 'nowrap',
        ...style,
      }}
    >
      {icon}
      {children}
    </span>
  )
}

export default Badge
