import { dirname, join } from 'node:path';
import PDFDocument from 'pdfkit';
import { rupeesInWords } from '../checkout/invoice-pdf.renderer';

export interface CreditNotePdfLine {
  productNameSnapshot: string;
  variantNameSnapshot: string;
  hsnCode: string;
  quantity: number;
  gstRateBps: number;
  taxableAmountPaise: number;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
  grossCreditPaise: number;
}

export interface CreditNotePdfInput {
  creditNoteNumber: string;
  issuedAt: Date;
  originalInvoiceNumber: string;
  originalInvoiceDate: Date;
  sellerLegalName: string;
  sellerGstin: string;
  sellerStateCode: string;
  sellerAddress: string;
  farmerName: string;
  deliveryAddress: Record<string, unknown>;
  placeOfSupplyStateCode: string;
  reason: string;
  lines: CreditNotePdfLine[];
  taxableAmountPaise: number;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
  taxPaise: number;
  grossCreditPaise: number;
  farmerRefundPaise: number;
  subsidyReversalPaise: number;
}

function money(paise: number): string {
  return `INR ${(paise / 100).toFixed(2)}`;
}

function addressText(address: Record<string, unknown>): string {
  return ['recipientName', 'addressLine1', 'addressLine2', 'village', 'city', 'district', 'state', 'pincode']
    .map((key) => address[key])
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .join(', ');
}

export async function renderCreditNotePdf(input: CreditNotePdfInput): Promise<Buffer> {
  const document = new PDFDocument({
    size: 'A4',
    margin: 40,
    info: { Title: `Credit Note ${input.creditNoteNumber}` },
  });
  const packageRoot = dirname(require.resolve('@ibm/plex-sans-devanagari/package.json'));
  document.registerFont('Regular', join(packageRoot, 'fonts/complete/woff/IBMPlexSansDevanagari-Regular.woff'));
  document.registerFont('Bold', join(packageRoot, 'fonts/complete/woff/IBMPlexSansDevanagari-Bold.woff'));
  document.font('Regular');
  const chunks: Buffer[] = [];
  document.on('data', (chunk: Buffer) => chunks.push(chunk));
  const completed = new Promise<Buffer>((resolve, reject) => {
    document.on('end', () => resolve(Buffer.concat(chunks)));
    document.on('error', reject);
  });

  document.font('Bold').fontSize(18).text('CREDIT NOTE', { align: 'center' });
  document.moveDown(0.5).fontSize(11).text(input.sellerLegalName);
  document.font('Regular').fontSize(9);
  document.text(`GSTIN: ${input.sellerGstin} | State code: ${input.sellerStateCode}`);
  document.text(`Address: ${input.sellerAddress}`);
  document.text(`Credit note: ${input.creditNoteNumber}`);
  document.text(`Date: ${input.issuedAt.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })}`);
  document.text(
    `Original invoice: ${input.originalInvoiceNumber} dated ${input.originalInvoiceDate.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })}`,
  );
  document.moveDown(0.5).font('Bold').text('Recipient');
  document.font('Regular').text(`${input.farmerName}\n${addressText(input.deliveryAddress)}`);
  document.text(`Place of supply state code: ${input.placeOfSupplyStateCode}`);
  document.text(`Reason: ${input.reason}`);
  document.moveDown().font('Bold').text('Credited items');

  for (const [index, line] of input.lines.entries()) {
    document.moveDown(0.25).font('Bold').fontSize(9).text(
      `${index + 1}. ${line.productNameSnapshot} - ${line.variantNameSnapshot}`,
    );
    document.font('Regular').fontSize(8).text(
      `HSN ${line.hsnCode} | Qty ${line.quantity} | GST ${(line.gstRateBps / 100).toFixed(2)}% | Taxable ${money(line.taxableAmountPaise)} | CGST ${money(line.cgstPaise)} | SGST ${money(line.sgstPaise)} | IGST ${money(line.igstPaise)} | Credit ${money(line.grossCreditPaise)}`,
    );
  }

  document.moveDown().font('Bold').fontSize(9);
  document.text(`Taxable amount: ${money(input.taxableAmountPaise)}`, { align: 'right' });
  document.text(`CGST: ${money(input.cgstPaise)}  SGST: ${money(input.sgstPaise)}  IGST: ${money(input.igstPaise)}`, { align: 'right' });
  document.text(`Total tax: ${money(input.taxPaise)}`, { align: 'right' });
  document.fontSize(11).text(`Gross credit: ${money(input.grossCreditPaise)}`, { align: 'right' });
  document.font('Regular').fontSize(8).text(`Amount in words: ${rupeesInWords(input.grossCreditPaise)}`);
  document.text(`Farmer refund: ${money(input.farmerRefundPaise)}`);
  if (input.subsidyReversalPaise > 0) {
    document.text(`Platform subsidy reversal: ${money(input.subsidyReversalPaise)}`);
  }
  document.moveDown(2).text('This is a computer-generated GST credit note.', { align: 'center' });
  document.end();
  return completed;
}
