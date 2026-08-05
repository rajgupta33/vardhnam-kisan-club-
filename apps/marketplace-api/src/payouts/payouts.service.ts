import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PayoutAccountStatus, Prisma, type PayoutAccount } from '@prisma/client';
import { AuditService, type AuditRecordInput } from '../audit/audit.service';
import type { CurrentUser } from '../auth/current-user.interface';
import { paginationOffset } from '../common/dto/pagination-query.dto';
import { ApiErrorCode } from '../common/errors/api-error-codes';
import { PrismaService } from '../prisma/prisma.service';
import type { GetPayoutStatementQueryDto } from './dto/get-payout-statement-query.dto';
import type { ListPayoutAccountsQueryDto } from './dto/list-payout-accounts-query.dto';
import type { UpsertPayoutAccountDto } from './dto/upsert-payout-account.dto';
import type { VerifyPayoutAccountDto } from './dto/verify-payout-account.dto';

@Injectable()
export class PayoutsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async upsertMyAccount(dto: UpsertPayoutAccountDto, actor: CurrentUser, requestId?: string) {
    const existing = await this.prisma.payoutAccount.findUnique({
      where: { userId: actor.userId },
    });

    return this.prisma.$transaction(async (tx) => {
      const account = await tx.payoutAccount.upsert({
        where: { userId: actor.userId },
        create: {
          userId: actor.userId,
          accountHolderName: dto.accountHolderName,
          bankName: dto.bankName,
          accountNumber: dto.accountNumber,
          ifscCode: dto.ifscCode,
          upiId: dto.upiId ?? null,
          status: PayoutAccountStatus.PENDING_VERIFICATION,
        },
        update: {
          accountHolderName: dto.accountHolderName,
          bankName: dto.bankName,
          accountNumber: dto.accountNumber,
          ifscCode: dto.ifscCode,
          upiId: dto.upiId ?? null,
          status: PayoutAccountStatus.PENDING_VERIFICATION,
          verifiedAt: null,
          verifiedByUserId: null,
          verifiedByRole: null,
          rejectionReason: null,
        },
      });

      await this.auditService.record(
        this.withActor(actor, {
          action: existing ? 'PAYOUT_ACCOUNT_UPDATED' : 'PAYOUT_ACCOUNT_CREATED',
          resourceType: 'PayoutAccount',
          resourceId: account.id,
          previousValue: existing ? this.accountAuditValue(existing) : undefined,
          newValue: this.accountAuditValue(account),
          requestId,
          reason: 'Payout account details submitted',
        }),
        tx,
      );

      return this.toPayoutAccountView(account);
    });
  }

  async getMyAccount(actor: CurrentUser) {
    const account = await this.prisma.payoutAccount.findUnique({
      where: { userId: actor.userId },
    });
    if (!account) {
      throw new NotFoundException({
        code: ApiErrorCode.NOT_FOUND,
        message: 'Payout account was not found',
      });
    }

    return this.toPayoutAccountView(account);
  }

  async getAccountByUserId(userId: string) {
    const account = await this.prisma.payoutAccount.findUnique({ where: { userId } });
    if (!account) {
      throw new NotFoundException({
        code: ApiErrorCode.NOT_FOUND,
        message: 'Payout account was not found',
      });
    }

    return this.toPayoutAccountView(account);
  }

  async listAccounts(query: ListPayoutAccountsQueryDto) {
    const { page, limit, skip } = paginationOffset(query);
    const where: Prisma.PayoutAccountWhereInput = {
      ...(query.status ? { status: query.status } : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.payoutAccount.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.payoutAccount.count({ where }),
    ]);

    return { items: items.map((item) => this.toPayoutAccountView(item)), page, limit, total };
  }

  async verifyAccount(
    accountId: string,
    dto: VerifyPayoutAccountDto,
    actor: CurrentUser,
    requestId?: string,
  ) {
    const account = await this.prisma.payoutAccount.findUnique({ where: { id: accountId } });
    if (!account) {
      throw new NotFoundException({
        code: ApiErrorCode.NOT_FOUND,
        message: 'Payout account was not found',
      });
    }
    if (account.status !== PayoutAccountStatus.PENDING_VERIFICATION) {
      throw new BadRequestException({
        code: ApiErrorCode.VALIDATION_FAILED,
        message: 'Payout account has already been reviewed',
      });
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.payoutAccount.update({
        where: { id: accountId },
        data: {
          status: dto.status,
          verifiedAt: new Date(),
          verifiedByUserId: actor.userId,
          verifiedByRole: actor.role,
          rejectionReason:
            dto.status === PayoutAccountStatus.REJECTED ? dto.reason ?? null : null,
        },
      });

      await this.auditService.record(
        this.withActor(actor, {
          action:
            dto.status === PayoutAccountStatus.VERIFIED
              ? 'PAYOUT_ACCOUNT_VERIFIED'
              : 'PAYOUT_ACCOUNT_REJECTED',
          resourceType: 'PayoutAccount',
          resourceId: updated.id,
          previousValue: this.accountAuditValue(account),
          newValue: this.accountAuditValue(updated),
          requestId,
          reason: dto.reason,
        }),
        tx,
      );

      return this.toPayoutAccountView(updated);
    });
  }

  async getMyStatement(actor: CurrentUser, query: GetPayoutStatementQueryDto) {
    const { page, limit, skip } = paginationOffset(query);
    const where: Prisma.CommissionEntryWhereInput = {
      recipientUserId: actor.userId,
      ...(query.status ? { status: query.status } : {}),
    };

    const [items, total, totalsByStatus] = await this.prisma.$transaction([
      this.prisma.commissionEntry.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.commissionEntry.count({ where }),
      this.prisma.commissionEntry.groupBy({
        by: ['status'],
        where: { recipientUserId: actor.userId },
        orderBy: { status: 'asc' },
        _sum: { amountPaise: true },
      }),
    ]);

    return {
      items,
      page,
      limit,
      total,
      totalsByStatus: totalsByStatus.map((row) => ({
        status: row.status,
        amountPaise: row._sum?.amountPaise ?? 0,
      })),
    };
  }

  private toPayoutAccountView(account: PayoutAccount) {
    return {
      ...account,
      accountNumber: this.maskAccountNumber(account.accountNumber),
    };
  }

  private maskAccountNumber(accountNumber: string): string {
    const visibleDigits = 4;
    if (accountNumber.length <= visibleDigits) {
      return accountNumber;
    }
    return `${'*'.repeat(accountNumber.length - visibleDigits)}${accountNumber.slice(-visibleDigits)}`;
  }

  private accountAuditValue(account: PayoutAccount): Prisma.InputJsonObject {
    return {
      bankName: account.bankName,
      accountNumber: this.maskAccountNumber(account.accountNumber),
      ifscCode: account.ifscCode,
      status: account.status,
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
}
