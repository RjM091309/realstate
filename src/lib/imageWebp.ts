/** Convert any browser-supported image (JPEG, PNG, etc.) to a WebP data URL. */
export async function toWebpDataUrl(file: File, maxSide = 1600, quality = 0.82): Promise<string> {
  if (!file.type || !file.type.startsWith('image/')) {
    throw new Error('Not an image');
  }

  const bitmap = await createImageBitmap(file);
  const srcW = bitmap.width;
  const srcH = bitmap.height;
  const scale = Math.min(1, maxSide / Math.max(srcW, srcH));
  const outW = Math.max(1, Math.round(srcW * scale));
  const outH = Math.max(1, Math.round(srcH * scale));

  const canvas = document.createElement('canvas');
  canvas.width = outW;
  canvas.height = outH;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unsupported');

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, 0, 0, outW, outH);
  bitmap.close();

  const blob: Blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => {
        if (!b) reject(new Error('WEBP conversion failed'));
        else resolve(b);
      },
      'image/webp',
      quality,
    );
  });

  const dataUrl: string = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read converted image'));
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.readAsDataURL(blob);
  });

  if (!dataUrl.startsWith('data:image/webp')) {
    throw new Error('Unexpected output format');
  }

  return dataUrl;
}
