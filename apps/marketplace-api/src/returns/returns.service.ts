import { createHash } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  IdempotencyStatus,
  InventoryBatchStatus,
  InventoryMovementType,
  PlatformRole,
  Prisma,
  ProductOrderStatus,
  ReturnReasonCode,
  ReturnInspectionOutcome,
  ReturnRequestStatus,
  ReturnPickupAssignmentStatus,
  StoredFilePurpose,
  StoredFileStatus,
} from '@prisma/client';
import { AccessService } from '../access/access.service';
import { PermissionCode } from '../access/permission-codes';
import { AuditService } from '../audit/audit.service';
import type { CurrentUser } from '../auth/current-user.interface';
import { paginationOffset } from '../common/dto/pagination-query.dto';
import { ApiErrorCode } from '../common/errors/api-error-codes';
import {
  FarmerNotificationEvent,
  NotificationEventsService,
} from '../notifications/notification-events.service';
import { PrismaService } from '../prisma/prisma.service';
import type { AttachReturnEvidenceDto } from './dto/attach-return-evidence.dto';
import type { CreateReturnRequestDto } from './dto/create-return-request.dto';
import type { InspectReturnRequestDto } from './dto/inspect-return-request.dto';
import type { ListMyReturnRequestsQueryDto } from './dto/list-my-return-requests-query.dto';
import type { ListReturnRequestsQueryDto } from './dto/list-return-requests-query.dto';
import type { ReturnTransitionDto } from './dto/return-transition.dto';

const returnRequestInclude = Prisma.validator<Prisma.ReturnRequestInclude>()({
  pickupAssignment: true,
  evidence: {
    orderBy: { createdAt: 'asc' },
    include: { storedFile: true },
  },
  items: {
    orderBy: { createdAt: 'asc' },
    include: {
      productOrderItem: {
        include: {
          reservations: {
            orderBy: { createdAt: 'asc' },
            include: { batch: true },
          },
        },
      },
    },
  },
  statusHistory: { orderBy: { createdAt: 'asc' } },
  inspectionDispositions: {
    orderBy: { createdAt: 'asc' },
    include: { batch: true, inventoryMovement: true },
  },
  refunds: {
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      amountPaise: true,
      method: true,
      status: true,
      providerMode: true,
      providerRefundReference: true,
      failureReason: true,
      initiatedAt: true,
      completedAt: true,
    },
  },
  productOrder: {
    select: {
      orderNumber: true,
      sellerNameSnapshot: true,
      status: true,
    },
  },
});

const returnOrderInclude = Prisma.validator<Prisma.ProductOrderInclude>()({
  items: { orderBy: { createdAt: 'asc' } },
  statusHistory: { orderBy: { createdAt: 'asc' } },
  returnRequests: { orderBy: { createdAt: 'desc' }, take: 1 },
});

type ReturnRequestWithDetails = Prisma.ReturnRequestGetPayload<{
  include: typeof returnRequestInclude;
}>;

@Injectable()
export class ReturnsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly accessService: AccessService,
    private readonly configService: ConfigService,
    private readonly notificationEventsService: NotificationEventsService,
  ) {}

  async getMyReturnEligibility(orderId: string, actor: CurrentUser) {
    this.ensureFarmerPermission(actor, PermissionCode.RETURNS_READ_OWN);
    const profile = await this.findFarmerProfile(actor.userId);
    const order = await this.findOwnedOrder(orderId, profile.id);
    return this.toEligibility(order);
  }

  async createMyReturnRequest(
    dto: CreateReturnRequestDto,
    actor: CurrentUser,
    idempotencyKey?: string,
    requestId?: string,
  ) {
    this.ensureFarmerPermission(actor, PermissionCode.RETURNS_CREATE_OWN);
    const key = this.normalizedIdempotencyKey(idempotencyKey);
    const scope = `returns:create:${actor.userId}`;
    const requestHash = this.hashRequest({ actorUserId: actor.userId, dto });

    return this.runIdempotent(scope, key, requestHash, async () => {
      return this.prisma.$transaction(async (tx) => {
        const profile = await this.findFarmerProfile(actor.userId, tx);
        const order = await this.findOwnedOrder(dto.productOrderId, profile.id, tx);
        const eligibility = this.toEligibility(order);

        if (!eligibility.eligible) {
          throw new ConflictException({
            code: ApiErrorCode.CONFLICT,
            message: eligibility.reason,
          });
        }

        if (dto.reasonCode === ReturnReasonCode.OTHER && !dto.reasonNote?.trim()) {
          throw new BadRequestException({
            code: ApiErrorCode.VALIDATION_FAILED,
            message: 'A reason note is required when the return reason is OTHER',
          });
        }

        const requestedItemIds = new Set(dto.items.map((item) => item.productOrderItemId));
        if (requestedItemIds.size !== dto.items.length) {
          throw new BadRequestException({
            code: ApiErrorCode.VALIDATION_FAILED,
            message: 'A product order item may appear only once in a return request',
          });
        }

        const orderItemsById = new Map(order.items.map((item) => [item.id, item]));
        const items = dto.items.map((requestedItem) => {
          const orderItem = orderItemsById.get(requestedItem.productOrderItemId);
          if (!orderItem) {
            throw new BadRequestException({
              code: ApiErrorCode.VALIDATION_FAILED,
              message: 'Every return item must belong to the selected product order',
            });
          }
          if (requestedItem.quantity > orderItem.quantity) {
            throw new BadRequestException({
              code: ApiErrorCode.VALIDATION_FAILED,
              message: `Return quantity for ${orderItem.productNameSnapshot} exceeds the ordered quantity`,
            });
          }

          const clubBenefitPaise = Math.floor(
            ((orderItem.clubBenefitPaise ?? 0) * requestedItem.quantity) / orderItem.quantity,
          );
          return {
            productOrderItemId: orderItem.id,
            quantity: requestedItem.quantity,
            unitPricePaise: orderItem.unitPricePaise,
            clubBenefitPaise,
            lineRefundPaise: orderItem.unitPricePaise * requestedItem.quantity - clubBenefitPaise,
          };
        });
        const refundableAmountPaise = items.reduce(
          (total, item) => total + item.lineRefundPaise,
          0,
        );

        let created: ReturnRequestWithDetails;
        try {
          created = await tx.returnRequest.create({
            data: {
              productOrderId: order.id,
              farmerProfileId: profile.id,
              farmerUserId: actor.userId,
              distributorOrganisationId: order.sellerOrganisationId,
              reasonCode: dto.reasonCode,
              reasonNote: dto.reasonNote?.trim() || null,
              windowExpiresAt: eligibility.windowExpiresAt!,
              refundableAmountPaise,
              items: { create: items },
              statusHistory: {
                create: {
                  toStatus: ReturnRequestStatus.REQUESTED,
                  actorUserId: actor.userId,
                  actorRole: actor.role,
                  reason: dto.reasonNote?.trim() || dto.reasonCode,
                  requestId: requestId ?? null,
                },
              },
            },
            include: returnRequestInclude,
          });
        } catch (error) {
          if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
            throw new ConflictException({
              code: ApiErrorCode.CONFLICT,
              message: 'A return request already exists for this product order',
            });
          }
          throw error;
        }

        await tx.productOrder.update({
          where: { id: order.id },
          data: {
            status: ProductOrderStatus.RETURN_REQUESTED,
            statusHistory: {
              create: {
                fromStatus: ProductOrderStatus.DELIVERED,
                toStatus: ProductOrderStatus.RETURN_REQUESTED,
                actorUserId: actor.userId,
                actorRole: actor.role,
                reason: 'Farmer submitted a return request',
                requestId: requestId ?? null,
              },
            },
          },
        });

        await this.auditService.record(
          {
            actorUserId: actor.userId,
            actorRole: actor.role,
            organisationId: order.sellerOrganisationId,
            action: 'RETURN_REQUEST_CREATED',
            resourceType: 'ReturnRequest',
            resourceId: created.id,
            newValue: {
              productOrderId: order.id,
              status: created.status,
              reasonCode: created.reasonCode,
              refundableAmountPaise,
              items: items.map((item) => ({
                productOrderItemId: item.productOrderItemId,
                quantity: item.quantity,
              })),
            },
            requestId,
            reason: dto.reasonNote?.trim() || dto.reasonCode,
          },
          tx,
        );

        await this.notificationEventsService.emitFarmerEvent(tx, {
          event: FarmerNotificationEvent.RETURN_REQUESTED,
          recipientUserId: actor.userId,
          returnRequestId: created.id,
          productOrderId: order.id,
          orderNumber: order.orderNumber,
          actorUserId: actor.userId,
          actorRole: actor.role,
          requestId,
        });

        return this.toReturnRequest(created);
      });
    });
  }

  async listMyReturnRequests(query: ListMyReturnRequestsQueryDto, actor: CurrentUser) {
    this.ensureFarmerPermission(actor, PermissionCode.RETURNS_READ_OWN);
    const profile = await this.findFarmerProfile(actor.userId);
    const { page, limit, skip } = paginationOffset(query);
    const where: Prisma.ReturnRequestWhereInput = {
      farmerProfileId: profile.id,
      ...(query.status ? { status: query.status } : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.returnRequest.findMany({
        where,
        include: returnRequestInclude,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.returnRequest.count({ where }),
    ]);
    return { items: items.map((item) => this.toReturnRequest(item)), page, limit, total };
  }

  async getMyReturnRequest(returnRequestId: string, actor: CurrentUser) {
    this.ensureFarmerPermission(actor, PermissionCode.RETURNS_READ_OWN);
    const profile = await this.findFarmerProfile(actor.userId);
    const request = await this.prisma.returnRequest.findFirst({
      where: { id: returnRequestId, farmerProfileId: profile.id },
      include: returnRequestInclude,
    });
    if (!request) {
      throw new NotFoundException({
        code: ApiErrorCode.NOT_FOUND,
        message: 'Return request was not found',
      });
    }
    return this.toReturnRequest(request);
  }

  async cancelMyReturnRequest(
    returnRequestId: string,
    dto: ReturnTransitionDto,
    actor: CurrentUser,
    idempotencyKey?: string,
    requestId?: string,
  ) {
    this.ensureFarmerPermission(actor, PermissionCode.RETURNS_CANCEL_OWN);
    const key = this.normalizedIdempotencyKey(idempotencyKey);
    const scope = `returns:cancel:${actor.userId}`;
    const reason = dto.reason?.trim() || 'Farmer cancelled the return before pickup';
    const requestHash = this.hashRequest({
      actorUserId: actor.userId,
      returnRequestId,
      reason,
    });

    return this.runIdempotent(scope, key, requestHash, async () =>
      this.prisma.$transaction(
        async (tx) => {
          const profile = await this.findFarmerProfile(actor.userId, tx);
          const request = await this.findOwnedReturnRequest(returnRequestId, profile.id, tx);
          const allowedStatuses: ReturnRequestStatus[] = [
            ReturnRequestStatus.REQUESTED,
            ReturnRequestStatus.APPROVED,
          ];
          if (!allowedStatuses.includes(request.status)) {
            throw new ConflictException({
              code: ApiErrorCode.CONFLICT,
              message: 'A return can be cancelled only before pickup',
            });
          }
          const expectedOrderStatus =
            request.status === ReturnRequestStatus.REQUESTED
              ? ProductOrderStatus.RETURN_REQUESTED
              : ProductOrderStatus.RETURN_APPROVED;
          if (request.productOrder.status !== expectedOrderStatus) {
            throw new ConflictException({
              code: ApiErrorCode.CONFLICT,
              message: 'The product order return status is inconsistent with this request',
            });
          }

          await tx.returnRequest.update({
            where: { id: request.id },
            data: {
              status: ReturnRequestStatus.CANCELLED,
              statusHistory: {
                create: {
                  fromStatus: request.status,
                  toStatus: ReturnRequestStatus.CANCELLED,
                  actorUserId: actor.userId,
                  actorRole: actor.role,
                  reason,
                  requestId: requestId ?? null,
                },
              },
            },
          });
          await tx.productOrder.update({
            where: { id: request.productOrderId },
            data: {
              status: ProductOrderStatus.DELIVERED,
              statusHistory: {
                create: {
                  fromStatus: expectedOrderStatus,
                  toStatus: ProductOrderStatus.DELIVERED,
                  actorUserId: actor.userId,
                  actorRole: actor.role,
                  reason,
                  requestId: requestId ?? null,
                },
              },
            },
          });
          if (
            request.pickupAssignment &&
            request.pickupAssignment.status !== ReturnPickupAssignmentStatus.CANCELLED
          ) {
            const cancelled = await tx.returnPickupAssignment.update({
              where: { id: request.pickupAssignment.id },
              data: { status: ReturnPickupAssignmentStatus.CANCELLED },
            });
            await this.auditService.record(
              {
                actorUserId: actor.userId,
                actorRole: actor.role,
                organisationId: request.distributorOrganisationId,
                action: 'RETURN_PICKUP_CANCELLED',
                resourceType: 'ReturnPickupAssignment',
                resourceId: cancelled.id,
                previousValue: { status: request.pickupAssignment.status },
                newValue: { status: cancelled.status },
                requestId,
                reason,
              },
              tx,
            );
          }
          await this.auditService.record(
            {
              actorUserId: actor.userId,
              actorRole: actor.role,
              organisationId: request.distributorOrganisationId,
              action: 'RETURN_REQUEST_CANCELLED_BY_FARMER',
              resourceType: 'ReturnRequest',
              resourceId: request.id,
              previousValue: {
                status: request.status,
                productOrderStatus: expectedOrderStatus,
              },
              newValue: {
                status: ReturnRequestStatus.CANCELLED,
                productOrderStatus: ProductOrderStatus.DELIVERED,
              },
              requestId,
              reason,
            },
            tx,
          );

          await this.notificationEventsService.emitFarmerEvent(tx, {
            event: FarmerNotificationEvent.RETURN_CANCELLED,
            recipientUserId: request.farmerUserId,
            returnRequestId: request.id,
            productOrderId: request.productOrderId,
            orderNumber: request.productOrder.orderNumber,
            actorUserId: actor.userId,
            actorRole: actor.role,
            requestId,
          });

          const updated = await this.findOwnedReturnRequest(request.id, profile.id, tx);
          return this.toReturnRequest(updated);
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      ),
    );
  }

  async listReturnRequests(query: ListReturnRequestsQueryDto, actor: CurrentUser) {
    const distributorOrganisationId = this.operationalReturnScope(
      actor,
      'read',
      query.distributorOrganisationId,
    );
    const { page, limit, skip } = paginationOffset(query);
    const q = query.q?.trim();
    const where: Prisma.ReturnRequestWhereInput = {
      ...(distributorOrganisationId ? { distributorOrganisationId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(q
        ? {
            OR: [
              { productOrder: { orderNumber: { contains: q, mode: 'insensitive' } } },
              { productOrder: { sellerNameSnapshot: { contains: q, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.returnRequest.findMany({
        where,
        include: returnRequestInclude,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.returnRequest.count({ where }),
    ]);
    return { items: items.map((item) => this.toReturnRequest(item)), page, limit, total };
  }

  async getReturnRequest(returnRequestId: string, actor: CurrentUser) {
    if (
      actor.role === PlatformRole.FARMER &&
      this.accessService.hasPermission(actor, PermissionCode.RETURNS_READ_OWN)
    ) {
      return this.getMyReturnRequest(returnRequestId, actor);
    }

    const request = await this.findReturnRequest(returnRequestId);
    this.ensureOperationalReturnAccess(actor, request.distributorOrganisationId, 'read');
    return this.toReturnRequest(request);
  }

  async attachEvidence(
    returnRequestId: string,
    dto: AttachReturnEvidenceDto,
    actor: CurrentUser,
    requestId?: string,
  ) {
    return this.prisma.$transaction(
      async (tx) => {
        const request = await this.findReturnRequest(returnRequestId, tx);
        if (actor.role === PlatformRole.FARMER) {
          this.ensureFarmerPermission(actor, PermissionCode.RETURNS_CREATE_OWN);
          if (request.farmerUserId !== actor.userId) {
            throw new NotFoundException({
              code: ApiErrorCode.NOT_FOUND,
              message: 'Return request was not found',
            });
          }
        } else {
          this.ensureOperationalReturnAccess(
            actor,
            request.distributorOrganisationId,
            'manage',
          );
        }

        const file = await tx.storedFile.findUnique({ where: { id: dto.storedFileId } });
        if (!file) {
          throw new NotFoundException({
            code: ApiErrorCode.NOT_FOUND,
            message: 'Stored file was not found',
          });
        }
        // Serialise attachment attempts for this file. Without the row lock,
        // two simultaneous retries could both pass the lookup and leak a raw
        // unique-constraint error instead of returning the existing link.
        await tx.$queryRaw(Prisma.sql`
          SELECT "id"
          FROM "StoredFile"
          WHERE "id" = ${file.id}::uuid
          FOR UPDATE
        `);
        if (file.ownerUserId !== actor.userId) {
          throw new ForbiddenException({
            code: ApiErrorCode.FORBIDDEN,
            message: 'Only the file uploader may attach return evidence',
          });
        }
        if (file.purpose !== StoredFilePurpose.RETURN_EVIDENCE) {
          throw new BadRequestException({
            code: ApiErrorCode.VALIDATION_FAILED,
            message: 'Only a RETURN_EVIDENCE file may be attached to a return request',
          });
        }
        if (file.status !== StoredFileStatus.AVAILABLE) {
          throw new ConflictException({
            code: ApiErrorCode.CONFLICT,
            message: `Return evidence is not available after scanning (status ${file.status})`,
          });
        }

        const existing = await tx.returnRequestEvidence.findUnique({
          where: { storedFileId: file.id },
          include: { storedFile: true },
        });
        if (existing) {
          if (
            existing.returnRequestId === request.id &&
            existing.uploadedByUserId === actor.userId
          ) {
            return this.toReturnEvidence(existing);
          }
          throw new ConflictException({
            code: ApiErrorCode.CONFLICT,
            message: 'This stored file is already attached as return evidence',
          });
        }

        const caption = dto.caption?.trim() || null;
        const evidence = await tx.returnRequestEvidence.create({
          data: {
            returnRequestId: request.id,
            storedFileId: file.id,
            uploadedByUserId: actor.userId,
            uploadedByRole: actor.role,
            caption,
          },
          include: { storedFile: true },
        });

        // Once attached, the evidence belongs to the seller-scoped return while
        // the uploader remains its owner. Existing file access then authorises
        // the farmer, seller organisation and any-file operations users.
        await tx.storedFile.update({
          where: { id: file.id },
          data: { organisationId: request.distributorOrganisationId },
        });

        await this.auditService.record(
          {
            actorUserId: actor.userId,
            actorRole: actor.role,
            organisationId: request.distributorOrganisationId,
            action: 'RETURN_EVIDENCE_ATTACHED',
            resourceType: 'ReturnRequest',
            resourceId: request.id,
            newValue: {
              evidenceId: evidence.id,
              storedFileId: file.id,
              contentType: file.contentType,
              sizeBytes: file.sizeBytes,
            },
            requestId,
            reason: caption ?? 'Return evidence attached',
          },
          tx,
        );

        return this.toReturnEvidence({
          ...evidence,
          storedFile: { ...evidence.storedFile, organisationId: request.distributorOrganisationId },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  approveReturnRequest(
    returnRequestId: string,
    dto: ReturnTransitionDto,
    actor: CurrentUser,
    requestId?: string,
  ) {
    return this.transitionReturnRequest({
      returnRequestId,
      dto,
      actor,
      requestId,
      fromStatus: ReturnRequestStatus.REQUESTED,
      toStatus: ReturnRequestStatus.APPROVED,
      fromOrderStatus: ProductOrderStatus.RETURN_REQUESTED,
      toOrderStatus: ProductOrderStatus.RETURN_APPROVED,
      auditAction: 'RETURN_REQUEST_APPROVED',
      fallbackReason: 'Return request approved',
    });
  }

  rejectReturnRequest(
    returnRequestId: string,
    dto: ReturnTransitionDto,
    actor: CurrentUser,
    requestId?: string,
  ) {
    return this.transitionReturnRequest({
      returnRequestId,
      dto,
      actor,
      requestId,
      fromStatus: ReturnRequestStatus.REQUESTED,
      toStatus: ReturnRequestStatus.REJECTED,
      fromOrderStatus: ProductOrderStatus.RETURN_REQUESTED,
      toOrderStatus: ProductOrderStatus.RETURN_REJECTED,
      auditAction: 'RETURN_REQUEST_REJECTED',
      fallbackReason: 'Return request rejected',
      requireReason: true,
    });
  }

  async markReturnInTransit(
    returnRequestId: string,
    dto: ReturnTransitionDto,
    actor: CurrentUser,
    requestId?: string,
  ) {
    if (!this.accessService.hasPermission(actor, PermissionCode.RETURNS_MANAGE_ANY)) {
      throw new ForbiddenException({
        code: ApiErrorCode.FORBIDDEN,
        message: 'Operations return permission is required to record pickup',
      });
    }
    const request = await this.findReturnRequest(returnRequestId);
    if (request.pickupAssignment) {
      throw new ConflictException({
        code: ApiErrorCode.CONFLICT,
        message: 'The assigned delivery partner must record collection for this return',
      });
    }
    return this.transitionReturnRequest({
      returnRequestId,
      dto,
      actor,
      requestId,
      fromStatus: ReturnRequestStatus.APPROVED,
      toStatus: ReturnRequestStatus.IN_TRANSIT,
      fromOrderStatus: ProductOrderStatus.RETURN_APPROVED,
      toOrderStatus: ProductOrderStatus.RETURN_IN_TRANSIT,
      auditAction: 'RETURN_PICKUP_RECORDED',
      fallbackReason: 'Return pickup recorded by operations',
    });
  }

  receiveReturnRequest(
    returnRequestId: string,
    dto: ReturnTransitionDto,
    actor: CurrentUser,
    requestId?: string,
  ) {
    return this.transitionReturnRequest({
      returnRequestId,
      dto,
      actor,
      requestId,
      fromStatus: ReturnRequestStatus.IN_TRANSIT,
      toStatus: ReturnRequestStatus.RECEIVED,
      fromOrderStatus: ProductOrderStatus.RETURN_IN_TRANSIT,
      toOrderStatus: ProductOrderStatus.RETURNED,
      auditAction: 'RETURN_RECEIVED_BY_SELLER',
      fallbackReason: 'Returned goods received for inspection',
    });
  }

  async inspectReturnRequest(
    returnRequestId: string,
    dto: InspectReturnRequestDto,
    actor: CurrentUser,
    requestId?: string,
  ) {
    const inspectionNote = dto.inspectionNote.trim();
    return this.prisma.$transaction(
      async (tx) => {
        const request = await this.findReturnRequest(returnRequestId, tx);
        this.ensureOperationalReturnAccess(actor, request.distributorOrganisationId, 'manage');
        if (
          request.status !== ReturnRequestStatus.RECEIVED ||
          request.productOrder.status !== ProductOrderStatus.RETURNED
        ) {
          throw new ConflictException({
            code: ApiErrorCode.CONFLICT,
            message: 'Only received returns can be inspected',
          });
        }
        if (request.inspectionDispositions.length > 0 || request.inspectedAt) {
          throw new ConflictException({
            code: ApiErrorCode.CONFLICT,
            message: 'This return request has already been inspected',
          });
        }

        const itemsById = new Map(request.items.map((item) => [item.id, item]));
        const allocatedByItem = new Map<string, number>();
        const allocatedByReservation = new Map<string, number>();
        const tupleKeys = new Set<string>();
        const validated = dto.dispositions.map((disposition) => {
          const item = itemsById.get(disposition.returnRequestItemId);
          if (!item) {
            throw new BadRequestException({
              code: ApiErrorCode.VALIDATION_FAILED,
              message: 'Every inspection disposition must belong to this return request',
            });
          }
          const reservation = item.productOrderItem.reservations.find(
            (candidate) => candidate.id === disposition.reservationId,
          );
          if (!reservation) {
            throw new BadRequestException({
              code: ApiErrorCode.VALIDATION_FAILED,
              message:
                'Every inspection batch must be an original reservation for the returned line',
            });
          }
          const tupleKey = `${item.id}:${reservation.id}:${disposition.outcome}`;
          if (tupleKeys.has(tupleKey)) {
            throw new BadRequestException({
              code: ApiErrorCode.VALIDATION_FAILED,
              message: 'Duplicate inspection dispositions are not allowed',
            });
          }
          tupleKeys.add(tupleKey);
          allocatedByItem.set(item.id, (allocatedByItem.get(item.id) ?? 0) + disposition.quantity);
          allocatedByReservation.set(
            reservation.id,
            (allocatedByReservation.get(reservation.id) ?? 0) + disposition.quantity,
          );
          return { disposition, item, reservation };
        });

        for (const item of request.items) {
          if ((allocatedByItem.get(item.id) ?? 0) !== item.quantity) {
            throw new BadRequestException({
              code: ApiErrorCode.VALIDATION_FAILED,
              message: `Inspection quantities must exactly cover returned quantity for ${item.productOrderItem.productNameSnapshot}`,
            });
          }
        }
        for (const { reservation } of validated) {
          if ((allocatedByReservation.get(reservation.id) ?? 0) > reservation.quantity) {
            throw new BadRequestException({
              code: ApiErrorCode.VALIDATION_FAILED,
              message: 'Inspection quantity cannot exceed the original batch reservation',
            });
          }
        }

        const balancesByBatch = new Map<string, number>();
        const acceptedQuantityByItem = new Map<string, number>();
        for (const { disposition, item } of validated) {
          if (disposition.outcome !== ReturnInspectionOutcome.REJECTED_RETURN) {
            acceptedQuantityByItem.set(
              item.id,
              (acceptedQuantityByItem.get(item.id) ?? 0) + disposition.quantity,
            );
          }
        }
        const approvedRefundAmountPaise = request.items.reduce((total, item) => {
          const acceptedQuantity = acceptedQuantityByItem.get(item.id) ?? 0;
          const acceptedBenefitPaise = Math.floor(
            ((item.clubBenefitPaise ?? 0) * acceptedQuantity) / item.quantity,
          );
          return total + item.unitPricePaise * acceptedQuantity - acceptedBenefitPaise;
        }, 0);
        const dispositionAudit: Prisma.InputJsonObject[] = [];
        for (const { disposition, item, reservation } of validated) {
          const batch = reservation.batch;
          if (disposition.outcome === ReturnInspectionOutcome.RESTOCKABLE) {
            const expired = batch.expiryDate && batch.expiryDate.getTime() < Date.now();
            if (batch.status !== InventoryBatchStatus.ACTIVE || expired) {
              throw new BadRequestException({
                code: ApiErrorCode.VALIDATION_FAILED,
                message: 'Only active, unexpired original batches may receive restockable returns',
              });
            }
          }
          const savedDisposition = await tx.returnInspectionDisposition.create({
            data: {
              returnRequestId: request.id,
              returnRequestItemId: item.id,
              reservationId: reservation.id,
              batchId: batch.id,
              outcome: disposition.outcome,
              quantity: disposition.quantity,
              inspectedByUserId: actor.userId,
            },
          });
          const movementType = this.inspectionMovementType(disposition.outcome);
          let inventoryMovementId: string | null = null;
          if (movementType) {
            const currentBalance =
              balancesByBatch.get(batch.id) ?? (await this.currentBatchBalance(tx, batch.id));
            const quantityDelta =
              disposition.outcome === ReturnInspectionOutcome.RESTOCKABLE
                ? disposition.quantity
                : 0;
            const balanceAfter = currentBalance + quantityDelta;
            balancesByBatch.set(batch.id, balanceAfter);
            const movement = await tx.inventoryMovement.create({
              data: {
                distributorOrganisationId: batch.distributorOrganisationId,
                warehouseId: batch.warehouseId,
                batchId: batch.id,
                productId: batch.productId,
                variantId: batch.variantId,
                movementType,
                quantityDelta,
                balanceAfter,
                reason: `${inspectionNote}; ${disposition.outcome} quantity ${disposition.quantity}`,
                referenceType: 'ReturnInspectionDisposition',
                referenceId: savedDisposition.id,
                createdByUserId: actor.userId,
              },
            });
            inventoryMovementId = movement.id;
            await tx.returnInspectionDisposition.update({
              where: { id: savedDisposition.id },
              data: { inventoryMovementId: movement.id },
            });
            await this.auditService.record(
              {
                actorUserId: actor.userId,
                actorRole: actor.role,
                organisationId: request.distributorOrganisationId,
                action: 'RETURN_INVENTORY_DISPOSITION_RECORDED',
                resourceType: 'InventoryMovement',
                resourceId: movement.id,
                newValue: {
                  returnRequestId: request.id,
                  returnInspectionDispositionId: savedDisposition.id,
                  reservationId: reservation.id,
                  batchId: batch.id,
                  outcome: disposition.outcome,
                  quantity: disposition.quantity,
                  quantityDelta,
                  balanceAfter,
                },
                requestId,
                reason: inspectionNote,
              },
              tx,
            );
          }
          dispositionAudit.push({
            returnRequestItemId: item.id,
            reservationId: reservation.id,
            batchId: batch.id,
            outcome: disposition.outcome,
            quantity: disposition.quantity,
            ...(inventoryMovementId ? { inventoryMovementId } : {}),
          });
        }

        const allRejected = approvedRefundAmountPaise === 0;
        const finalStatus = allRejected
          ? ReturnRequestStatus.COMPLETED
          : ReturnRequestStatus.INSPECTED;
        await tx.returnRequest.update({
          where: { id: request.id },
          data: {
            status: finalStatus,
            inspectedByUserId: actor.userId,
            inspectedAt: new Date(),
            inspectionNote,
            approvedRefundAmountPaise,
            statusHistory: {
              create: allRejected
                ? [
                    {
                      fromStatus: ReturnRequestStatus.RECEIVED,
                      toStatus: ReturnRequestStatus.INSPECTED,
                      actorUserId: actor.userId,
                      actorRole: actor.role,
                      reason: inspectionNote,
                      requestId: requestId ?? null,
                    },
                    {
                      fromStatus: ReturnRequestStatus.INSPECTED,
                      toStatus: ReturnRequestStatus.COMPLETED,
                      actorUserId: actor.userId,
                      actorRole: actor.role,
                      reason: 'All inspected quantities were rejected for return',
                      requestId: requestId ?? null,
                    },
                  ]
                : {
                    fromStatus: ReturnRequestStatus.RECEIVED,
                    toStatus: ReturnRequestStatus.INSPECTED,
                    actorUserId: actor.userId,
                    actorRole: actor.role,
                    reason: inspectionNote,
                    requestId: requestId ?? null,
                  },
            },
          },
        });
        if (allRejected) {
          await tx.productOrder.update({
            where: { id: request.productOrderId },
            data: {
              status: ProductOrderStatus.DELIVERED,
              statusHistory: {
                create: {
                  fromStatus: ProductOrderStatus.RETURNED,
                  toStatus: ProductOrderStatus.DELIVERED,
                  actorUserId: actor.userId,
                  actorRole: actor.role,
                  reason: 'Inspection rejected all returned quantities',
                  requestId: requestId ?? null,
                },
              },
            },
          });
        }
        await this.auditService.record(
          {
            actorUserId: actor.userId,
            actorRole: actor.role,
            organisationId: request.distributorOrganisationId,
            action: 'RETURN_REQUEST_INSPECTED',
            resourceType: 'ReturnRequest',
            resourceId: request.id,
            previousValue: { status: ReturnRequestStatus.RECEIVED },
            newValue: {
              status: finalStatus,
              approvedRefundAmountPaise,
              dispositions: dispositionAudit,
            },
            requestId,
            reason: inspectionNote,
          },
          tx,
        );

        await this.notificationEventsService.emitFarmerEvent(tx, {
          event: FarmerNotificationEvent.RETURN_INSPECTED,
          recipientUserId: request.farmerUserId,
          returnRequestId: request.id,
          productOrderId: request.productOrderId,
          orderNumber: request.productOrder.orderNumber,
          actorUserId: actor.userId,
          actorRole: actor.role,
          requestId,
          amountPaise: approvedRefundAmountPaise,
        });

        return this.toReturnRequest(await this.findReturnRequest(request.id, tx));
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  private async transitionReturnRequest(input: {
    returnRequestId: string;
    dto: ReturnTransitionDto;
    actor: CurrentUser;
    requestId: string | undefined;
    fromStatus: ReturnRequestStatus;
    toStatus: ReturnRequestStatus;
    fromOrderStatus: ProductOrderStatus;
    toOrderStatus: ProductOrderStatus;
    auditAction: string;
    fallbackReason: string;
    requireReason?: boolean;
  }) {
    const suppliedReason = input.dto.reason?.trim();
    if (input.requireReason && !suppliedReason) {
      throw new BadRequestException({
        code: ApiErrorCode.VALIDATION_FAILED,
        message: 'A reason is required when rejecting a return request',
      });
    }
    const reason = suppliedReason || input.fallbackReason;

    return this.prisma.$transaction(
      async (tx) => {
        const request = await this.findReturnRequest(input.returnRequestId, tx);
        this.ensureOperationalReturnAccess(
          input.actor,
          request.distributorOrganisationId,
          'manage',
        );
        if (request.status !== input.fromStatus) {
          throw new ConflictException({
            code: ApiErrorCode.CONFLICT,
            message: `Only ${input.fromStatus} return requests can transition to ${input.toStatus}`,
          });
        }
        if (request.productOrder.status !== input.fromOrderStatus) {
          throw new ConflictException({
            code: ApiErrorCode.CONFLICT,
            message: 'The product order return status is inconsistent with this request',
          });
        }

        await tx.returnRequest.update({
          where: { id: request.id },
          data: {
            status: input.toStatus,
            statusHistory: {
              create: {
                fromStatus: input.fromStatus,
                toStatus: input.toStatus,
                actorUserId: input.actor.userId,
                actorRole: input.actor.role,
                reason,
                requestId: input.requestId ?? null,
              },
            },
          },
        });
        await tx.productOrder.update({
          where: { id: request.productOrderId },
          data: {
            status: input.toOrderStatus,
            statusHistory: {
              create: {
                fromStatus: input.fromOrderStatus,
                toStatus: input.toOrderStatus,
                actorUserId: input.actor.userId,
                actorRole: input.actor.role,
                reason,
                requestId: input.requestId ?? null,
              },
            },
          },
        });
        await this.auditService.record(
          {
            actorUserId: input.actor.userId,
            actorRole: input.actor.role,
            organisationId: request.distributorOrganisationId,
            action: input.auditAction,
            resourceType: 'ReturnRequest',
            resourceId: request.id,
            previousValue: {
              status: input.fromStatus,
              productOrderStatus: input.fromOrderStatus,
            },
            newValue: {
              status: input.toStatus,
              productOrderStatus: input.toOrderStatus,
            },
            requestId: input.requestId,
            reason,
          },
          tx,
        );

        await this.notificationEventsService.emitFarmerEvent(tx, {
          event: this.notificationEventForReturnStatus(input.toStatus),
          recipientUserId: request.farmerUserId,
          returnRequestId: request.id,
          productOrderId: request.productOrderId,
          orderNumber: request.productOrder.orderNumber,
          actorUserId: input.actor.userId,
          actorRole: input.actor.role,
          requestId: input.requestId,
        });

        const updated = await this.findReturnRequest(request.id, tx);
        return this.toReturnRequest(updated);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  private operationalReturnScope(
    actor: CurrentUser,
    accessMode: 'read' | 'manage',
    requestedOrganisationId?: string,
  ): string | undefined {
    const anyPermission =
      accessMode === 'read' ? PermissionCode.RETURNS_READ_ANY : PermissionCode.RETURNS_MANAGE_ANY;
    const ownPermission =
      accessMode === 'read'
        ? PermissionCode.RETURNS_READ_SELLER_OWN
        : PermissionCode.RETURNS_MANAGE_SELLER_OWN;
    if (this.accessService.hasPermission(actor, anyPermission)) {
      return requestedOrganisationId;
    }
    if (!this.accessService.hasPermission(actor, ownPermission)) {
      throw new ForbiddenException({
        code: ApiErrorCode.FORBIDDEN,
        message: 'Operational return permission is required',
      });
    }
    if (requestedOrganisationId && requestedOrganisationId !== actor.organisationId) {
      throw new ForbiddenException({
        code: ApiErrorCode.FORBIDDEN,
        message: 'Distributor users may only access their own seller returns',
      });
    }
    return actor.organisationId;
  }

  private notificationEventForReturnStatus(status: ReturnRequestStatus): FarmerNotificationEvent {
    const events: Partial<Record<ReturnRequestStatus, FarmerNotificationEvent>> = {
      [ReturnRequestStatus.APPROVED]: FarmerNotificationEvent.RETURN_APPROVED,
      [ReturnRequestStatus.REJECTED]: FarmerNotificationEvent.RETURN_REJECTED,
      [ReturnRequestStatus.IN_TRANSIT]: FarmerNotificationEvent.RETURN_IN_TRANSIT,
      [ReturnRequestStatus.RECEIVED]: FarmerNotificationEvent.RETURN_RECEIVED,
    };
    const event = events[status];
    if (!event) {
      throw new Error(`No farmer notification event is defined for return status ${status}`);
    }
    return event;
  }

  private ensureOperationalReturnAccess(
    actor: CurrentUser,
    distributorOrganisationId: string,
    accessMode: 'read' | 'manage',
  ): void {
    const scope = this.operationalReturnScope(actor, accessMode, distributorOrganisationId);
    if (scope && scope !== distributorOrganisationId) {
      throw new ForbiddenException({
        code: ApiErrorCode.FORBIDDEN,
        message: 'Return request is outside the active distributor context',
      });
    }
  }

  private async findReturnRequest(
    returnRequestId: string,
    client: PrismaService | Prisma.TransactionClient = this.prisma,
  ): Promise<ReturnRequestWithDetails> {
    const request = await client.returnRequest.findUnique({
      where: { id: returnRequestId },
      include: returnRequestInclude,
    });
    if (!request) {
      throw new NotFoundException({
        code: ApiErrorCode.NOT_FOUND,
        message: 'Return request was not found',
      });
    }
    return request;
  }

  private async findOwnedReturnRequest(
    returnRequestId: string,
    farmerProfileId: string,
    client: PrismaService | Prisma.TransactionClient = this.prisma,
  ): Promise<ReturnRequestWithDetails> {
    const request = await client.returnRequest.findFirst({
      where: { id: returnRequestId, farmerProfileId },
      include: returnRequestInclude,
    });
    if (!request) {
      throw new NotFoundException({
        code: ApiErrorCode.NOT_FOUND,
        message: 'Return request was not found',
      });
    }
    return request;
  }

  private inspectionMovementType(outcome: ReturnInspectionOutcome): InventoryMovementType | null {
    if (outcome === ReturnInspectionOutcome.RESTOCKABLE) {
      return InventoryMovementType.RETURN_RESTOCKED;
    }
    if (outcome === ReturnInspectionOutcome.QUARANTINED) {
      return InventoryMovementType.RETURN_QUARANTINED;
    }
    if (outcome === ReturnInspectionOutcome.DAMAGED_WRITE_OFF) {
      return InventoryMovementType.DAMAGE_WRITE_OFF;
    }
    return null;
  }

  private async currentBatchBalance(
    tx: Prisma.TransactionClient,
    batchId: string,
  ): Promise<number> {
    const latest = await tx.inventoryMovement.findFirst({
      where: { batchId },
      orderBy: { createdAt: 'desc' },
    });
    return latest?.balanceAfter ?? 0;
  }

  private toEligibility(
    order: Prisma.ProductOrderGetPayload<{ include: typeof returnOrderInclude }>,
  ) {
    const deliveredTransition = [...order.statusHistory]
      .reverse()
      .find((history) => history.toStatus === ProductOrderStatus.DELIVERED);
    const deliveredAt = deliveredTransition?.createdAt ?? null;
    const returnWindowDays = this.configService.getOrThrow<number>('RETURN_WINDOW_DAYS');
    const windowExpiresAt = deliveredAt
      ? new Date(deliveredAt.getTime() + returnWindowDays * 86_400_000)
      : null;
    const existingReturn = order.returnRequests[0] ?? null;

    let reason: string | null = null;
    if (existingReturn) {
      reason = 'A return request already exists for this product order';
    } else if (order.status !== ProductOrderStatus.DELIVERED) {
      reason = 'Only a delivered product order can be returned';
    } else if (!windowExpiresAt || windowExpiresAt.getTime() < Date.now()) {
      reason = 'The return window for this product order has expired';
    }

    return {
      productOrderId: order.id,
      orderNumber: order.orderNumber,
      eligible: reason === null,
      reason,
      deliveredAt,
      windowExpiresAt,
      existingReturnRequestId: existingReturn?.id ?? null,
      items: order.items.map((item) => ({
        productOrderItemId: item.id,
        productName: item.productNameSnapshot,
        variantName: item.variantNameSnapshot,
        orderedQuantity: item.quantity,
        unitPricePaise: item.unitPricePaise,
        clubBenefitPaise: item.clubBenefitPaise,
        farmerPayablePaise: item.unitPricePaise * item.quantity - item.clubBenefitPaise,
      })),
    };
  }

  private toReturnRequest(request: ReturnRequestWithDetails) {
    return {
      id: request.id,
      productOrderId: request.productOrderId,
      orderNumber: request.productOrder.orderNumber,
      sellerName: request.productOrder.sellerNameSnapshot,
      status: request.status,
      reasonCode: request.reasonCode,
      reasonNote: request.reasonNote,
      requestedAt: request.requestedAt,
      windowExpiresAt: request.windowExpiresAt,
      refundableAmountPaise: request.refundableAmountPaise,
      approvedRefundAmountPaise: request.approvedRefundAmountPaise,
      inspectedByUserId: request.inspectedByUserId,
      inspectedAt: request.inspectedAt,
      inspectionNote: request.inspectionNote,
      items: request.items.map((item) => ({
        id: item.id,
        productOrderItemId: item.productOrderItemId,
        productName: item.productOrderItem.productNameSnapshot,
        variantName: item.productOrderItem.variantNameSnapshot,
        quantity: item.quantity,
        unitPricePaise: item.unitPricePaise,
        clubBenefitPaise: item.clubBenefitPaise,
        lineRefundPaise: item.lineRefundPaise,
        reservations: (item.productOrderItem.reservations ?? []).map((reservation) => ({
          id: reservation.id,
          batchId: reservation.batchId,
          batchNumber: reservation.batch.batchNumber,
          batchStatus: reservation.batch.status,
          expiryDate: reservation.batch.expiryDate,
          quantity: reservation.quantity,
        })),
      })),
      inspectionDispositions: (request.inspectionDispositions ?? []).map((disposition) => ({
        id: disposition.id,
        returnRequestItemId: disposition.returnRequestItemId,
        reservationId: disposition.reservationId,
        batchId: disposition.batchId,
        batchNumber: disposition.batch.batchNumber,
        outcome: disposition.outcome,
        quantity: disposition.quantity,
        inventoryMovementId: disposition.inventoryMovementId,
        quantityDelta: disposition.inventoryMovement?.quantityDelta ?? null,
        balanceAfter: disposition.inventoryMovement?.balanceAfter ?? null,
        createdAt: disposition.createdAt,
      })),
      refunds: (request.refunds ?? []).map((refund) => ({
        id: refund.id,
        amountPaise: refund.amountPaise,
        method: refund.method,
        status: refund.status,
        providerMode: refund.providerMode,
        providerRefundReference: refund.providerRefundReference,
        failureReason: refund.failureReason,
        initiatedAt: refund.initiatedAt,
        completedAt: refund.completedAt,
      })),
      pickupAssignment: request.pickupAssignment
        ? {
            id: request.pickupAssignment.id,
            assignmentNumber: request.pickupAssignment.assignmentNumber,
            deliveryPartnerUserId: request.pickupAssignment.deliveryPartnerUserId,
            status: request.pickupAssignment.status,
            assignedAt: request.pickupAssignment.assignedAt,
            respondedAt: request.pickupAssignment.respondedAt,
            rejectionReason: request.pickupAssignment.rejectionReason,
            collectedAt: request.pickupAssignment.collectedAt,
            collectionNote: request.pickupAssignment.collectionNote,
          }
        : null,
      evidence: (request.evidence ?? []).map((evidence) => this.toReturnEvidence(evidence)),
      statusHistory: request.statusHistory.map((history) => ({
        id: history.id,
        fromStatus: history.fromStatus,
        toStatus: history.toStatus,
        actorUserId: history.actorUserId,
        actorRole: history.actorRole,
        reason: history.reason,
        requestId: history.requestId,
        createdAt: history.createdAt,
      })),
      createdAt: request.createdAt,
      updatedAt: request.updatedAt,
    };
  }

  private toReturnEvidence(
    evidence: Prisma.ReturnRequestEvidenceGetPayload<{ include: { storedFile: true } }>,
  ) {
    return {
      id: evidence.id,
      storedFileId: evidence.storedFileId,
      filename: evidence.storedFile.originalFilename,
      contentType: evidence.storedFile.contentType,
      sizeBytes: evidence.storedFile.sizeBytes,
      status: evidence.storedFile.status,
      caption: evidence.caption,
      uploadedByUserId: evidence.uploadedByUserId,
      uploadedByRole: evidence.uploadedByRole,
      createdAt: evidence.createdAt,
    };
  }

  private async findFarmerProfile(
    userId: string,
    client: PrismaService | Prisma.TransactionClient = this.prisma,
  ) {
    const profile = await client.farmerProfile.findUnique({ where: { userId } });
    if (!profile) {
      throw new BadRequestException({
        code: ApiErrorCode.VALIDATION_FAILED,
        message: 'Create the farmer profile before requesting a return',
      });
    }
    return profile;
  }

  private async findOwnedOrder(
    orderId: string,
    farmerProfileId: string,
    client: PrismaService | Prisma.TransactionClient = this.prisma,
  ) {
    const order = await client.productOrder.findFirst({
      where: { id: orderId, farmerProfileId },
      include: returnOrderInclude,
    });
    if (!order) {
      throw new NotFoundException({
        code: ApiErrorCode.NOT_FOUND,
        message: 'Product order was not found',
      });
    }
    return order;
  }

  private ensureFarmerPermission(actor: CurrentUser, permission: PermissionCode): void {
    if (
      actor.role !== PlatformRole.FARMER ||
      !this.accessService.hasPermission(actor, permission)
    ) {
      throw new ForbiddenException({
        code: ApiErrorCode.FORBIDDEN,
        message: 'Farmer return permission is required',
      });
    }
  }

  private normalizedIdempotencyKey(value?: string): string {
    const key = value?.trim();
    if (!key) {
      throw new BadRequestException({
        code: ApiErrorCode.VALIDATION_FAILED,
        message: 'Idempotency-Key header is required for a return request',
      });
    }
    if (key.length > 120) {
      throw new BadRequestException({
        code: ApiErrorCode.VALIDATION_FAILED,
        message: 'Idempotency-Key header must be 120 characters or fewer',
      });
    }
    return key;
  }

  private async runIdempotent<T>(
    scope: string,
    key: string,
    requestHash: string,
    handler: () => Promise<T>,
  ): Promise<T> {
    const existing = await this.prisma.idempotencyRecord.findUnique({
      where: { scope_key: { scope, key } },
    });
    if (existing) {
      if (existing.requestHash !== requestHash) {
        throw new ConflictException({
          code: ApiErrorCode.CONFLICT,
          message: 'Idempotency key was already used for a different return request',
        });
      }
      if (existing.status === IdempotencyStatus.COMPLETED) return existing.response as T;
      if (existing.status === IdempotencyStatus.IN_PROGRESS) {
        throw new ConflictException({
          code: ApiErrorCode.CONFLICT,
          message: 'Return request is already in progress',
        });
      }
      await this.prisma.idempotencyRecord.update({
        where: { id: existing.id },
        data: this.idempotencyInProgressData(requestHash),
      });
    } else {
      try {
        await this.prisma.idempotencyRecord.create({
          data: { scope, key, ...this.idempotencyInProgressData(requestHash) },
        });
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          throw new ConflictException({
            code: ApiErrorCode.CONFLICT,
            message: 'Return request is already in progress',
          });
        }
        throw error;
      }
    }

    try {
      const result = await handler();
      await this.prisma.idempotencyRecord.update({
        where: { scope_key: { scope, key } },
        data: {
          status: IdempotencyStatus.COMPLETED,
          response: JSON.parse(JSON.stringify(result)) as Prisma.InputJsonValue,
          lockedUntil: null,
        },
      });
      return result;
    } catch (error) {
      await this.prisma.idempotencyRecord.update({
        where: { scope_key: { scope, key } },
        data: { status: IdempotencyStatus.FAILED, lockedUntil: null },
      });
      throw error;
    }
  }

  private idempotencyInProgressData(requestHash: string) {
    return {
      status: IdempotencyStatus.IN_PROGRESS,
      requestHash,
      lockedUntil: new Date(Date.now() + 120_000),
      expiresAt: new Date(Date.now() + 86_400_000),
    };
  }

  private hashRequest(value: unknown): string {
    return createHash('sha256').update(this.stableStringify(value)).digest('hex');
  }

  private stableStringify(value: unknown): string {
    if (value === null || typeof value !== 'object') return JSON.stringify(value);
    if (Array.isArray(value)) {
      return `[${value.map((item) => this.stableStringify(item)).join(',')}]`;
    }
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, entryValue]) => entryValue !== undefined)
      .sort(([left], [right]) => left.localeCompare(right));
    return `{${entries
      .map(([key, entryValue]) => `${JSON.stringify(key)}:${this.stableStringify(entryValue)}`)
      .join(',')}}`;
  }
}
