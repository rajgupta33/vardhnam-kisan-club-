import { StoredFilePurpose } from '@prisma/client';
import {
  isClientUploadablePurpose,
  normaliseContentType,
  uploadPolicyFor,
} from '../src/storage/upload-policy';

describe('upload policy', () => {
  it('defines a policy for every purpose', () => {
    for (const purpose of Object.values(StoredFilePurpose)) {
      const policy = uploadPolicyFor(purpose);
      expect(policy.allowedContentTypes.length).toBeGreaterThan(0);
      expect(policy.maxSizeBytes).toBeGreaterThan(0);
    }
  });

  it('audits downloads of the purposes that carry PII or financial record', () => {
    expect(uploadPolicyFor(StoredFilePurpose.KYC_DOCUMENT).auditDownloads).toBe(true);
    expect(uploadPolicyFor(StoredFilePurpose.INVOICE_PDF).auditDownloads).toBe(true);
    expect(uploadPolicyFor(StoredFilePurpose.CREDIT_NOTE_PDF).auditDownloads).toBe(true);
    expect(uploadPolicyFor(StoredFilePurpose.PRODUCT_IMAGE).auditDownloads).toBe(false);
  });

  it('never allows an executable or script content type', () => {
    const forbidden = [
      'application/x-msdownload',
      'application/javascript',
      'text/html',
      'application/octet-stream',
    ];

    for (const purpose of Object.values(StoredFilePurpose)) {
      for (const type of forbidden) {
        expect(uploadPolicyFor(purpose).allowedContentTypes).not.toContain(type);
      }
    }
  });

  it('refuses client uploads for platform-generated invoices', () => {
    // Otherwise a farmer or distributor could supply their own "invoice".
    expect(isClientUploadablePurpose(StoredFilePurpose.INVOICE_PDF)).toBe(false);
    expect(isClientUploadablePurpose(StoredFilePurpose.CREDIT_NOTE_PDF)).toBe(false);
    expect(isClientUploadablePurpose(StoredFilePurpose.KYC_DOCUMENT)).toBe(true);
  });

  it('normalises content types with parameters and casing', () => {
    expect(normaliseContentType('image/JPEG; charset=binary')).toBe('image/jpeg');
    expect(normaliseContentType('  application/pdf  ')).toBe('application/pdf');
  });

  it('keeps field-captured evidence small enough to upload on a poor connection', () => {
    const fieldPurposes = [
      StoredFilePurpose.DELIVERY_PROOF,
      StoredFilePurpose.RETURN_EVIDENCE,
      StoredFilePurpose.VISIT_EVIDENCE,
    ];

    for (const purpose of fieldPurposes) {
      expect(uploadPolicyFor(purpose).maxSizeBytes).toBeLessThanOrEqual(5 * 1024 * 1024);
    }
  });
});
