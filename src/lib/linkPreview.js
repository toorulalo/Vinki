export function getYoutubeId(url) {
  if (!url) return null
  try {
    const u = new URL(url)
    if (u.hostname.includes('youtu.be')) return u.pathname.slice(1) || null
    if (u.hostname.includes('youtube.com')) {
      if (u.pathname === '/watch') return u.searchParams.get('v')
      if (u.pathname.startsWith('/shorts/')) return u.pathname.split('/')[2] || null
    }
  } catch { return null }
  return null
}

export function getDomain(url) {
  try { return new URL(url).hostname.replace(/^www\./, '') } catch { return '' }
}

export function getFavicon(url) {
  const domain = getDomain(url)
  if (!domain) return ''
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`
}
