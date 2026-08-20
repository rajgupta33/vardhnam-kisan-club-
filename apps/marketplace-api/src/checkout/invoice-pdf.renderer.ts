import { dirname, join } from 'node:path';
import PDFDocument from 'pdfkit';

export interface InvoicePdfLine {
  productNameSnapshot: string;
  variantNameSnapshot: string;
  hsnCode: string;
  quantity: number;
  gstRateBps: number;
  taxableAmountPaise: number;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
  lineTotalPaise: number;
}

export interface InvoicePdfInput {
  invoiceNumber: string;
  generatedAt: Date;
  sellerLegalName: string;
  sellerGstin: string;
  sellerStateCode: string;
  sellerAddress: string;
  farmerName: string;
  deliveryAddress: Record<string, unknown>;
  placeOfSupplyStateCode: string;
  lines: InvoicePdfLine[];
  taxableAmountPaise: number;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
  taxPaise: number;
  totalPaise: number;
}

const ONES = [
  '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
  'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
  'Seventeen', 'Eighteen', 'Nineteen',
] as const;
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'] as const;

function underThousand(value: number): string {
  const words: string[] = [];
  if (value >= 100) {
    words.push(ONES[Math.floor(value / 100)]!, 'Hundred');
    value %= 100;
  }
  if (value >= 20) {
    words.push(TENS[Math.floor(value / 10)]!);
    value %= 10;
  }
  if (value > 0) words.push(ONES[value]!);
  return words.join(' ');
}

export function rupeesInWords(paise: number): string {
  let rupees = Math.floor(paise / 100);
  if (rupees === 0) return 'Zero Rupees Only';
  const groups: Array<[number, string]> = [
    [10_000_000, 'Crore'],
    [100_000, 'Lakh'],
    [1_000, 'Thousand'],
  ];
  const words: string[] = [];
  for (const [size, label] of groups) {
    const count = Math.floor(rupees / size);
    if (count > 0) {
      words.push(underThousand(count), label);
      rupees %= size;
    }
  }
  if (rupees > 0) words.push(underThousand(rupees));
  return `${words.join(' ')} Rupees Only`;
}

function money(paise: number): string {
  return `INR ${(paise / 100).toFixed(2)}`;
}

function addressText(address: Record<string, unknown>): string {
  const keys = ['recipientName', 'addressLine1', 'addressLine2', 'village', 'city', 'district', 'state', 'pincode'];
  return keys
    .map((key) => address[key])
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .join(', ');
}

/** Produces a deterministic, embedded-font GST invoice PDF from immutable snapshots. */
export async function renderInvoicePdf(input: InvoicePdfInput): Promise<Buffer> {
  const document = new PDFDocument({ size: 'A4', margin: 40, info: { Title: `Tax Invoice ${input.invoiceNumber}` } });
  const packageRoot = dirname(require.resolve('@ibm/plex-sans-devanagari/package.json'));
  document.registerFont('InvoiceRegular', join(packageRoot, 'fonts/complete/woff/IBMPlexSansDevanagari-Regular.woff'));
  document.registerFont('InvoiceBold', join(packageRoot, 'fonts/complete/woff/IBMPlexSansDevanagari-Bold.woff'));
  document.font('InvoiceRegular');

  const chunks: Buffer[] = [];
  document.on('data', (chunk: Buffer) => chunks.push(chunk));
  const completed = new Promise<Buffer>((resolve, reject) => {
    document.on('end', () => resolve(Buffer.concat(chunks)));
    document.on('error', reject);
  });

  document.font('InvoiceBold').fontSize(18).text('TAX INVOICE', { align: 'center' });
  document.moveDown(0.5).fontSize(11).text(input.sellerLegalName);
  document.font('InvoiceRegular').fontSize(9);
  document.text(`GSTIN: ${input.sellerGstin}  |  State code: ${input.sellerStateCode}`);
  document.text(`Address: ${input.sellerAddress}`);
  document.text(`Invoice: ${input.invoiceNumber}`);
  document.text(`Date: ${input.generatedAt.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })}`);
  document.moveDown(0.5).font('InvoiceBold').text('Bill / Ship to');
  document.font('InvoiceRegular').text(`${input.farmerName}\n${addressText(input.deliveryAddress)}`);
  document.text(`Place of supply state code: ${input.placeOfSupplyStateCode}`);
  document.moveDown();

  document.font('InvoiceBold').text('Items');
  document.moveDown(0.25);
  for (const [index, line] of input.lines.entries()) {
    document.font('InvoiceBold').fontSize(9).text(`${index + 1}. ${line.productNameSnapshot} - ${line.variantNameSnapshot}`);
    document.font('InvoiceRegular').fontSize(8).text(
      `HSN ${line.hsnCode} | Qty ${line.quantity} | GST ${(line.gstRateBps / 100).toFixed(2)}% | Taxable ${money(line.taxableAmountPaise)} | CGST ${money(line.cgstPaise)} | SGST ${money(line.sgstPaise)} | IGST ${money(line.igstPaise)} | Total ${money(line.lineTotalPaise)}`,
    );
    document.moveDown(0.3);
  }

  document.moveDown().font('InvoiceBold').fontSize(9);
  document.text(`Taxable amount: ${money(input.taxableAmountPaise)}`, { align: 'right' });
  document.text(`CGST: ${money(input.cgstPaise)}  SGST: ${money(input.sgstPaise)}  IGST: ${money(input.igstPaise)}`, { align: 'right' });
  document.text(`Total tax: ${money(input.taxPaise)}`, { align: 'right' });
  document.fontSize(11).text(`Invoice total: ${money(input.totalPaise)}`, { align: 'right' });
  document.moveDown().font('InvoiceRegular').fontSize(8).text(`Amount in words: ${rupeesInWords(input.totalPaise)}`);
  document.moveDown(2).text('This is a computer-generated tax invoice.', { align: 'center' });
  document.end();
  return completed;
}
