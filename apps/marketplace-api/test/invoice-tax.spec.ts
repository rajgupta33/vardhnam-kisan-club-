import { calculateInclusiveInvoiceTax, indianFinancialYear } from '../src/checkout/invoice-tax';

describe('invoice tax calculation', () => {
  const lines = [
    { productOrderItemId: 'zero', grossAmountPaise: 1_000, hsnCode: '1008', gstRateBps: 0 },
    { productOrderItemId: 'five', grossAmountPaise: 10_500, hsnCode: '1006', gstRateBps: 500 },
    {
      productOrderItemId: 'eighteen',
      grossAmountPaise: 11_800,
      hsnCode: '3808',
      gstRateBps: 1_800,
    },
  ];

  it('extracts inclusive intra-state GST and reconciles every paise', () => {
    const result = calculateInclusiveInvoiceTax(lines, '08', '08');

    expect(result).toMatchObject({
      taxableAmountPaise: 21_000,
      taxPaise: 2_300,
      cgstPaise: 1_150,
      sgstPaise: 1_150,
      igstPaise: 0,
      totalPaise: 23_300,
    });
    expect(
      result.lines.every(
        (line) => line.taxableAmountPaise + line.taxPaise === line.grossAmountPaise,
      ),
    ).toBe(true);
  });

  it('uses IGST for an inter-state supply', () => {
    const result = calculateInclusiveInvoiceTax(lines, '08', '27');

    expect(result).toMatchObject({
      taxableAmountPaise: 21_000,
      taxPaise: 2_300,
      cgstPaise: 0,
      sgstPaise: 0,
      igstPaise: 2_300,
      totalPaise: 23_300,
    });
  });

  it('assigns an odd intra-state tax paise to SGST', () => {
    const result = calculateInclusiveInvoiceTax(
      [{ productOrderItemId: 'odd', grossAmountPaise: 315, hsnCode: '1008', gstRateBps: 500 }],
      '08',
      '08',
    );

    expect(result.lines[0]).toMatchObject({ taxPaise: 15, cgstPaise: 7, sgstPaise: 8 });
  });
});

describe('Indian financial year', () => {
  it.each([
    ['2026-03-31T18:29:59.999Z', '2025-26'],
    ['2026-03-31T18:30:00.000Z', '2026-27'],
  ])('maps %s to %s at the Asia/Kolkata boundary', (timestamp, expected) => {
    expect(indianFinancialYear(new Date(timestamp))).toBe(expected);
  });
});
