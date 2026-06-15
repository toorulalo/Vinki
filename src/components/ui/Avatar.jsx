/**
 * Color-based avatar showing initials.
 *
 * Props:
 *   displayName {string}  — used to derive the initial shown
 *   color       {string}  — CSS color string (e.g. '#2E7D52')
 *   size        {'sm'|'md'|'lg'|'xl'}
 */
export default function Avatar({ displayName = '', color = '#2E7D52', size = 'md' }) {
  const initial = displayName.trim().charAt(0).toUpperCase() || '?'

  return (
    <div
      className={`avatar avatar-${size}`}
      style={{ backgroundColor: color }}
      aria-label={displayName || 'Avatar'}
      role="img"
    >
      {initial}
    </div>
  )
}
