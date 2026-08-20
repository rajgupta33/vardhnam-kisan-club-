import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { requireHttpDownloadUrl } from './document-download';

describe('document download URL validation', () => {
  it('accepts local HTTP and production HTTPS signed URLs', () => {
    assert.equal(
      requireHttpDownloadUrl('http://127.0.0.1:3001/api/v1/storage/object?token=abc'),
      'http://127.0.0.1:3001/api/v1/storage/object?token=abc',
    );
    assert.equal(
      requireHttpDownloadUrl('https://files.example/invoice.pdf?signature=abc'),
      'https://files.example/invoice.pdf?signature=abc',
    );
  });

  it('rejects non-web redirect schemes', () => {
    assert.throws(() => requireHttpDownloadUrl('javascript:alert(1)'), /unsupported/);
  });
});
