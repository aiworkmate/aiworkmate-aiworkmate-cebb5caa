import assert from 'node:assert/strict';
import test from 'node:test';

import {
  imageDimensions,
  summarizeImage,
  isImageMime
} from '../server/modules/vision.mjs';

test('imageDimensions parses PNG dimensions', () => {
  // Minimal PNG header: 8-byte signature + IHDR chunk with width=100, height=200
  const buf = Buffer.alloc(24);
  buf.write('\x89PNG\r\n\x1a\n', 0, 'binary'); // PNG signature
  buf.writeUInt32BE(13, 8);   // IHDR length
  buf.write('IHDR', 12);     // IHDR type
  buf.writeUInt32BE(100, 16); // width
  buf.writeUInt32BE(200, 20); // height
  const result = imageDimensions(buf, 'image/png');
  assert.deepEqual(result, { width: 100, height: 200, format: 'png' });
});

test('imageDimensions detects PNG by magic bytes', () => {
  const buf = Buffer.alloc(24);
  buf.write('\x89PNG\r\n\x1a\n', 0, 'binary');
  buf.writeUInt32BE(50, 16);
  buf.writeUInt32BE(75, 20);
  const result = imageDimensions(buf, '');
  assert.deepEqual(result, { width: 50, height: 75, format: 'png' });
});

test('imageDimensions parses GIF dimensions', () => {
  const buf = Buffer.alloc(10);
  buf.write('GIF89a', 0, 'ascii');
  buf.writeUInt16LE(320, 6);
  buf.writeUInt16LE(240, 8);
  const result = imageDimensions(buf, 'image/gif');
  assert.deepEqual(result, { width: 320, height: 240, format: 'gif' });
});

test('imageDimensions detects GIF by magic bytes', () => {
  const buf = Buffer.alloc(10);
  buf.write('GIF87a', 0, 'ascii');
  buf.writeUInt16LE(160, 6);
  buf.writeUInt16LE(120, 8);
  const result = imageDimensions(buf, '');
  assert.deepEqual(result, { width: 160, height: 120, format: 'gif' });
});

test('imageDimensions returns null for unknown format', () => {
  const buf = Buffer.from('not an image');
  assert.equal(imageDimensions(buf, 'application/pdf'), null);
});

test('summarizeImage returns vision summary when available', () => {
  const upload = {
    name: 'photo.jpg',
    image: { width: 1920, height: 1080, format: 'jpeg' },
    visionSummary: 'A beautiful sunset over the ocean.'
  };
  assert.equal(summarizeImage(upload), 'A beautiful sunset over the ocean.');
});

test('summarizeImage returns dimension info when no vision summary', () => {
  const upload = {
    name: 'photo.jpg',
    image: { width: 1920, height: 1080, format: 'jpeg' }
  };
  const result = summarizeImage(upload);
  assert.ok(result.includes('1920'));
  assert.ok(result.includes('1080'));
  assert.ok(result.includes('jpeg'));
  assert.ok(result.includes('photo.jpg'));
});

test('summarizeImage handles missing dimensions', () => {
  const upload = { name: 'mystery.bin', image: null };
  const result = summarizeImage(upload);
  assert.ok(result.includes('mystery.bin'));
  assert.ok(result.includes('image'));
});

test('isImageMime detects image types', () => {
  assert.ok(isImageMime('image/png'));
  assert.ok(isImageMime('image/jpeg'));
  assert.ok(isImageMime('image/gif'));
  assert.ok(isImageMime('image/webp'));
});

test('isImageMime rejects non-image types', () => {
  assert.ok(!isImageMime('text/plain'));
  assert.ok(!isImageMime('application/json'));
  assert.ok(!isImageMime(''));
  assert.ok(!isImageMime());
});
