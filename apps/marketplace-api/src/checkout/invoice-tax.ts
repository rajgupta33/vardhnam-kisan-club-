export interface InvoiceTaxLineInput {
  productOrderItemId: string;
  grossAmountPaise: number;
  hsnCode: string;
  gstRateBps: number;
}

export interface InvoiceTaxLine extends InvoiceTaxLineInput {
  taxableAmountPaise: number;
  taxPaise: number;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
}

export interface InvoiceTaxCalculation {
  taxableAmountPaise: number;
  taxPaise: number;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
  totalPaise: number;
  lines: InvoiceTaxLine[];
}

/**
 * Extracts GST from tax-inclusive selling prices, rounding once per order line.
 * The odd-paisa remainder for intra-state tax is assigned to SGST so the
 * persisted breakup always reconciles exactly to the amount the farmer paid.
 * This engineering rule remains subject to the required CA sign-off.
 */
export function calculateInclusiveInvoiceTax(
  lines: InvoiceTaxLineInput[],
  sellerStateCode: string,
  placeOfSupplyStateCode: string,
): InvoiceTaxCalculation {
  const intraState = sellerStateCode === placeOfSupplyStateCode;
  const calculatedLines = lines.map((line) => {
    const taxPaise = roundFraction(
      BigInt(line.grossAmountPaise) * BigInt(line.gstRateBps),
      BigInt(10_000 + line.gstRateBps),
    );
    const taxableAmountPaise = line.grossAmountPaise - taxPaise;
    const cgstPaise = intraState ? Math.floor(taxPaise / 2) : 0;
    const sgstPaise = intraState ? taxPaise - cgstPaise : 0;
    const igstPaise = intraState ? 0 : taxPaise;
    return { ...line, taxableAmountPaise, taxPaise, cgstPaise, sgstPaise, igstPaise };
  });

  return calculatedLines.reduce<InvoiceTaxCalculation>(
    (total, line) => ({
      taxableAmountPaise: total.taxableAmountPaise + line.taxableAmountPaise,
      taxPaise: total.taxPaise + line.taxPaise,
      cgstPaise: total.cgstPaise + line.cgstPaise,
      sgstPaise: total.sgstPaise + line.sgstPaise,
      igstPaise: total.igstPaise + line.igstPaise,
      totalPaise: total.totalPaise + line.grossAmountPaise,
      lines: [...total.lines, line],
    }),
    {
      taxableAmountPaise: 0,
      taxPaise: 0,
      cgstPaise: 0,
      sgstPaise: 0,
      igstPaise: 0,
      totalPaise: 0,
      lines: [],
    },
  );
}

export function indianFinancialYear(at: Date): string {
  const indiaTime = new Date(at.getTime() + 330 * 60 * 1_000);
  const year = indiaTime.getUTCFullYear();
  const startYear = indiaTime.getUTCMonth() >= 3 ? year : year - 1;
  return `${startYear}-${String(startYear + 1).slice(-2)}`;
}

function roundFraction(numerator: bigint, denominator: bigint): number {
  const rounded = (numerator + denominator / 2n) / denominator;
  const value = Number(rounded);
  if (!Number.isSafeInteger(value)) throw new Error('Calculated GST amount exceeds safe integer');
  return value;
}
