import fs from 'fs/promises';
import path from 'path';
import sharp from 'sharp';

async function unlinkQuietly(filePath) {
  try {
    await fs.unlink(filePath);
  } catch {
    // Ignore cleanup errors for temp uploads.
  }
}

/** @param {import('multer').File} file */
export async function finalizeTemplateUploadToWebpOrPdf(file) {
  const mime = String(file.mimetype ?? '').toLowerCase();
  const dir = path.dirname(file.path);
  const ext = path.extname(file.filename).toLowerCase();
  const stem = path.basename(file.filename, ext);

  if (mime === 'application/pdf' || ext === '.pdf') {
    return {
      publicUrl: `/uploads/templates/${encodeURIComponent(path.basename(file.filename))}`,
    };
  }

  if (!mime.startsWith('image/')) {
    await unlinkQuietly(file.path);
    const err = new Error('Only images (saved as WebP) or PDF files are allowed.');
    err.statusCode = 400;
    throw err;
  }

  if (mime === 'image/svg+xml') {
    await unlinkQuietly(file.path);
    const err = new Error('SVG uploads are not supported. Use PNG, JPEG, or WebP.');
    err.statusCode = 400;
    throw err;
  }

  if (mime === 'image/webp' || ext === '.webp') {
    return {
      publicUrl: `/uploads/templates/${encodeURIComponent(path.basename(file.filename))}`,
    };
  }

  const outName = `${stem}.webp`;
  const outPath = path.join(dir, outName);

  try {
    await sharp(file.path).rotate().webp({ quality: 82, effort: 4 }).toFile(outPath);
  } catch (e) {
    console.error('[templateUpload] sharp failed', {
      mimetype: file.mimetype,
      originalname: file.originalname,
      size: file.size,
      filename: file.filename,
      path: file.path,
      error: e instanceof Error ? e.message : String(e),
    });
    await unlinkQuietly(file.path);
    const err = new Error('Could not process this image. Try JPEG, PNG, GIF, or WebP (max 10MB).');
    err.statusCode = 400;
    err.cause = e;
    throw err;
  }

  await unlinkQuietly(file.path);

  return {
    publicUrl: `/uploads/templates/${encodeURIComponent(outName)}`,
  };
}

