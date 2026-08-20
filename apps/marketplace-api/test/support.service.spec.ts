import { ForbiddenException } from '@nestjs/common';
import {
  PlatformRole,
  SupportTicketCategory,
  SupportTicketPriority,
  SupportTicketStatus,
  type SupportTicket,
} from '@prisma/client';
import { PermissionCode } from '../src/access/permission-codes';
import type { CurrentUser } from '../src/auth/current-user.interface';
import { SupportService } from '../src/support/support.service';

const farmerUserId = '00000000-0000-4000-8000-000000009001';
const otherFarmerUserId = '00000000-0000-4000-8000-000000009002';
const ticketId = '00000000-0000-4000-8000-000000009101';
const notificationEvents = { emitSupportEvent: jest.fn().mockResolvedValue({}) };

describe('SupportService farmer reopen', () => {
  const farmerActor: CurrentUser = {
    userId: farmerUserId,
    role: PlatformRole.FARMER,
    membershipId: '00000000-0000-4000-8000-000000009201',
    organisationId: '00000000-0000-4000-8000-000000009301',
    permissions: [PermissionCode.SUPPORT_TICKETS_REOPEN_OWN],
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects reopening a ticket raised by another user', async () => {
    const prisma = {
      supportTicket: {
        findUnique: jest
          .fn()
          .mockResolvedValue(ticketFixture({ raisedByUserId: otherFarmerUserId })),
      },
    };
    const service = new SupportService(
      prisma as never,
      { record: jest.fn() } as never,
      { hasPermission: jest.fn() } as never,
      { getOrThrow: jest.fn() } as never,
      notificationEvents as never,
    );

    await expect(
      service.reopenOwnTicket(ticketId, { reason: 'This is not my ticket' }, farmerActor),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('reopens the owned resolved ticket and audits the transition', async () => {
    const ticket = ticketFixture();
    const reopened = ticketFixture({
      status: SupportTicketStatus.REOPENED,
      resolvedAt: null,
    });
    const auditService = { record: jest.fn().mockResolvedValue({}) };
    const tx = {
      supportTicket: {
        update: jest.fn().mockResolvedValue(reopened),
      },
    };
    const prisma = {
      supportTicket: {
        findUnique: jest.fn().mockResolvedValue(ticket),
      },
      $transaction: jest.fn((callback) => callback(tx)),
    };
    const service = new SupportService(
      prisma as never,
      auditService as never,
      { hasPermission: jest.fn() } as never,
      { getOrThrow: jest.fn() } as never,
      notificationEvents as never,
    );

    const result = await service.reopenOwnTicket(
      ticketId,
      { reason: 'The delivery issue is still happening' },
      farmerActor,
      'request-support-reopen',
    );

    expect(result.status).toBe(SupportTicketStatus.REOPENED);
    expect(tx.supportTicket.update).toHaveBeenCalledWith({
      where: { id: ticketId },
      data: {
        status: SupportTicketStatus.REOPENED,
        resolvedAt: null,
        closedAt: null,
      },
    });
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'SUPPORT_TICKET_REOPENED_BY_RAISER',
        actorUserId: farmerUserId,
        resourceId: ticketId,
        requestId: 'request-support-reopen',
      }),
      tx,
    );
    expect(notificationEvents.emitSupportEvent).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        event: 'SUPPORT_TICKET_REOPENED',
        recipientUserId: farmerUserId,
        supportTicketId: ticketId,
      }),
    );
  });

  it('does not route a non-farmer raiser into farmer notifications', async () => {
    const ticket = ticketFixture({ raisedByRole: PlatformRole.SUPPORT_AGENT });
    const reopened = ticketFixture({
      raisedByRole: PlatformRole.SUPPORT_AGENT,
      status: SupportTicketStatus.REOPENED,
      resolvedAt: null,
    });
    const tx = {
      supportTicket: { update: jest.fn().mockResolvedValue(reopened) },
    };
    const prisma = {
      supportTicket: { findUnique: jest.fn().mockResolvedValue(ticket) },
      $transaction: jest.fn((callback) => callback(tx)),
    };
    const service = new SupportService(
      prisma as never,
      { record: jest.fn().mockResolvedValue({}) } as never,
      { hasPermission: jest.fn() } as never,
      { getOrThrow: jest.fn() } as never,
      notificationEvents as never,
    );

    await service.reopenTicket(ticketId, {}, farmerActor);

    expect(notificationEvents.emitSupportEvent).not.toHaveBeenCalled();
  });
});

function ticketFixture(overrides: Partial<SupportTicket> = {}): SupportTicket {
  return { ...baseTicketFixture(), ...overrides };
}

function baseTicketFixture(): SupportTicket {
  return {
    id: ticketId,
    raisedByUserId: farmerUserId,
    raisedByRole: PlatformRole.FARMER,
    raiserOrganisationId: farmerActorOrganisationId,
    productOrderId: null,
    category: SupportTicketCategory.DELIVERY_ISSUE,
    priority: SupportTicketPriority.HIGH,
    subject: 'Delivery delayed',
    description: 'The order has not arrived.',
    status: SupportTicketStatus.RESOLVED,
    assignedToUserId: null,
    assignedAt: null,
    slaDueAt: new Date('2026-08-10T08:00:00.000Z'),
    resolutionNote: 'Carrier contacted.',
    resolvedAt: new Date('2026-08-09T08:00:00.000Z'),
    closedAt: null,
    createdAt: new Date('2026-08-08T08:00:00.000Z'),
    updatedAt: new Date('2026-08-09T08:00:00.000Z'),
  };
}

const farmerActorOrganisationId = '00000000-0000-4000-8000-000000009301';
