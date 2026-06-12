/**
 * Comprime una imagen en el navegador antes de subirla.
 * Redimensiona al máximo indicado y la convierte a JPEG de calidad media.
 * Esto reduce mucho el uso del almacenamiento (1 GB en plan gratis).
 */
export async function compressImage(file, maxDim = 1280, quality = 0.72) {
  // Si no es imagen rasterizable, devolver tal cual
  if (!file.type.startsWith('image/') || file.type === 'image/gif') {
    return file
  }

  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })

  const img = await new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = reject
    image.src = dataUrl
  })

  let { width, height } = img
  if (width > maxDim || height > maxDim) {
    if (width >= height) {
      height = Math.round((height * maxDim) / width)
      width = maxDim
    } else {
      width = Math.round((width * maxDim) / height)
      height = maxDim
    }
  }

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  ctx.drawImage(img, 0, 0, width, height)

  const blob = await new Promise((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', quality)
  )

  if (!blob) return file
  // Si por algún motivo la "compresión" quedó más grande, usar el original
  if (blob.size >= file.size) return file

  return new File([blob], file.name.replace(/\.\w+$/, '.jpg'), {
    type: 'image/jpeg'
  })
}
