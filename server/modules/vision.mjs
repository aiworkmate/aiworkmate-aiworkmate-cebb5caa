import path from 'node:path';

export function imageDimensions(buffer, mime = '', name = '') {
  if (mime === 'image/png' || buffer.slice(0, 8).toString('hex') === '89504e470d0a1a0a') {
    return {
      width: buffer.readUInt32BE(16),
      height: buffer.readUInt32BE(20),
      format: 'png'
    };
  }
  if (mime === 'image/jpeg' || ['.jpg', '.jpeg'].includes(path.extname(name).toLowerCase())) {
    let offset = 2;
    while (offset < buffer.length) {
      if (buffer[offset] !== 0xff) break;
      const marker = buffer[offset + 1];
      const length = buffer.readUInt16BE(offset + 2);
      if (marker >= 0xc0 && marker <= 0xc3) {
        return {
          height: buffer.readUInt16BE(offset + 5),
          width: buffer.readUInt16BE(offset + 7),
          format: 'jpeg'
        };
      }
      offset += 2 + length;
    }
  }
  if (mime === 'image/gif' || buffer.slice(0, 3).toString('ascii') === 'GIF') {
    return {
      width: buffer.readUInt16LE(6),
      height: buffer.readUInt16LE(8),
      format: 'gif'
    };
  }
  return null;
}

export function summarizeImage(upload) {
  const dims = upload.image?.width && upload.image?.height
    ? `${upload.image.width} by ${upload.image.height} ${upload.image.format || 'image'}`
    : 'image';
  if (upload.visionSummary) return upload.visionSummary;
  return `Stored ${upload.name} as a ${dims}. Semantic vision analysis will use the server-side AI vision model when configured.`;
}

export function isImageMime(mime = '') {
  return String(mime).startsWith('image/');
}
