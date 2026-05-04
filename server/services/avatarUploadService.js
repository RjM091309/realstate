import fs from 'fs/promises';
import path from 'path';
import sharp from 'sharp';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const AVATAR_DIR = path.resolve(__dirname, '..', 'uploads', 'avatars');

async function unlinkQuietly(filePath) {
  try {
    await fs.unlink(filePath);
  } catch {
    // ignore
  }
}

/** @param {import('multer').File} file */
export async function finalizeProfileAvatarUpload(file) {
  const mime = String(file.mimetype ?? '').toLowerCase();
  if (!mime.startsWith('image/')) {
    await unlinkQuietly(file.path);
    const err = new Error('Please upload an image file.');
    err.statusCode = 400;
    throw err;
  }

  const stem = path.basename(file.filename, path.extname(file.filename));
  const outName = `${stem}.webp`;
  const outPath = path.join(AVATAR_DIR, outName);

  try {
    await sharp(file.path)
      .rotate()
      .resize(256, 256, { fit: 'cover', position: 'centre' })
      .webp({ quality: 82, effort: 4 })
      .toFile(outPath);
  } catch (e) {
    console.error('[avatarUpload] sharp failed', {
      mimetype: file.mimetype,
      originalname: file.originalname,
      filename: file.filename,
      error: e instanceof Error ? e.message : String(e),
    });
    await unlinkQuietly(file.path);
    const err = new Error(
      'Could not convert this image to WebP. Try another image format (max 2MB).',
    );
    err.statusCode = 400;
    err.cause = e;
    throw err;
  }

  await unlinkQuietly(file.path);

  return {
    publicUrl: `/uploads/avatars/${encodeURIComponent(outName)}`,
  };
}

/** Remove a previously stored avatar file from disk (safe paths only). */
export async function deletePublicAvatarFile(publicUrl) {
  if (!publicUrl || typeof publicUrl !== 'string') return;
  const trimmed = publicUrl.trim();
  const parts = trimmed.replace(/^\/+/, '').split('/').filter(Boolean);
  if (parts.length !== 3 || parts[0] !== 'uploads' || parts[1] !== 'avatars') return;
  let rawName = parts[2];
  try {
    rawName = decodeURIComponent(rawName);
  } catch {
    return;
  }
  if (!rawName || rawName.includes('..')) return;
  const full = path.join(AVATAR_DIR, rawName);
  const resolved = path.resolve(full);
  const root = path.resolve(AVATAR_DIR);
  if (!resolved.startsWith(root + path.sep) && resolved !== root) return;
  await fs.unlink(resolved).catch(() => {});
}
