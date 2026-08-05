import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
  CommissionEntryStatus,
  FinancialLedgerEntryType,
  Prisma,
  TallySyncRecordType,
  TallySyncStatus,
  type TallySyncRecord,
} from '@prisma/client';
import { AuditService, type AuditRecordInput } from '../audit/audit.service';
import type { CurrentUser } from '../auth/current-user.interface';
import { paginationOffset } from '../common/dto/pagination-query.dto';
import { ApiErrorCode } from '../common/errors/api-error-codes';
import { PrismaService } from '../prisma/prisma.service';
import { ConfirmTallySyncAttemptDto, TallySyncOutcome } from './dto/confirm-tally-sync-attempt.dto';
import type { CreateTallySyncRecordDto } from './dto/create-tally-sync-record.dto';
import type { ListTallySyncRecordsQueryDto } from './dto/list-tally-sync-records-query.dto';

interface TallySyncSnapshot {
  sourceEntityId: string | null;
  referenceLabel: string;
  referenceNumber?: string | undefined;
  amountPaise?: number | undefined;
  payload: Prisma.InputJsonValue;
}

@Injectable()
export class TallyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async enqueueSyncRecord(dto: CreateTallySyncRecordDto, actor: CurrentUser, requestId?: string) {
    const snapshot = await this.buildSnapshot(dto);

    return this.prisma.$transaction(async (tx) => {
      const record = await tx.tallySyncRecord.create({
        data: {
          recordType: dto.recordType,
          sourceEntityId: snapshot.sourceEntityId,
          referenceLabelSnapshot: snapshot.referenceLabel,
          referenceNumberSnapshot: snapshot.referenceNumber ?? null,
          amountPaise: snapshot.amountPaise ?? null,
          payloadSnapshot: snapshot.payload,
          enqueuedByUserId: actor.userId,
          enqueuedByRole: actor.role,
          reason: dto.reason ?? null,
        },
      });

      await this.auditService.record(
        this.withActor(actor, {
          action: 'TALLY_SYNC_RECORD_ENQUEUED',
          resourceType: 'TallySyncRecord',
          resourceId: record.id,
          newValue: this.recordAuditValue(record),
          requestId,
          reason: dto.reason ?? 'Tally sync record enqueued',
        }),
        tx,
      );

      return record;
    });
  }

  async attemptSync(
    id: string,
    dto: ConfirmTallySyncAttemptDto,
    actor: CurrentUser,
    requestId?: string,
  ) {
    const record = await this.findRecordOrThrow(id);
    if (record.status !== TallySyncStatus.PENDING && record.status !== TallySyncStatus.FAILED) {
      throw new ConflictException({
        code: ApiErrorCode.CONFLICT,
        message: `Tally sync record cannot be attempted from status ${record.status}`,
      });
    }

    const isSuccess = dto.outcome === TallySyncOutcome.SYNCED;
    const attemptNumber = record.attemptCount + 1;
    const errorCode = isSuccess ? null : dto.errorCode ?? 'MOCK_TALLY_SYNC_FAILED';
    const errorMessage = isSuccess
      ? null
      : dto.errorMessage ?? 'Mock Tally sync failed for local testing';
    const tallyReferenceId = isSuccess
      ? dto.tallyReferenceId ?? `MOCK-${record.recordType}-${record.id.slice(0, 8).toUpperCase()}`
      : record.tallyReferenceId;

    return this.prisma.$transaction(async (tx) => {
      await tx.tallySyncAttempt.create({
        data: {
          tallySyncRecordId: record.id,
          attemptNumber,
          outcome: isSuccess ? TallySyncStatus.SYNCED : TallySyncStatus.FAILED,
          errorCode,
          errorMessage,
          performedByUserId: actor.userId,
          performedByRole: actor.role,
        },
      });

      const updated = await tx.tallySyncRecord.update({
        where: { id: record.id },
        data: {
          status: isSuccess ? TallySyncStatus.SYNCED : TallySyncStatus.FAILED,
          attemptCount: attemptNumber,
          lastAttemptAt: new Date(),
          lastErrorCode: errorCode,
          lastErrorMessage: errorMessage,
          tallyReferenceId,
        },
      });

      await this.auditService.record(
        this.withActor(actor, {
          action: isSuccess ? 'TALLY_SYNC_RECORD_SYNCED' : 'TALLY_SYNC_RECORD_SYNC_FAILED',
          resourceType: 'TallySyncRecord',
          resourceId: updated.id,
          previousValue: this.recordAuditValue(record),
          newValue: this.recordAuditValue(updated),
          requestId,
          reason: dto.reason ?? (isSuccess ? 'Tally sync succeeded' : 'Tally sync failed'),
        }),
        tx,
      );

      return updated;
    });
  }

  async listSyncRecords(query: ListTallySyncRecordsQueryDto) {
    const { page, limit, skip } = paginationOffset(query);
    const where: Prisma.TallySyncRecordWhereInput = {
      ...(query.recordType ? { recordType: query.recordType } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.sourceEntityId ? { sourceEntityId: query.sourceEntityId } : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.tallySyncRecord.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.tallySyncRecord.count({ where }),
    ]);

    return { items, page, limit, total };
  }

  async getSyncRecordById(id: string) {
    const record = await this.prisma.tallySyncRecord.findUnique({
      where: { id },
      include: { attempts: { orderBy: { attemptNumber: 'asc' } } },
    });
    if (!record) {
      throw new NotFoundException({
        code: ApiErrorCode.NOT_FOUND,
        message: 'Tally sync record was not found',
      });
    }
    return record;
  }

  async getReconciliationSummary() {
    const grouped = await this.prisma.tallySyncRecord.groupBy({
      by: ['recordType', 'status'],
      _count: { _all: true },
      _sum: { amountPaise: true },
    });

    const oldestUnsynced = await this.prisma.tallySyncRecord.groupBy({
      by: ['recordType'],
      where: { status: { in: [TallySyncStatus.PENDING, TallySyncStatus.FAILED] } },
      _min: { createdAt: true },
    });
    const oldestByType = new Map(
      oldestUnsynced.map((row) => [row.recordType, row._min.createdAt] as const),
    );
    const now = Date.now();

    return grouped.map((row) => {
      const isUnsynced = row.status === TallySyncStatus.PENDING || row.status === TallySyncStatus.FAILED;
      const oldest = oldestByType.get(row.recordType);
      return {
        recordType: row.recordType,
        status: row.status,
        count: row._count._all,
        totalAmountPaise: row._sum.amountPaise ?? 0,
        oldestUnsyncedAgeHours:
          isUnsynced && oldest ? Math.round((now - oldest.getTime()) / 3_600_000) : null,
      };
    });
  }

  private async buildSnapshot(dto: CreateTallySyncRecordDto): Promise<TallySyncSnapshot> {
    switch (dto.recordType) {
      case TallySyncRecordType.PARTY_MASTER:
        return this.buildPartyMasterSnapshot(dto);
      case TallySyncRecordType.ITEM_MASTER:
        return this.buildItemMasterSnapshot(dto);
      case TallySyncRecordType.INVOICE:
        return this.buildInvoiceSnapshot(dto);
      case TallySyncRecordType.SETTLEMENT:
        return this.buildSettlementSnapshot(dto);
      case TallySyncRecordType.COMMISSION_INVOICE:
        return this.buildCommissionInvoiceSnapshot(dto);
      case TallySyncRecordType.CREDIT_NOTE:
        return this.buildLedgerSnapshot(dto, FinancialLedgerEntryType.REFUND, 'CREDIT_NOTE');
      case TallySyncRecordType.RECEIPT:
        return this.buildLedgerSnapshot(dto, FinancialLedgerEntryType.FARMER_PAYMENT, 'RECEIPT');
      case TallySyncRecordType.VOUCHER:
        return this.buildVoucherSnapshot(dto);
      default:
        throw new BadRequestException({
          code: ApiErrorCode.VALIDATION_FAILED,
          message: 'Unsupported recordType',
        });
    }
  }

  private async buildPartyMasterSnapshot(dto: CreateTallySyncRecordDto): Promise<TallySyncSnapshot> {
    if (!dto.organisationId) {
      throw this.validationFailed('organisationId is required for PARTY_MASTER');
    }
    const organisation = await this.prisma.organisation.findUnique({
      where: { id: dto.organisationId },
    });
    if (!organisation) {
      throw this.notFound('organisationId was not found');
    }

    return {
      sourceEntityId: organisation.id,
      referenceLabel: organisation.legalName,
      referenceNumber: organisation.gstin ?? undefined,
      payload: {
        legalName: organisation.legalName,
        displayName: organisation.displayName,
        gstin: organisation.gstin,
        type: organisation.type,
        status: organisation.status,
      },
    };
  }

  private async buildItemMasterSnapshot(dto: CreateTallySyncRecordDto): Promise<TallySyncSnapshot> {
    if (!dto.productVariantId) {
      throw this.validationFailed('productVariantId is required for ITEM_MASTER');
    }
    const variant = await this.prisma.productVariant.findUnique({
      where: { id: dto.productVariantId },
      include: { product: true },
    });
    if (!variant) {
      throw this.notFound('productVariantId was not found');
    }

    return {
      sourceEntityId: variant.id,
      referenceLabel: `${variant.product.name} — ${variant.variantName}`,
      referenceNumber: variant.sku ?? undefined,
      payload: {
        productName: variant.product.name,
        variantName: variant.variantName,
        sku: variant.sku,
        packSize: variant.packSize.toString(),
        packUnit: variant.packUnit,
        mrpPaise: variant.mrpPaise,
      },
    };
  }

  private async buildInvoiceSnapshot(dto: CreateTallySyncRecordDto): Promise<TallySyncSnapshot> {
    if (!dto.productInvoiceId) {
      throw this.validationFailed('productInvoiceId is required for INVOICE');
    }
    const invoice = await this.prisma.productInvoice.findUnique({
      where: { id: dto.productInvoiceId },
    });
    if (!invoice) {
      throw this.notFound('productInvoiceId was not found');
    }

    return {
      sourceEntityId: invoice.id,
      referenceLabel: invoice.invoiceNumber,
      referenceNumber: invoice.invoiceNumber,
      amountPaise: invoice.totalPaise,
      payload: {
        invoiceNumber: invoice.invoiceNumber,
        sellerLegalNameSnapshot: invoice.sellerLegalNameSnapshot,
        sellerGstinSnapshot: invoice.sellerGstinSnapshot,
        farmerNameSnapshot: invoice.farmerNameSnapshot,
        subtotalPaise: invoice.subtotalPaise,
        taxPaise: invoice.taxPaise,
        totalPaise: invoice.totalPaise,
        itemCount: invoice.itemCount,
      },
    };
  }

  private async buildSettlementSnapshot(dto: CreateTallySyncRecordDto): Promise<TallySyncSnapshot> {
    if (!dto.settlementId) {
      throw this.validationFailed('settlementId is required for SETTLEMENT');
    }
    const settlement = await this.prisma.settlement.findUnique({
      where: { id: dto.settlementId },
    });
    if (!settlement) {
      throw this.notFound('settlementId was not found');
    }

    return {
      sourceEntityId: settlement.id,
      referenceLabel: settlement.settlementNumber,
      referenceNumber: settlement.settlementNumber,
      amountPaise: settlement.totalPayablePaise,
      payload: {
        settlementNumber: settlement.settlementNumber,
        sellerOrganisationId: settlement.sellerOrganisationId,
        totalPayablePaise: settlement.totalPayablePaise,
        entryCount: settlement.entryCount,
        status: settlement.status,
      },
    };
  }

  private async buildCommissionInvoiceSnapshot(
    dto: CreateTallySyncRecordDto,
  ): Promise<TallySyncSnapshot> {
    if (!dto.commissionEntryId) {
      throw this.validationFailed('commissionEntryId is required for COMMISSION_INVOICE');
    }
    const entry = await this.prisma.commissionEntry.findUnique({
      where: { id: dto.commissionEntryId },
    });
    if (!entry) {
      throw this.notFound('commissionEntryId was not found');
    }
    if (entry.status !== CommissionEntryStatus.FINAL) {
      throw this.validationFailed('commissionEntryId must be a FINAL commission entry');
    }

    return {
      sourceEntityId: entry.id,
      referenceLabel: `${entry.entryType} commission entry ${entry.id}`,
      amountPaise: entry.amountPaise,
      payload: {
        entryType: entry.entryType,
        amountPaise: entry.amountPaise,
        sellerOrganisationId: entry.sellerOrganisationId,
        recipientUserId: entry.recipientUserId,
        productOrderId: entry.productOrderId,
        settlementId: entry.settlementId,
      },
    };
  }

  private async buildLedgerSnapshot(
    dto: CreateTallySyncRecordDto,
    expectedEntryType: FinancialLedgerEntryType,
    label: 'CREDIT_NOTE' | 'RECEIPT',
  ): Promise<TallySyncSnapshot> {
    if (!dto.financialLedgerEntryId) {
      throw this.validationFailed(`financialLedgerEntryId is required for ${label}`);
    }
    const entry = await this.prisma.financialLedgerEntry.findUnique({
      where: { id: dto.financialLedgerEntryId },
    });
    if (!entry) {
      throw this.notFound('financialLedgerEntryId was not found');
    }
    if (entry.entryType !== expectedEntryType) {
      throw this.validationFailed(
        `financialLedgerEntryId must reference a ${expectedEntryType} ledger entry for ${label}`,
      );
    }

    return {
      sourceEntityId: entry.id,
      referenceLabel: `${label} ledger entry ${entry.id}`,
      amountPaise: entry.amountPaise,
      payload: {
        entryType: entry.entryType,
        amountPaise: entry.amountPaise,
        organisationId: entry.organisationId,
        productOrderId: entry.productOrderId,
        paymentIntentId: entry.paymentIntentId,
        reason: entry.reason,
      },
    };
  }

  private buildVoucherSnapshot(dto: CreateTallySyncRecordDto): TallySyncSnapshot {
    if (!dto.referenceLabel || !dto.payload) {
      throw this.validationFailed('referenceLabel and payload are required for VOUCHER');
    }

    return {
      sourceEntityId: null,
      referenceLabel: dto.referenceLabel,
      payload: dto.payload as Prisma.InputJsonValue,
    };
  }

  private async findRecordOrThrow(id: string): Promise<TallySyncRecord> {
    const record = await this.prisma.tallySyncRecord.findUnique({ where: { id } });
    if (!record) {
      throw this.notFound('Tally sync record was not found');
    }
    return record;
  }

  private recordAuditValue(record: TallySyncRecord): Prisma.InputJsonObject {
    return {
      recordType: record.recordType,
      status: record.status,
      attemptCount: record.attemptCount,
      referenceLabelSnapshot: record.referenceLabelSnapshot,
    };
  }

  private withActor(actor: CurrentUser, input: AuditRecordInput): AuditRecordInput {
    return {
      ...input,
      actorUserId: actor.userId,
      actorRole: actor.role,
      organisationId: input.organisationId ?? actor.organisationId,
    };
  }

  private validationFailed(message: string): BadRequestException {
    return new BadRequestException({ code: ApiErrorCode.VALIDATION_FAILED, message });
  }

  private notFound(message: string): NotFoundException {
    return new NotFoundException({ code: ApiErrorCode.NOT_FOUND, message });
  }
}
