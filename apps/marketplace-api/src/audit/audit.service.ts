import { Injectable } from '@nestjs/common';
import { PlatformRole, Prisma, PrismaClient } from '@prisma/client';
import { paginationOffset } from '../common/dto/pagination-query.dto';
import { PrismaService } from '../prisma/prisma.service';
import type { ListAuditQueryDto } from './dto/list-audit-query.dto';

type AuditClient = PrismaService | Prisma.TransactionClient | PrismaClient;

export interface AuditRecordInput {
  actorUserId?: string | undefined;
  actorRole?: PlatformRole | undefined;
  organisationId?: string | undefined;
  action: string;
  resourceType: string;
  resourceId?: string | undefined;
  previousValue?: Prisma.InputJsonValue | undefined;
  newValue?: Prisma.InputJsonValue | undefined;
  requestId?: string | undefined;
  reason?: string | undefined;
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async record(input: AuditRecordInput, client: AuditClient = this.prisma) {
    const data: Prisma.AuditLogCreateInput = {
      action: input.action,
      resourceType: input.resourceType,
    };

    if (input.actorUserId) {
      data.actorUser = { connect: { id: input.actorUserId } };
    }
    if (input.actorRole) {
      data.actorRole = input.actorRole;
    }
    if (input.organisationId) {
      data.organisation = { connect: { id: input.organisationId } };
    }
    if (input.resourceId) {
      data.resourceId = input.resourceId;
    }
    if (input.previousValue !== undefined) {
      data.previousValue = input.previousValue;
    }
    if (input.newValue !== undefined) {
      data.newValue = input.newValue;
    }
    if (input.requestId) {
      data.requestId = input.requestId;
    }
    if (input.reason) {
      data.reason = input.reason;
    }

    return client.auditLog.create({ data });
  }

  async list(query: ListAuditQueryDto) {
    const { page, limit, skip } = paginationOffset(query);
    const where: Prisma.AuditLogWhereInput = {};

    if (query.action) {
      where.action = query.action;
    }
    if (query.resourceType) {
      where.resourceType = query.resourceType;
    }
    if (query.resourceId) {
      where.resourceId = query.resourceId;
    }
    if (query.organisationId) {
      where.organisationId = query.organisationId;
    }
    if (query.actorUserId) {
      where.actorUserId = query.actorUserId;
    }

    const [items, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where,
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take: limit,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      items,
      page,
      limit,
      total,
    };
  }
}
