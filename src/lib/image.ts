/**
 * Reduz a foto para um quadrado de 320px antes de salvar.
 * Evita estourar o armazenamento local e deixa o carregamento rapido.
 */
export async function squareThumb(file: File, size = 320): Promise<File> {
  const bitmap = await loadImage(file)
  const min = Math.min(bitmap.width, bitmap.height)
  const sx = (bitmap.width - min) / 2
  const sy = (bitmap.height - min) / 2
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) return file
  ctx.drawImage(bitmap, sx, sy, min, min, 0, 0, size, size)
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', 0.82))
  if (!blob) return file
  return new File([blob], 'foto.jpg', { type: 'image/jpeg' })
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => { URL.revokeObjectURL(url); resolve(img) }
    img.onerror = (e) => { URL.revokeObjectURL(url); reject(e) }
    img.src = url
  })
}
