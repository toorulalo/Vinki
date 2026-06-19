import React from 'react'

export function Input({
  label,
  error,
  prefix,
  multiline = false,
  rows = 4,
  style = {},
  id,
  ...rest
}) {
  const [focus, setFocus] = React.useState(false)
  const reactId = React.useId()
  const fieldId = id || reactId

  const controlStyle = {
    width: '100%',
    minHeight: multiline ? undefined : 'var(--tap-min)',
    padding: prefix ? '11px 14px 11px 30px' : '11px 14px',
    fontFamily: 'var(--font-body)',
    fontSize: 'var(--text-base)',
    color: 'var(--text-primary)',
    background: focus ? 'var(--bg-surface)' : 'var(--bg-surface-2)',
    border: `1px solid ${error ? 'var(--color-danger)' : focus ? 'var(--color-primary)' : 'var(--border)'}`,
    borderRadius: 'var(--radius-md)',
    outline: 'none',
    boxShadow: error
      ? '0 0 0 3px var(--color-danger-soft)'
      : focus
        ? '0 0 0 3px rgba(79,201,125,0.16)'
        : 'inset 0 1px 2px rgba(0,0,0,0.30)',
    resize: multiline ? 'vertical' : undefined,
    lineHeight: multiline ? 'var(--leading-normal)' : 1.2,
    transition: 'border-color var(--duration-fast) ease, background var(--duration-fast) ease, box-shadow var(--duration-fast) ease',
    ...style,
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {label && (
        <label htmlFor={fieldId} style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semibold)', color: 'var(--text-secondary)' }}>
          {label}
        </label>
      )}
      <div style={{ position: 'relative', display: 'flex' }}>
        {prefix && (
          <span aria-hidden="true" style={{ position: 'absolute', left: 13, top: multiline ? 13 : '50%', transform: multiline ? 'none' : 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none', fontSize: 'var(--text-base)' }}>
            {prefix}
          </span>
        )}
        {multiline ? (
          <textarea id={fieldId} rows={rows} style={controlStyle} onFocus={() => setFocus(true)} onBlur={() => setFocus(false)} {...rest} />
        ) : (
          <input id={fieldId} style={controlStyle} onFocus={() => setFocus(true)} onBlur={() => setFocus(false)} {...rest} />
        )}
      </div>
      {error && (
        <p role="alert" style={{ fontSize: 'var(--text-xs)', color: 'var(--color-danger)', margin: 0 }}>{error}</p>
      )}
    </div>
  )
}

export default Input
