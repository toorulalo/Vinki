import React from 'react'

export function Toggle({ checked = false, onChange, disabled = false, label, id }) {
  const reactId = React.useId()
  const fieldId = id || reactId

  return (
    <label
      htmlFor={fieldId}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 10, cursor: disabled ? 'not-allowed' : 'pointer' }}
    >
      <input
        id={fieldId}
        type="checkbox"
        role="switch"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange && onChange(e.target.checked)}
        style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }}
      />
      <span
        style={{
          position: 'relative',
          width: 46,
          height: 26,
          flexShrink: 0,
          borderRadius: 'var(--radius-full)',
          background: checked ? 'var(--color-primary)' : 'var(--border-strong)',
          transition: 'background var(--duration-normal) ease',
          opacity: disabled ? 0.5 : 1,
          cursor: disabled ? 'not-allowed' : 'pointer',
          display: 'inline-block',
        }}
      >
        <span
          style={{
            position: 'absolute',
            top: 3,
            left: 3,
            width: 20,
            height: 20,
            borderRadius: '50%',
            background: '#fff',
            boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
            transform: checked ? 'translateX(20px)' : 'translateX(0)',
            transition: 'transform var(--duration-normal) var(--ease-spring)',
          }}
        />
      </span>
      {label && (
        <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-primary)', fontWeight: 'var(--weight-medium)' }}>
          {label}
        </span>
      )}
    </label>
  )
}

export default Toggle
