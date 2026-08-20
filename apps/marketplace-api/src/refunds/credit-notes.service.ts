import { createHash } from 'node:crypto';
import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  CreditNoteDocumentStatus,
  Prisma,
  ReturnInspectionOutcome,
  StoredFilePurpose,
  StoredFileScanResult,
  StoredFileStatus,
} from '@prisma/client';
import { AccessService } from '../access/access.service';
import { PermissionCode } from '../access/permission-codes';
import { AuditService } from '../audit/audit.service';
import type { CurrentUser } from '../auth/current-user.interface';
import { ApiErrorCode } from '../common/errors/api-error-codes';
import { calculateInclusiveInvoiceTax, indianFinancialYear } from '../checkout/invoice-tax';
import { DocumentJob, QueueName } from '../jobs/queue-names';
import { QueueService } from '../jobs/queue.service';
import { PrismaService } from '../prisma/prisma.service';
import { FilesService } from '../storage/files.service';
import { STORAGE_PROVIDER, type StorageProvider } from '../storage/storage.provider.interface';
import { renderCreditNotePdf, type CreditNotePdfLine } from './credit-note-pdf.renderer';

const detailInclude = Prisma.validator<Prisma.CreditNoteInclude>()({
  document: { include: { storedFile: true } },
  refund: { select: { farmerUserId: true } },
});

type CreditNoteDetail = Prisma.CreditNoteGetPayload<{ include: typeof detailInclude }>;

export function creditNotePdfJobId(documentId: string): string {
  return `credit-note-pdf-${documentId}`;
}

@Injectable()
export class CreditNotesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accessService: AccessService,
    private readonly auditService: AuditService,
    private readonly queueService: QueueService,
    private readonly filesService: FilesService,
    @Inject(STORAGE_PROVIDER) private readonly storage: StorageProvider,
  ) {}

  async issueForSucceededRefund(
    tx: Prisma.TransactionClient,
    refundId: string,
    actor: CurrentUser,
    requestId?: string,
  ): Promise<string> {
    const existing = await tx.creditNote.findUnique({
      where: { refundId },
      select: { document: { select: { id: true } } },
    });
    if (existing?.document) return existing.document.id;

    const refund = await tx.refund.findUniqueOrThrow({
      where: { id: refundId },
      include: {
        productOrder: { include: { invoice: true } },
        returnRequest: {
          include: {
            items: true,
            inspectionDispositions: true,
          },
        },
      },
    });
    const invoice = refund.productOrder.invoice;
    const returned = refund.returnRequest;
    if (!invoice || !returned) {
      throw new Error('A succeeded return refund requires its original invoice and return request');
    }
    if (
      !invoice.sellerGstinSnapshot ||
      !invoice.sellerStateCodeSnapshot ||
      !invoice.sellerAddressSnapshot ||
      !invoice.placeOfSupplyStateCode
    ) {
      throw new Error('Original invoice is missing required seller or place-of-supply snapshots');
    }

    const invoiceLines = this.invoiceLines(invoice.lineItemsSnapshot);
    const byOrderItem = new Map(invoiceLines.map((line) => [line.productOrderItemId, line]));
    const acceptedByReturnItem = new Map<string, number>();
    for (const disposition of returned.inspectionDispositions) {
      if (disposition.outcome === ReturnInspectionOutcome.REJECTED_RETURN) continue;
      acceptedByReturnItem.set(
        disposition.returnRequestItemId,
        (acceptedByReturnItem.get(disposition.returnRequestItemId) ?? 0) + disposition.quantity,
      );
    }

    const accepted = returned.items.flatMap((item) => {
      const quantity = acceptedByReturnItem.get(item.id) ?? 0;
      if (quantity === 0) return [];
      const original = byOrderItem.get(item.productOrderItemId);
      if (!original) throw new Error(`Original invoice line missing for returned item ${item.id}`);
      return [{ item, quantity, original, grossAmountPaise: item.unitPricePaise * quantity }];
    });
    if (accepted.length === 0) throw new Error('Succeeded refund has no accepted return quantity');

    const tax = calculateInclusiveInvoiceTax(
      accepted.map(({ item, original, grossAmountPaise }) => ({
        productOrderItemId: item.productOrderItemId,
        grossAmountPaise,
        hsnCode: original.hsnCode,
        gstRateBps: original.gstRateBps,
      })),
      invoice.sellerStateCodeSnapshot,
      invoice.placeOfSupplyStateCode,
    );
    const taxByOrderItem = new Map(tax.lines.map((line) => [line.productOrderItemId, line]));
    const lineItemsSnapshot = accepted.map(({ item, quantity, original, grossAmountPaise }) => {
      const lineTax = taxByOrderItem.get(item.productOrderItemId)!;
      return {
        productOrderItemId: item.productOrderItemId,
        returnRequestItemId: item.id,
        productNameSnapshot: original.productNameSnapshot,
        variantNameSnapshot: original.variantNameSnapshot,
        hsnCode: original.hsnCode,
        gstRateBps: original.gstRateBps,
        quantity,
        unitPricePaise: item.unitPricePaise,
        grossCreditPaise: grossAmountPaise,
        taxableAmountPaise: lineTax.taxableAmountPaise,
        taxPaise: lineTax.taxPaise,
        cgstPaise: lineTax.cgstPaise,
        sgstPaise: lineTax.sgstPaise,
        igstPaise: lineTax.igstPaise,
      };
    });
    const subsidyReversalPaise = tax.totalPaise - refund.amountPaise;
    if (subsidyReversalPaise < 0) throw new Error('Refund exceeds accepted returned goods value');

    const issuedAt = new Date();
    const financialYear = indianFinancialYear(issuedAt);
    const sequence = await tx.creditNoteSequence.upsert({
      where: {
        sellerOrganisationId_financialYear: {
          sellerOrganisationId: invoice.sellerOrganisationId,
          financialYear,
        },
      },
      create: { sellerOrganisationId: invoice.sellerOrganisationId, financialYear, lastNumber: 1 },
      update: { lastNumber: { increment: 1 } },
    });
    const creditNoteNumber = this.formatNumber(
      invoice.sellerOrganisationId,
      financialYear,
      sequence.lastNumber,
    );
    const deliveryAddressSnapshot = this.objectSnapshot(invoice.deliveryAddressSnapshot);
    const creditNote = await tx.creditNote.create({
      data: {
        refundId: refund.id,
        productInvoiceId: invoice.id,
        productOrderId: refund.productOrderId,
        returnRequestId: returned.id,
        sellerOrganisationId: invoice.sellerOrganisationId,
        creditNoteNumber,
        financialYear,
        sequenceNumber: sequence.lastNumber,
        grossCreditPaise: tax.totalPaise,
        farmerRefundPaise: refund.amountPaise,
        subsidyReversalPaise,
        taxableAmountPaise: tax.taxableAmountPaise,
        taxPaise: tax.taxPaise,
        cgstPaise: tax.cgstPaise,
        sgstPaise: tax.sgstPaise,
        igstPaise: tax.igstPaise,
        originalInvoiceNumber: invoice.invoiceNumber,
        originalInvoiceDate: invoice.generatedAt,
        reasonSnapshot: returned.reasonNote?.trim() || returned.reasonCode,
        sellerLegalNameSnapshot: invoice.sellerLegalNameSnapshot,
        sellerGstinSnapshot: invoice.sellerGstinSnapshot,
        sellerStateCodeSnapshot: invoice.sellerStateCodeSnapshot,
        sellerAddressSnapshot: invoice.sellerAddressSnapshot,
        farmerNameSnapshot: invoice.farmerNameSnapshot,
        deliveryAddressSnapshot: deliveryAddressSnapshot as Prisma.InputJsonObject,
        placeOfSupplyStateCode: invoice.placeOfSupplyStateCode,
        lineItemsSnapshot,
        issuedAt,
      },
    });
    const document = await tx.creditNoteDocument.create({
      data: {
        creditNoteId: creditNote.id,
        ...(requestId ? { requestId } : {}),
      },
    });
    await this.auditService.record(
      {
        actorUserId: actor.userId,
        actorRole: actor.role,
        organisationId: invoice.sellerOrganisationId,
        action: 'CREDIT_NOTE_ISSUED',
        resourceType: 'CreditNote',
        resourceId: creditNote.id,
        newValue: {
          refundId: refund.id,
          creditNoteNumber,
          originalInvoiceNumber: invoice.invoiceNumber,
          grossCreditPaise: tax.totalPaise,
          farmerRefundPaise: refund.amountPaise,
          subsidyReversalPaise,
          taxPaise: tax.taxPaise,
        },
        requestId,
        reason: 'Credit note issued for accepted returned goods after refund success',
      },
      tx,
    );
    return document.id;
  }

  async enqueue(documentId: string, requestId?: string): Promise<void> {
    await this.queueService.enqueue(
      QueueName.DOCUMENTS,
      DocumentJob.GENERATE_CREDIT_NOTE_PDF,
      { creditNoteDocumentId: documentId },
      { ...(requestId ? { requestId } : {}), jobId: creditNotePdfJobId(documentId) },
    );
  }

  async get(refundId: string, actor: CurrentUser) {
    const note = await this.findForRefund(refundId);
    this.assertCanRead(note, actor);
    return this.present(note);
  }

  async getDownload(refundId: string, actor: CurrentUser, requestId?: string) {
    const note = await this.findForRefund(refundId);
    this.assertCanRead(note, actor);
    if (!note.document?.storedFileId) {
      throw new NotFoundException({ code: ApiErrorCode.NOT_FOUND, message: 'Credit note PDF is not available' });
    }
    return this.filesService.getDownloadUrl(note.document.storedFileId, actor, requestId);
  }

  async generate(documentId: string): Promise<{ storedFileId?: string; skipped?: boolean }> {
    const staleBefore = new Date(Date.now() - 15 * 60_000);
    const claim = await this.prisma.creditNoteDocument.updateMany({
      where: {
        id: documentId,
        OR: [
          { status: CreditNoteDocumentStatus.QUEUED },
          { status: CreditNoteDocumentStatus.FAILED },
          { status: CreditNoteDocumentStatus.PROCESSING, updatedAt: { lt: staleBefore } },
        ],
      },
      data: { status: CreditNoteDocumentStatus.PROCESSING, attemptCount: { increment: 1 }, lastError: null },
    });
    if (claim.count === 0) {
      const existing = await this.prisma.creditNoteDocument.findUnique({ where: { id: documentId } });
      return { ...(existing?.storedFileId ? { storedFileId: existing.storedFileId } : {}), skipped: true };
    }
    const document = await this.prisma.creditNoteDocument.findUnique({
      where: { id: documentId },
      include: { creditNote: { include: { refund: { select: { farmerUserId: true } } } } },
    });
    if (!document) return { skipped: true };

    try {
      const note = document.creditNote;
      const pdf = await renderCreditNotePdf({
        creditNoteNumber: note.creditNoteNumber,
        issuedAt: note.issuedAt,
        originalInvoiceNumber: note.originalInvoiceNumber,
        originalInvoiceDate: note.originalInvoiceDate,
        sellerLegalName: note.sellerLegalNameSnapshot,
        sellerGstin: note.sellerGstinSnapshot,
        sellerStateCode: note.sellerStateCodeSnapshot,
        sellerAddress: note.sellerAddressSnapshot,
        farmerName: note.farmerNameSnapshot,
        deliveryAddress: this.objectSnapshot(note.deliveryAddressSnapshot),
        placeOfSupplyStateCode: note.placeOfSupplyStateCode,
        reason: note.reasonSnapshot,
        lines: this.creditLines(note.lineItemsSnapshot),
        taxableAmountPaise: note.taxableAmountPaise,
        cgstPaise: note.cgstPaise,
        sgstPaise: note.sgstPaise,
        igstPaise: note.igstPaise,
        taxPaise: note.taxPaise,
        grossCreditPaise: note.grossCreditPaise,
        farmerRefundPaise: note.farmerRefundPaise,
        subsidyReversalPaise: note.subsidyReversalPaise,
      });
      const checksum = createHash('sha256').update(pdf).digest('hex');
      const yyyymm = `${note.issuedAt.getUTCFullYear()}${String(note.issuedAt.getUTCMonth() + 1).padStart(2, '0')}`;
      const objectKey = `credit_note_pdf/${yyyymm}/${documentId}.pdf`;
      await this.storage.write(objectKey, pdf, 'application/pdf');
      const generatedAt = new Date();
      const file = await this.prisma.$transaction(async (tx) => {
        const stored = await tx.storedFile.create({
          data: {
            ownerUserId: note.refund.farmerUserId,
            organisationId: note.sellerOrganisationId,
            purpose: StoredFilePurpose.CREDIT_NOTE_PDF,
            status: StoredFileStatus.AVAILABLE,
            objectKey,
            originalFilename: `credit-note-${note.creditNoteNumber.replace(/[^A-Za-z0-9-]/g, '-')}.pdf`,
            contentType: 'application/pdf',
            declaredSizeBytes: pdf.length,
            sizeBytes: pdf.length,
            checksumSha256: checksum,
            scanResult: StoredFileScanResult.CLEAN,
            scanCompletedAt: generatedAt,
            uploadedAt: generatedAt,
            uploadUrlExpiresAt: generatedAt,
          },
        });
        await tx.creditNoteDocument.update({
          where: { id: documentId },
          data: { storedFileId: stored.id, status: CreditNoteDocumentStatus.AVAILABLE, generatedAt },
        });
        await this.auditService.record(
          {
            action: 'CREDIT_NOTE_PDF_ISSUED',
            resourceType: 'CreditNoteDocument',
            resourceId: documentId,
            organisationId: note.sellerOrganisationId,
            newValue: { creditNoteId: note.id, storedFileId: stored.id, checksumSha256: checksum },
            ...(document.requestId ? { requestId: document.requestId } : {}),
          },
          tx,
        );
        return stored;
      });
      return { storedFileId: file.id };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown credit note PDF error';
      await this.prisma.creditNoteDocument.update({
        where: { id: documentId },
        data: { status: CreditNoteDocumentStatus.FAILED, lastError: message.slice(0, 1_000) },
      });
      throw error;
    }
  }

  private async findForRefund(refundId: string): Promise<CreditNoteDetail> {
    const note = await this.prisma.creditNote.findUnique({ where: { refundId }, include: detailInclude });
    if (!note) throw new NotFoundException({ code: ApiErrorCode.NOT_FOUND, message: 'Credit note not found' });
    return note;
  }

  private assertCanRead(note: CreditNoteDetail, actor: CurrentUser): void {
    if (note.refund.farmerUserId === actor.userId && this.accessService.hasPermission(actor, PermissionCode.REFUNDS_READ_OWN)) return;
    if (note.sellerOrganisationId === actor.organisationId && this.accessService.hasPermission(actor, PermissionCode.RETURNS_READ_SELLER_OWN)) return;
    if (this.accessService.hasPermission(actor, PermissionCode.REFUNDS_READ_ANY)) return;
    throw new ForbiddenException({ code: ApiErrorCode.FORBIDDEN, message: 'You do not have access to this credit note' });
  }

  private formatNumber(sellerOrganisationId: string, financialYear: string, sequence: number): string {
    if (sequence > 999_999) throw new Error('Credit note sequence exceeds its six-digit series');
    const sellerSeries = sellerOrganisationId.replace(/[^a-f0-9]/gi, '').slice(0, 4).toUpperCase();
    return `CN${sellerSeries}/${financialYear.slice(-2)}/${String(sequence).padStart(6, '0')}`;
  }

  private invoiceLines(value: Prisma.JsonValue) {
    if (!Array.isArray(value)) throw new Error('Invalid original invoice line snapshots');
    return value.map((entry) => {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) throw new Error('Invalid original invoice line');
      const line = entry as Record<string, unknown>;
      return {
        productOrderItemId: this.string(line, 'productOrderItemId'),
        productNameSnapshot: this.string(line, 'productNameSnapshot'),
        variantNameSnapshot: this.string(line, 'variantNameSnapshot'),
        hsnCode: this.string(line, 'hsnCode'),
        gstRateBps: this.number(line, 'gstRateBps'),
      };
    });
  }

  private creditLines(value: Prisma.JsonValue): CreditNotePdfLine[] {
    if (!Array.isArray(value)) throw new Error('Invalid credit note line snapshots');
    return value.map((entry) => {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) throw new Error('Invalid credit note line');
      const line = entry as Record<string, unknown>;
      return {
        productNameSnapshot: this.string(line, 'productNameSnapshot'), variantNameSnapshot: this.string(line, 'variantNameSnapshot'),
        hsnCode: this.string(line, 'hsnCode'), quantity: this.number(line, 'quantity'), gstRateBps: this.number(line, 'gstRateBps'),
        taxableAmountPaise: this.number(line, 'taxableAmountPaise'), cgstPaise: this.number(line, 'cgstPaise'),
        sgstPaise: this.number(line, 'sgstPaise'), igstPaise: this.number(line, 'igstPaise'), grossCreditPaise: this.number(line, 'grossCreditPaise'),
      };
    });
  }

  private string(line: Record<string, unknown>, key: string): string {
    const value = line[key];
    if (typeof value !== 'string') throw new Error(`Invalid document line ${key}`);
    return value;
  }

  private number(line: Record<string, unknown>, key: string): number {
    const value = line[key];
    if (!Number.isInteger(value)) throw new Error(`Invalid document line ${key}`);
    return value as number;
  }

  private objectSnapshot(value: Prisma.JsonValue): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid delivery address snapshot');
    return value;
  }

  private present(note: CreditNoteDetail) {
    return {
      id: note.id,
      refundId: note.refundId,
      productInvoiceId: note.productInvoiceId,
      productOrderId: note.productOrderId,
      creditNoteNumber: note.creditNoteNumber,
      financialYear: note.financialYear,
      grossCreditPaise: note.grossCreditPaise,
      farmerRefundPaise: note.farmerRefundPaise,
      subsidyReversalPaise: note.subsidyReversalPaise,
      taxableAmountPaise: note.taxableAmountPaise,
      taxPaise: note.taxPaise,
      cgstPaise: note.cgstPaise,
      sgstPaise: note.sgstPaise,
      igstPaise: note.igstPaise,
      originalInvoiceNumber: note.originalInvoiceNumber,
      originalInvoiceDate: note.originalInvoiceDate.toISOString(),
      reasonSnapshot: note.reasonSnapshot,
      issuedAt: note.issuedAt.toISOString(),
      document: note.document
        ? {
            id: note.document.id,
            status: note.document.status,
            fileId: note.document.storedFileId,
            checksumSha256: note.document.storedFile?.checksumSha256 ?? null,
            attemptCount: note.document.attemptCount,
            lastError: note.document.lastError,
            generatedAt: note.document.generatedAt?.toISOString() ?? null,
          }
        : null,
    };
  }
}
