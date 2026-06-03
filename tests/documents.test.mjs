import assert from 'node:assert/strict';
import test from 'node:test';

import {
  isTextLike,
  extractText,
  summarizeDocument,
  documentFacts
} from '../server/modules/documents.mjs';

test('isTextLike detects common text extensions', () => {
  assert.ok(isTextLike('readme.txt'));
  assert.ok(isTextLike('notes.md'));
  assert.ok(isTextLike('data.csv'));
  assert.ok(isTextLike('config.json'));
  assert.ok(isTextLike('layout.xml'));
  assert.ok(isTextLike('page.html'));
  assert.ok(isTextLike('page.htm'));
  assert.ok(isTextLike('output.log'));
  assert.ok(isTextLike('config.yaml'));
  assert.ok(isTextLike('config.yml'));
});

test('isTextLike detects by MIME type', () => {
  assert.ok(isTextLike('file.unknown', 'text/plain'));
  assert.ok(isTextLike('file.unknown', 'text/csv'));
  assert.ok(isTextLike('file.unknown', 'application/json'));
  assert.ok(isTextLike('file.unknown', 'application/xml'));
});

test('isTextLike rejects non-text files', () => {
  assert.ok(!isTextLike('image.png'));
  assert.ok(!isTextLike('archive.zip'));
  assert.ok(!isTextLike('binary.exe'));
  assert.ok(!isTextLike('photo.jpg', 'image/jpeg'));
});

test('isTextLike handles edge cases', () => {
  assert.ok(!isTextLike(''));
  assert.ok(!isTextLike(undefined));
});

test('extractText extracts from text files', () => {
  const buffer = Buffer.from('Hello, this is a text file content.');
  const result = extractText(buffer, 'test.txt', 'text/plain');
  assert.ok(result.includes('Hello'));
});

test('extractText returns empty for unsupported types', () => {
  const buffer = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
  const result = extractText(buffer, 'image.png', 'image/png');
  assert.equal(result, '');
});

test('extractText strips carriage returns', () => {
  const buffer = Buffer.from('line1\r\nline2\r\n');
  const result = extractText(buffer, 'file.txt', 'text/plain');
  assert.ok(!result.includes('\r'));
  assert.ok(result.includes('line1\nline2'));
});

test('summarizeDocument provides word and line counts', () => {
  const text = 'This is a long enough sentence that should be included as opening content for the summary.';
  const result = summarizeDocument(text, 'readme.txt');
  assert.ok(result.includes('words'));
  assert.ok(result.includes('text blocks'));
  assert.ok(result.includes('Opening content'));
});

test('summarizeDocument handles empty text', () => {
  const result = summarizeDocument('', 'empty.txt');
  assert.ok(result.includes('empty.txt'));
  assert.ok(result.includes('Text extraction was not available'));
});

test('summarizeDocument handles null text', () => {
  const result = summarizeDocument(null, 'null.txt');
  assert.ok(result.includes('null.txt'));
});

test('documentFacts returns facts for upload with text', () => {
  const upload = {
    name: 'report.txt',
    mime: 'text/plain',
    extractedText: 'Some extracted content here.',
    summary: 'Extracted 5 words across 1 text blocks.'
  };
  const facts = documentFacts(upload);
  assert.ok(facts.length >= 1);
  assert.ok(facts.some((f) => f.includes('report.txt')));
  assert.ok(facts.some((f) => f.includes('extracted text available')));
});

test('documentFacts returns facts for upload without text', () => {
  const upload = {
    name: 'photo.jpg',
    mime: 'image/jpeg',
    extractedText: '',
    summary: ''
  };
  const facts = documentFacts(upload);
  assert.ok(facts.length >= 1);
  assert.ok(facts.some((f) => f.includes('photo.jpg')));
  assert.ok(facts.some((f) => f.includes('no local text layer')));
});
