import { renderInvoicePdf, rupeesInWords } from '../src/checkout/invoice-pdf.renderer';

describe('invoice PDF renderer', () => {
  it('renders a GST invoice with embedded Devanagari-capable fonts', async () => {
    const pdf = await renderInvoicePdf({
      invoiceNumber: 'A123/27/1',
      generatedAt: new Date('2026-08-19T06:30:00.000Z'),
      sellerLegalName: 'वर्धनम् एग्रो डिस्ट्रीब्यूटर',
      sellerGstin: '27ABCDE1234F1Z5',
      sellerStateCode: '27',
      sellerAddress: 'Market Yard, Nashik, Maharashtra 422001',
      farmerName: 'राज किसान',
      deliveryAddress: {
        recipientName: 'राज किसान',
        addressLine1: 'खेत मार्ग',
        village: 'नाशिक',
        state: 'महाराष्ट्र',
        pincode: '422001',
      },
      placeOfSupplyStateCode: '27',
      lines: [
        {
          productNameSnapshot: 'बीज',
          variantNameSnapshot: 'एक किलो',
          hsnCode: '1209',
          quantity: 2,
          gstRateBps: 500,
          taxableAmountPaise: 19_048,
          cgstPaise: 476,
          sgstPaise: 476,
          igstPaise: 0,
          lineTotalPaise: 20_000,
        },
      ],
      taxableAmountPaise: 19_048,
      cgstPaise: 476,
      sgstPaise: 476,
      igstPaise: 0,
      taxPaise: 952,
      totalPaise: 20_000,
    });

    expect(pdf.subarray(0, 5).toString('ascii')).toBe('%PDF-');
    expect(pdf.length).toBeGreaterThan(5_000);
  });

  it('spells Indian currency totals without floating-point arithmetic', () => {
    expect(rupeesInWords(12_34_56_700)).toBe(
      'Twelve Lakh Thirty Four Thousand Five Hundred Sixty Seven Rupees Only',
    );
    expect(rupeesInWords(0)).toBe('Zero Rupees Only');
  });
});
