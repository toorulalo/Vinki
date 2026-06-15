/**
 * VINKI — Set de íconos SVG propios
 * Estilo: trazo redondeado grueso, strokeLinecap/join round
 * Color: heredan currentColor
 */

const BASE = {
  xmlns: 'http://www.w3.org/2000/svg',
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: '2',
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
}

function Icon({ children, size = 22, className = '', style = {}, ...rest }) {
  return (
    <svg {...BASE} width={size} height={size} className={className} style={style} aria-hidden="true" {...rest}>
      {children}
    </svg>
  )
}

/* ---- Navegación ---- */

export function IconBack(p) {
  return <Icon {...p}><polyline points="15 18 9 12 15 6" /></Icon>
}

export function IconSettings(p) {
  return (
    <Icon {...p}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </Icon>
  )
}

export function IconInbox(p) {
  return (
    <Icon {...p}>
      <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
      <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
    </Icon>
  )
}

export function IconLink(p) {
  return (
    <Icon {...p}>
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </Icon>
  )
}

export function IconVinki(p) {
  return (
    <Icon {...p}>
      <polyline points="2 4 8 16 12 8" />
      <polyline points="12 8 16 16 22 4" />
    </Icon>
  )
}

/* ---- Barra de lienzo ---- */

export function IconUndo(p) {
  return (
    <Icon {...p}>
      <polyline points="1 4 1 10 7 10" />
      <path d="M3.51 15a9 9 0 1 0 .49-4.95" />
    </Icon>
  )
}

export function IconRedo(p) {
  return (
    <Icon {...p}>
      <polyline points="23 4 23 10 17 10" />
      <path d="M20.49 15a9 9 0 1 1-.49-4.95" />
    </Icon>
  )
}

export function IconTrash(p) {
  return (
    <Icon {...p}>
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </Icon>
  )
}

/* ---- Tipos de tarjeta ---- */

export function IconPlus(p) {
  return (
    <Icon {...p}>
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </Icon>
  )
}

export function IconNote(p) {
  return (
    <Icon {...p}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="9" y1="13" x2="15" y2="13" />
      <line x1="9" y1="17" x2="13" y2="17" />
    </Icon>
  )
}

export function IconLinkCard(p) {
  return (
    <Icon {...p}>
      <rect x="2" y="4" width="20" height="16" rx="3" />
      <path d="M8 10a2 2 0 0 0 2.83.17l2-2a2 2 0 0 0-2.83-2.83L9.29 6.05" />
      <path d="M11 14a2 2 0 0 0-2.83-.17l-2 2a2 2 0 0 0 2.83 2.83l.7-.71" />
    </Icon>
  )
}

export function IconImage(p) {
  return (
    <Icon {...p}>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <polyline points="21 15 16 10 5 21" />
    </Icon>
  )
}

export function IconPdf(p) {
  return (
    <Icon {...p}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <path d="M9 13h1.5a1.5 1.5 0 0 1 0 3H9v-3z" strokeWidth="1.8" />
      <line x1="13" y1="13" x2="13" y2="16" strokeWidth="1.8" />
      <path d="M16 13h.5a1.5 1.5 0 0 1 0 3H16v-3z" strokeWidth="1.8" />
    </Icon>
  )
}

export function IconDeck(p) {
  return (
    <Icon {...p}>
      <rect x="2" y="6" width="16" height="12" rx="2" />
      <path d="M6 6V4a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-2" />
      <line x1="7" y1="10" x2="13" y2="10" />
      <line x1="7" y1="14" x2="11" y2="14" />
    </Icon>
  )
}

export function IconX(p) {
  return (
    <Icon {...p}>
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </Icon>
  )
}

export function IconMinimize(p) {
  return <Icon {...p}><line x1="5" y1="12" x2="19" y2="12" /></Icon>
}

export function IconExpand(p) {
  return (
    <Icon {...p}>
      <polyline points="15 3 21 3 21 9" />
      <polyline points="9 21 3 21 3 15" />
      <line x1="21" y1="3" x2="14" y2="10" />
      <line x1="3" y1="21" x2="10" y2="14" />
    </Icon>
  )
}

export function IconCheck(p) {
  return <Icon {...p}><polyline points="20 6 9 17 4 12" /></Icon>
}

export function IconMove(p) {
  return (
    <Icon {...p}>
      <polyline points="5 9 2 12 5 15" />
      <polyline points="9 5 12 2 15 5" />
      <polyline points="15 19 12 22 9 19" />
      <polyline points="19 9 22 12 19 15" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <line x1="12" y1="2" x2="12" y2="22" />
    </Icon>
  )
}

export function IconChevronRight(p) {
  return <Icon {...p}><polyline points="9 18 15 12 9 6" /></Icon>
}

/* ---- Sesión ---- */

export function IconFace(p) {
  return (
    <Icon {...p}>
      <circle cx="12" cy="12" r="10" />
      <path d="M8 14s1.5 2 4 2 4-2 4-2" />
      <line x1="9" y1="9" x2="9.01" y2="9" strokeWidth="2.5" />
      <line x1="15" y1="9" x2="15.01" y2="9" strokeWidth="2.5" />
    </Icon>
  )
}

export function IconLogout(p) {
  return (
    <Icon {...p}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </Icon>
  )
}

export function IconLeaveSession(p) {
  return (
    <Icon {...p}>
      <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
      <polyline points="10 17 15 12 10 7" />
      <line x1="15" y1="12" x2="3" y2="12" />
    </Icon>
  )
}

export function IconCopy(p) {
  return (
    <Icon {...p}>
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </Icon>
  )
}

export function IconEyeOn(p) {
  return (
    <Icon {...p}>
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </Icon>
  )
}

export function IconEyeOff(p) {
  return (
    <Icon {...p}>
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </Icon>
  )
}

export function IconMoreVertical(p) {
  return (
    <Icon {...p}>
      <circle cx="12" cy="5"  r="1.2" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="12" cy="19" r="1.2" fill="currentColor" stroke="none" />
    </Icon>
  )
}

/* ---- Reacciones ---- */

export function IconReactionApprove(p) {
  return (
    <Icon {...p}>
      <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z" />
      <path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
    </Icon>
  )
}

export function IconReactionHeart(p) {
  return (
    <Icon {...p}>
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </Icon>
  )
}

export function IconReactionCelebrate(p) {
  return (
    <Icon {...p}>
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </Icon>
  )
}

export function IconReactionHighFive(p) {
  return (
    <Icon {...p}>
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
    </Icon>
  )
}

/* ---- General ---- */

export function IconClose(p) {
  return (
    <Icon {...p}>
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </Icon>
  )
}

export function IconCanvas(p) {
  return (
    <Icon {...p}>
      <path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2" />
      <rect x="7" y="7" width="10" height="10" rx="1" />
    </Icon>
  )
}

export function IconCreate(p) {
  return (
    <Icon {...p}>
      <path d="M12 5v14M5 12h14" strokeWidth="2.2" />
    </Icon>
  )
}

export function IconJoin(p) {
  return (
    <Icon {...p}>
      <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
    </Icon>
  )
}

export function IconUpload(p) {
  return (
    <Icon {...p}>
      <polyline points="16 16 12 12 8 16" />
      <line x1="12" y1="12" x2="12" y2="21" />
      <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3" />
    </Icon>
  )
}

export function IconStar(p) {
  return (
    <Icon {...p}>
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </Icon>
  )
}
