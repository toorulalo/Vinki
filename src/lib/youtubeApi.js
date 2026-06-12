// Carga única de la API de YouTube IFrame (sin paquetes npm)
let ytPromise = null

export function loadYouTubeAPI() {
  if (window.YT?.Player) return Promise.resolve(window.YT)
  if (ytPromise) return ytPromise

  ytPromise = new Promise((resolve) => {
    const prev = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => {
      prev?.()
      resolve(window.YT)
    }
    const tag = document.createElement('script')
    tag.src = 'https://www.youtube.com/iframe_api'
    document.head.appendChild(tag)
  })

  return ytPromise
}
