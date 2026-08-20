import { renderCreditNotePdf } from '../src/refunds/credit-note-pdf.renderer';

describe('credit note PDF renderer', () => {
  it('renders a Devanagari-capable GST credit note linked to the original invoice', async () => {
    const pdf = await renderCreditNotePdf({
      creditNoteNumber: 'CN0000/27/000001',
      issuedAt: new Date('2026-08-19T06:00:00.000Z'),
      originalInvoiceNumber: '0000/27/000001',
      originalInvoiceDate: new Date('2026-08-18T06:00:00.000Z'),
      sellerLegalName: 'वर्धनम् वितरक प्राइवेट लिमिटेड',
      sellerGstin: '08ABCDE1234F1Z5',
      sellerStateCode: '08',
      sellerAddress: 'जयपुर, राजस्थान 302001',
      farmerName: 'राज किसान',
      deliveryAddress: { addressLine1: 'खेत मार्ग', state: 'राजस्थान', pincode: '302001' },
      placeOfSupplyStateCode: '08',
      reason: 'Damaged goods returned',
      lines: [
        {
          productNameSnapshot: 'बीज', variantNameSnapshot: '1 kg', hsnCode: '1209', quantity: 1,
          gstRateBps: 500, taxableAmountPaise: 10_000, cgstPaise: 250, sgstPaise: 250,
          igstPaise: 0, grossCreditPaise: 10_500,
        },
      ],
      taxableAmountPaise: 10_000,
      cgstPaise: 250,
      sgstPaise: 250,
      igstPaise: 0,
      taxPaise: 500,
      grossCreditPaise: 10_500,
      farmerRefundPaise: 9_500,
      subsidyReversalPaise: 1_000,
    });
    expect(pdf.subarray(0, 5).toString('ascii')).toBe('%PDF-');
    expect(pdf.length).toBeGreaterThan(5_000);
  });
});
