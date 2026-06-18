# Vinki Design System — Conventions

## Wrapping and setup

All components read CSS custom properties from `:root` (light mode) or `[data-theme="dark"]` (dark mode). Wrap every composition in `ThemeProvider` so the theme toggle wires up; without it, components render in light mode only (not broken, just fixed to light).

```jsx
import { ThemeProvider, Avatar, Modal, NoteCard } from 'vinki';

function MyScreen() {
  return (
    <ThemeProvider>
      <Avatar displayName="Klaus" color="#2E7D52" size="md" />
    </ThemeProvider>
  );
}
```

`ToastProvider` is a separate wrapper for toast notifications — wrap screens that need it too:

```jsx
<ThemeProvider>
  <ToastProvider>
    {/* screen content */}
  </ToastProvider>
</ThemeProvider>
```

## Styling idiom — CSS custom properties

Vinki uses **no utility classes**. Style layout glue with inline `style={{}}` or plain CSS using Vinki's token variables. All tokens live in `_ds_bundle.css` (imported via `styles.css`).

**Backgrounds & surfaces**
| Token | Value | Use |
|---|---|---|
| `--bg-canvas` | `#F5F1EB` / `#111520` | page/canvas background |
| `--bg-surface` | `#FFFFFF` / `#1C2130` | card/panel background |
| `--bg-surface-2` | `#F0EBE3` / `#252B3F` | secondary surface |
| `--bg-surface-3` | `#E8E1D8` / `#2E3550` | tertiary surface |

**Brand colors**
| Token | Light | Use |
|---|---|---|
| `--color-primary` | `#2E7D52` | primary actions, success |
| `--color-primary-soft` | `#D4EDE1` | primary backgrounds |
| `--color-accent` | `#E07240` | secondary actions |
| `--color-teal` | `#3D8FA6` | links, info |
| `--color-gold` | `#F0B429` | highlights, decks |
| `--color-danger` | `#EF4444` | destructive actions |

**Typography**
| Token | Value |
|---|---|
| `--font-display` | `'Outfit', sans-serif` |
| `--font-body` | `'DM Sans', sans-serif` |
| `--text-sm` / `--text-base` / `--text-lg` / `--text-xl` | `0.875rem` → `1.25rem` |

**Radii & shadows**
`--radius-sm` (6px), `--radius-md` (12px), `--radius-lg` (18px), `--radius-xl` (24px), `--radius-full` (9999px)
`--shadow-sm`, `--shadow-md`, `--shadow-lg`, `--shadow-card`

**Borders & text**
`--border`, `--border-strong`, `--text-primary`, `--text-secondary`, `--text-muted`

For your own layout glue use these tokens directly: `background: var(--bg-surface)`, `border-radius: var(--radius-md)`, etc.

## Where the truth lives

- `_ds_bundle.css` — all tokens, component styles, dark-mode overrides (read this before styling)
- `styles.css` — imports `_ds_bundle.css`; this is the closure designs receive
- Per-component `.prompt.md` files — props reference for each component

## Component APIs (key subset)

```tsx
// Pure UI — no context needed beyond ThemeProvider
<Avatar displayName="Klaus" color="#2E7D52" size="sm|md|lg|xl" />
<Modal isOpen title="Title" onClose={fn} footer={<button>OK</button>}>body</Modal>

// Cards — pass a `card` object shaped like { id, type, content: {...} }
<NoteCard card={card} isEditing={false} onUpdate={fn} />
<LinkCard card={card} isEditing={false} onUpdate={fn} />
<TimerCard card={card} isEditing={false} onUpdate={fn} />
<DeckCard card={card} isEditing={false} onUpdate={fn} profile={profile} />

// Dashboard
<CanvasCard canvas={canvas} colorIndex={0} onOpen={fn} onRemove={fn} />

// Session / presence
<PresenceBar partner={partnerObj} partnerFocusTitle="Reading notes" />
<ReactionBubble emoji="🎉" senderName="Klaus" onDone={fn} />
<AddBlockMenu onAdd={(type) => {}} />
```

## Idiomatic build snippet

```jsx
import { ThemeProvider, Avatar, Modal } from 'vinki';

export function UserModal({ user, open, onClose }) {
  return (
    <ThemeProvider>
      <Modal isOpen={open} title={user.name} onClose={onClose}>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center',
                      padding: '16px', background: 'var(--bg-surface-2)',
                      borderRadius: 'var(--radius-md)' }}>
          <Avatar displayName={user.name} color={user.color} size="lg" />
          <p style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-body)' }}>
            {user.email}
          </p>
        </div>
      </Modal>
    </ThemeProvider>
  );
}
```
