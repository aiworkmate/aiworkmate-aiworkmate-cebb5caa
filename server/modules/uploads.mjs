import fs from 'node:fs/promises';
import path from 'node:path';
import { config } from '../config.mjs';
import { extractText, summarizeDocument } from './documents.mjs';
import { imageDimensions, isImageMime, summarizeImage } from './vision.mjs';
import { nowISO, sanitizeText, sha256, uid } from '../lib/utils.mjs';

function safeName(name) {
  return sanitizeText(name || 'upload.bin', 160).replace(/[<>:"/\\|?*\x00-\x1F]/g, '_') || 'upload.bin';
}

function parseData(dataUrl) {
  const value = String(dataUrl || '');
  const match = value.match(/^data:([^;,]+)?(;base64)?,(.*)$/s);
  if (!match) return { mime: '', buffer: Buffer.from(value, 'base64') };
  const mime = match[1] || 'application/octet-stream';
  const payload = match[3] || '';
  return {
    mime,
    buffer: match[2] ? Buffer.from(payload, 'base64') : Buffer.from(decodeURIComponent(payload), 'utf8')
  };
}

export async function createUpload(store, userId, input) {
  const name = safeName(input.name);
  const parsed = parseData(input.data || input.dataUrl || '');
  const mime = sanitizeText(input.type || parsed.mime || 'application/octet-stream', 120);
  const size = parsed.buffer.length;
  if (!size) {
    const error = new Error('Upload is empty.');
    error.status = 400;
    throw error;
  }
  if (size > config.maxUploadBytes) {
    const error = new Error('Upload exceeds the configured size limit.');
    error.status = 413;
    throw error;
  }

  const id = uid('upl');
  const dir = path.join(config.dataDir, 'uploads', userId);
  await fs.mkdir(dir, { recursive: true });
  const storedName = `${id}${path.extname(name).toLowerCase() || '.bin'}`;
  const filePath = path.join(dir, storedName);
  await fs.writeFile(filePath, parsed.buffer);

  const extractedText = extractText(parsed.buffer, name, mime);
  const image = isImageMime(mime) ? imageDimensions(parsed.buffer, mime, name) : null;
  const upload = {
    id,
    userId,
    name,
    mime,
    size,
    hash: sha256(parsed.buffer),
    storedPath: filePath,
    extractedText,
    image,
    summary: isImageMime(mime)
      ? summarizeImage({ name, image })
      : summarizeDocument(extractedText, name),
    createdAt: nowISO()
  };

  await store.update((db) => {
    db.uploads.push(upload);
  });

  return publicUpload(upload);
}

export function publicUpload(upload) {
  return {
    id: upload.id,
    name: upload.name,
    mime: upload.mime,
    size: upload.size,
    hash: upload.hash,
    image: upload.image || null,
    summary: upload.summary,
    hasText: Boolean(upload.extractedText),
    createdAt: upload.createdAt
  };
}

export function uploadsForUser(db, userId) {
  return db.uploads.filter((item) => item.userId === userId).map(publicUpload).reverse();
}

export function uploadContext(db, userId, ids = []) {
  const set = new Set(ids);
  return db.uploads
    .filter((item) => item.userId === userId && (set.size === 0 || set.has(item.id)))
    .slice(-6)
    .map((item) => ({
      id: item.id,
      name: item.name,
      mime: item.mime,
      summary: item.summary,
      extractedText: item.extractedText ? item.extractedText.slice(0, 10_000) : '',
      image: item.image || null,
      storedPath: item.storedPath
    }));
}
