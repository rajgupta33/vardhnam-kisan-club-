import { createHash } from 'node:crypto';
import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  Prisma,
  ProductInvoiceDocumentStatus,
  StoredFilePurpose,
  StoredFileScanResult,
  StoredFileStatus,
} from '@prisma/client';
import { AccessService } from '../access/access.service';
import { PermissionCode } from '../access/permission-codes';
import { AuditService } from '../audit/audit.service';
import type { CurrentUser } from '../auth/current-user.interface';
import { ApiErrorCode } from '../common/errors/api-error-codes';
import { DocumentJob, QueueName } from '../jobs/queue-names';
import { QueueService } from '../jobs/queue.service';
import { PrismaService } from '../prisma/prisma.service';
import { FilesService } from '../storage/files.service';
import { STORAGE_PROVIDER, type StorageProvider } from '../storage/storage.provider.interface';
import { renderInvoicePdf, type InvoicePdfLine } from './invoice-pdf.renderer';

const invoiceDocumentInclude = Prisma.validator<Prisma.ProductInvoiceDocumentInclude>()({
  storedFile: true,
  productInvoice: {
    include: { farmerProfile: { select: { userId: true } } },
  },
});

type InvoiceDocumentDetail = Prisma.ProductInvoiceDocumentGetPayload<{
  include: typeof invoiceDocumentInclude;
}>;

export function invoicePdfJobId(documentId: string): string {
  return `invoice-pdf-${documentId}`;
}

@Injectable()
export class InvoiceDocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accessService: AccessService,
    private readonly auditService: AuditService,
    private readonly queueService: QueueService,
    private readonly filesService: FilesService,
    @Inject(STORAGE_PROVIDER) private readonly storage: StorageProvider,
  ) {}

  async request(orderId: string, actor: CurrentUser, requestId?: string) {
    const invoice = await this.findInvoiceForOrder(orderId);
    this.assertCanRead(invoice, actor);

    const document =
      invoice.document ??
      (await this.prisma.productInvoiceDocument.upsert({
        where: { productInvoiceId: invoice.id },
        create: {
          productInvoiceId: invoice.id,
          requestedByUserId: actor.userId,
          requestedByRole: actor.role,
          ...(requestId ? { requestId } : {}),
        },
        update: {},
        include: invoiceDocumentInclude,
      }));

    if (
      document.status === ProductInvoiceDocumentStatus.QUEUED ||
      document.status === ProductInvoiceDocumentStatus.FAILED
    ) {
      await this.queueService.enqueue(
        QueueName.DOCUMENTS,
        DocumentJob.GENERATE_INVOICE_PDF,
        { invoiceDocumentId: document.id },
        { ...(requestId ? { requestId } : {}), jobId: invoicePdfJobId(document.id) },
      );
    }
    return this.present(document);
  }

  async get(orderId: string, actor: CurrentUser) {
    const invoice = await this.findInvoiceForOrder(orderId);
    this.assertCanRead(invoice, actor);
    if (!invoice.document) {
      throw new NotFoundException({ code: ApiErrorCode.NOT_FOUND, message: 'Invoice PDF has not been requested' });
    }
    return this.present(invoice.document);
  }

  async getDownload(orderId: string, actor: CurrentUser, requestId?: string) {
    const invoice = await this.findInvoiceForOrder(orderId);
    this.assertCanRead(invoice, actor);
    if (!invoice.document?.storedFileId) {
      throw new NotFoundException({ code: ApiErrorCode.NOT_FOUND, message: 'Invoice PDF is not available' });
    }
    return this.filesService.getDownloadUrl(invoice.document.storedFileId, actor, requestId);
  }

  async generate(documentId: string): Promise<{ storedFileId?: string; skipped?: boolean }> {
    const staleBefore = new Date(Date.now() - 15 * 60_000);
    const claim = await this.prisma.productInvoiceDocument.updateMany({
      where: {
        id: documentId,
        OR: [
          { status: ProductInvoiceDocumentStatus.QUEUED },
          { status: ProductInvoiceDocumentStatus.FAILED },
          { status: ProductInvoiceDocumentStatus.PROCESSING, updatedAt: { lt: staleBefore } },
        ],
      },
      data: { status: ProductInvoiceDocumentStatus.PROCESSING, attemptCount: { increment: 1 }, lastError: null },
    });
    if (claim.count === 0) {
      const existing = await this.prisma.productInvoiceDocument.findUnique({ where: { id: documentId } });
      return {
        ...(existing?.storedFileId ? { storedFileId: existing.storedFileId } : {}),
        skipped: true,
      };
    }

    const current = await this.prisma.productInvoiceDocument.findUnique({
      where: { id: documentId },
      include: invoiceDocumentInclude,
    });
    if (!current) return { skipped: true };

    try {
      const invoice = current.productInvoice;
      const pdf = await renderInvoicePdf({
        invoiceNumber: invoice.invoiceNumber,
        generatedAt: invoice.generatedAt,
        sellerLegalName: invoice.sellerLegalNameSnapshot,
        sellerGstin: invoice.sellerGstinSnapshot ?? '',
        sellerStateCode: invoice.sellerStateCodeSnapshot ?? '',
        sellerAddress: invoice.sellerAddressSnapshot ?? '',
        farmerName: invoice.farmerNameSnapshot,
        deliveryAddress: this.objectSnapshot(invoice.deliveryAddressSnapshot, 'delivery address'),
        placeOfSupplyStateCode: invoice.placeOfSupplyStateCode ?? '',
        lines: this.lineSnapshots(invoice.lineItemsSnapshot),
        taxableAmountPaise: invoice.taxableAmountPaise,
        cgstPaise: invoice.cgstPaise,
        sgstPaise: invoice.sgstPaise,
        igstPaise: invoice.igstPaise,
        taxPaise: invoice.taxPaise,
        totalPaise: invoice.totalPaise,
      });
      const checksum = createHash('sha256').update(pdf).digest('hex');
      const yyyymm = `${invoice.generatedAt.getUTCFullYear()}${String(invoice.generatedAt.getUTCMonth() + 1).padStart(2, '0')}`;
      const objectKey = `invoice_pdf/${yyyymm}/${documentId}.pdf`;
      await this.storage.write(objectKey, pdf, 'application/pdf');

      const generatedAt = new Date();
      const storedFile = await this.prisma.$transaction(async (tx) => {
        const file = await tx.storedFile.create({
          data: {
            ownerUserId: invoice.farmerProfile.userId,
            organisationId: invoice.sellerOrganisationId,
            purpose: StoredFilePurpose.INVOICE_PDF,
            status: StoredFileStatus.AVAILABLE,
            objectKey,
            originalFilename: `invoice-${invoice.invoiceNumber.replace(/[^A-Za-z0-9-]/g, '-')}.pdf`,
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
        await tx.productInvoiceDocument.update({
          where: { id: documentId },
          data: { storedFileId: file.id, status: ProductInvoiceDocumentStatus.AVAILABLE, generatedAt },
        });
        await this.auditService.record(
          {
            action: 'PRODUCT_INVOICE_PDF_ISSUED',
            resourceType: 'ProductInvoiceDocument',
            resourceId: documentId,
            organisationId: invoice.sellerOrganisationId,
            newValue: { productInvoiceId: invoice.id, storedFileId: file.id, checksumSha256: checksum },
            ...(current.requestId ? { requestId: current.requestId } : {}),
          },
          tx,
        );
        return file;
      });
      return { storedFileId: storedFile.id };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown invoice PDF generation error';
      await this.prisma.productInvoiceDocument.update({
        where: { id: documentId },
        data: { status: ProductInvoiceDocumentStatus.FAILED, lastError: message.slice(0, 1_000) },
      });
      throw error;
    }
  }

  private async findInvoiceForOrder(orderId: string) {
    const invoice = await this.prisma.productInvoice.findUnique({
      where: { productOrderId: orderId },
      include: { farmerProfile: { select: { userId: true } }, document: { include: { storedFile: true, productInvoice: { include: { farmerProfile: { select: { userId: true } } } } } } },
    });
    if (!invoice) throw new NotFoundException({ code: ApiErrorCode.NOT_FOUND, message: 'Product invoice not found' });
    return invoice;
  }

  private assertCanRead(invoice: Awaited<ReturnType<InvoiceDocumentsService['findInvoiceForOrder']>>, actor: CurrentUser): void {
    if (invoice.farmerProfile.userId === actor.userId && this.accessService.hasPermission(actor, PermissionCode.ORDERS_READ_OWN)) return;
    if (invoice.sellerOrganisationId === actor.organisationId && this.accessService.hasPermission(actor, PermissionCode.FULFILMENT_ORDERS_READ_OWN)) return;
    if (this.accessService.hasPermission(actor, PermissionCode.FULFILMENT_ORDERS_READ_ANY)) return;
    throw new ForbiddenException({ code: ApiErrorCode.FORBIDDEN, message: 'You do not have access to this invoice' });
  }

  private objectSnapshot(value: Prisma.JsonValue, label: string): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`Invalid ${label} snapshot`);
    return value;
  }

  private lineSnapshots(value: Prisma.JsonValue): InvoicePdfLine[] {
    if (!Array.isArray(value)) throw new Error('Invalid invoice line snapshot');
    return value.map((entry) => {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) throw new Error('Invalid invoice line');
      const line = entry as Record<string, unknown>;
      const string = (key: string) => { const item = line[key]; if (typeof item !== 'string') throw new Error(`Invalid invoice line ${key}`); return item; };
      const number = (key: string) => { const item = line[key]; if (!Number.isInteger(item)) throw new Error(`Invalid invoice line ${key}`); return item as number; };
      return {
        productNameSnapshot: string('productNameSnapshot'), variantNameSnapshot: string('variantNameSnapshot'),
        hsnCode: string('hsnCode'), quantity: number('quantity'), gstRateBps: number('gstRateBps'),
        taxableAmountPaise: number('taxableAmountPaise'), cgstPaise: number('cgstPaise'),
        sgstPaise: number('sgstPaise'), igstPaise: number('igstPaise'), lineTotalPaise: number('lineTotalPaise'),
      };
    });
  }

  private present(document: InvoiceDocumentDetail) {
    return {
      id: document.id,
      productInvoiceId: document.productInvoiceId,
      status: document.status,
      fileId: document.storedFileId,
      checksumSha256: document.storedFile?.checksumSha256 ?? null,
      attemptCount: document.attemptCount,
      lastError: document.lastError,
      generatedAt: document.generatedAt?.toISOString() ?? null,
      createdAt: document.createdAt.toISOString(),
      updatedAt: document.updatedAt.toISOString(),
    };
  }
}
