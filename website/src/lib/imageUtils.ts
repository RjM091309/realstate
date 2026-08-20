/** Resizes an image file and re-encodes it as WebP, returning a data URL. Falls back to JPEG if the browser can't encode WebP. */
export async function fileToWebP(file: File, opts: { maxSize?: number; quality?: number } = {}): Promise<string> {
  const { maxSize = 800, quality = 0.85 } = opts

  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height))
  const width = Math.round(bitmap.width * scale)
  const height = Math.round(bitmap.height * scale)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D context unavailable')
  ctx.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()

  const webp = canvas.toDataURL('image/webp', quality)
  if (webp.startsWith('data:image/webp')) return webp

  // Browser can't encode WebP (older Safari) — fall back to JPEG so upload still works.
  return canvas.toDataURL('image/jpeg', quality)
}
