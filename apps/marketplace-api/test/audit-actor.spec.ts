import { PlatformRole } from '@prisma/client';
import type { CurrentUser } from '../src/auth/current-user.interface';
import { isSystemActor, systemActor, withAuditActor } from '../src/common/audit-actor';

describe('audit actor', () => {
  const human: CurrentUser = {
    userId: '00000000-0000-4000-8000-000000000001',
    role: PlatformRole.FINANCE_MANAGER,
    membershipId: '00000000-0000-4000-8000-000000000002',
    organisationId: '00000000-0000-4000-8000-000000000003',
    permissions: [],
  };

  it('attaches user, role and organisation for a human actor', () => {
    const record = withAuditActor(human, {
      action: 'COMMISSION_ENTRY_FINALIZED',
      resourceType: 'CommissionEntry',
    });

    expect(record).toMatchObject({
      actorUserId: human.userId,
      actorRole: PlatformRole.FINANCE_MANAGER,
      organisationId: human.organisationId,
    });
  });

  it('prefers an explicit organisation over the actor organisation', () => {
    const record = withAuditActor(human, {
      action: 'COMMISSION_ENTRY_FINALIZED',
      resourceType: 'CommissionEntry',
      organisationId: '00000000-0000-4000-8000-0000000000ff',
    });

    expect(record.organisationId).toBe('00000000-0000-4000-8000-0000000000ff');
  });

  it('leaves actor identity null for a system actor and names the source', () => {
    const record = withAuditActor(systemActor('job:expire-batches'), {
      action: 'INVENTORY_BATCH_EXPIRED',
      resourceType: 'InventoryBatch',
    });

    // A system change must not borrow a human identity. AuditLog.actorUserId is
    // nullable precisely so this case does not need a synthetic user row.
    expect(record.actorUserId).toBeUndefined();
    expect(record.actorRole).toBeUndefined();
    expect(record.reason).toBe('job:expire-batches');
  });

  it('appends the system source to an existing reason rather than replacing it', () => {
    const record = withAuditActor(systemActor('job:finalize-eligible-commissions'), {
      action: 'COMMISSION_ENTRY_FINALIZED',
      resourceType: 'CommissionEntry',
      reason: 'Return/dispute window elapsed',
    });

    expect(record.reason).toBe('Return/dispute window elapsed (job:finalize-eligible-commissions)');
  });

  it('discriminates system actors from human actors', () => {
    expect(isSystemActor(systemActor('job:test'))).toBe(true);
    expect(isSystemActor(human)).toBe(false);
  });
});
